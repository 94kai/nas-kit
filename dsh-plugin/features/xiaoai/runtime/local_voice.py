"""NAS-only wake word; model files are shared, each worker owns its recording."""
import asyncio
import json
import logging
import re
import sys
import time
import unicodedata
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import open_xiaoai_server as device
from music_search import normalize_keyword

logger = logging.getLogger(__name__)
ZONE = ZoneInfo("Asia/Shanghai")
RATE = 16000
DEFAULT_WAKE_WORD = "理想同学"
DEFAULT_WAKE_TOKENS = "l ǐ x iǎng t óng x ué"
CLOCK = re.compile(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]\Z")


class LocalVoice:
    def __init__(self, root, profile_id, dispatch):
        self.root = root
        self.dispatch = dispatch
        self.path = root / f"{profile_id}-settings.json"
        source = self.path if self.path.is_file() or profile_id != "new-speaker" else root / "settings.json"
        try:
            self.settings = json.loads(source.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            self.settings = {}
        self.connection = None
        self.recording = False
        self.last_frame_at = 0
        self.error = ""
        self.kws = self.asr = self.stream = None
        self.capture = None
        self.command = None
        self.resume_at = 0
        self.lock = asyncio.Lock()
        self.timer = asyncio.create_task(self.run())

    def period(self):
        start, stop = self.settings.get("start"), self.settings.get("stop")
        if not start or not stop:
            return None, None
        now = datetime.now(ZONE)
        edges = []
        for offset in (-1, 0, 1):
            day = now + timedelta(days=offset)
            for clock, enabled in ((start, True), (stop, False)):
                hour, minute = map(int, clock.split(":"))
                edges.append((day.replace(hour=hour, minute=minute, second=0, microsecond=0), enabled))
        return max(edge for edge in edges if edge[0] <= now)[1], min(edge[0] for edge in edges if edge[0] > now)

    def desired(self):
        scheduled, _ = self.period()
        override = self.settings.get("override")
        if override and override["until"] > time.time():
            return override["enabled"]
        return scheduled if scheduled is not None else bool(self.settings.get("enabled", False))

    @property
    def wake_word(self):
        return self.settings.get("wakeWord", DEFAULT_WAKE_WORD)

    def status(self):
        return {"wakeWord": self.wake_word, "enabled": self.desired(), "recording": self.recording,
                "streaming": self.recording and 0 < time.monotonic() - self.last_frame_at < 3,
                "start": self.settings.get("start"), "stop": self.settings.get("stop"), "error": self.error}

    def save(self, settings):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(settings, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.path)
        self.settings = settings

    async def update(self, changes):
        if not isinstance(changes, dict):
            raise ValueError("监听设置必须是对象")
        async with self.lock:
            settings = dict(self.settings)
            _, next_edge = self.period()
            if set(changes) == {"wakeWord"}:
                word = changes["wakeWord"].strip() if isinstance(changes["wakeWord"], str) else ""
                tokens = self.keyword_tokens(word)
                if word != self.wake_word:
                    # 先准备好新检测器，失败则旧词继续工作。仅替换 KWS，不碰录音或播放器。
                    kws = await asyncio.to_thread(self.build_spotter, word, tokens) if self.recording else None
                    stream = kws.create_stream() if kws else None
                    settings["wakeWord"] = word
                    self.save(settings)
                    self.kws, self.stream = kws, stream
                    logger.info("NAS 唤醒词已更新: %s", word)
                return self.status()
            if set(changes) == {"enabled"} and type(changes["enabled"]) is bool:
                if next_edge:
                    settings["override"] = {"enabled": changes["enabled"], "until": next_edge.timestamp()}
                else:
                    settings["enabled"] = changes["enabled"]
            elif set(changes) == {"start", "stop"}:
                start, stop = changes["start"], changes["stop"]
                if start is not None or stop is not None:
                    if not all(isinstance(value, str) and CLOCK.fullmatch(value) for value in (start, stop)) or start == stop:
                        raise ValueError("启停时间必须为不同的 HH:MM")
                settings.update(start=start, stop=stop, enabled=False, override=None)
            else:
                raise ValueError("请设置监听开关、唤醒词或一组启停时间")
            self.save(settings)
            await self.sync_locked()
            return self.status()

    def keyword_tokens(self, word):
        if not re.fullmatch(r"[\u4e00-\u9fff]{3,8}", word):
            raise ValueError("唤醒词请输入 3–8 个汉字，建议 4–6 字")
        if word == DEFAULT_WAKE_WORD:
            return DEFAULT_WAKE_TOKENS
        try:
            from pypinyin import Style, lazy_pinyin
            from pypinyin.contrib.tone_convert import to_initials, to_finals_tone
        except ImportError as exc:
            raise ValueError("NAS 未安装拼音依赖，暂不能自定义唤醒词") from exc

        def tokenize(phrase):
            return [token for syllable in lazy_pinyin(phrase, style=Style.TONE)
                    for token in (to_initials(syllable, strict=False), to_finals_tone(syllable, strict=False)) if token]

        def toneless(tokens):
            return ''.join(ch for ch in unicodedata.normalize('NFD', ' '.join(tokens)) if not unicodedata.combining(ch))

        tokens = tokenize(word)
        if toneless(tokens) == toneless(tokenize("小爱同学")):
            raise ValueError("请避开原厂唤醒词「小爱同学」及其同音词")
        known = {line.split()[0] for line in (self.root / "kws/tokens.txt").read_text(encoding="utf-8").splitlines() if line.strip()}
        if not tokens or any(token not in known for token in tokens):
            raise ValueError("唤醒模型不支持这个词的读音，请换一个")
        return ' '.join(tokens)

    def build_spotter(self, word, tokens):
        import sherpa_onnx

        kws_dir = self.root / "kws"
        model = "epoch-12-avg-2-chunk-16-left-64.onnx"
        keywords = self.path.with_suffix(".keywords.txt")
        keywords.write_text(f"{tokens} @{word}\n", encoding="utf-8")
        return sherpa_onnx.KeywordSpotter(tokens=str(kws_dir / "tokens.txt"),
            **{name: str(kws_dir / f"{name}-{model}") for name in ("encoder", "decoder", "joiner")},
            keywords_file=str(keywords), num_threads=2, provider="cpu")

    def load_models(self):
        if self.asr is None:
            sys.path.insert(0, str(self.root / "deps"))
            import numpy as np
            import sherpa_onnx
            self.np = np
            asr_dir = self.root / "asr"
            self.asr = sherpa_onnx.OfflineRecognizer.from_paraformer(
                paraformer=str(asr_dir / "model.int8.onnx"), tokens=str(asr_dir / "tokens.txt"), num_threads=2)
        if self.kws is None:
            self.kws = self.build_spotter(self.wake_word, self.keyword_tokens(self.wake_word))

    async def set_recording(self, enabled):
        if enabled:
            await asyncio.to_thread(self.load_models)
            # A start timeout is ambiguous. Keep the connection marked as recording so
            # disabling still sends a stop; an unsuccessful stop closes this socket.
            self.recording = True
            self.stream = self.kws.create_stream()
            device.register_fn("on_record", self.on_record)
        else:
            device.unregister_fn("on_record")
            self.capture = self.stream = None
            if self.command and not self.command.done():
                self.command.cancel()
        connection = self.connection
        try:
            result = await device.call_device("start_recording" if enabled else "stop_recording", timeout_millis=1600)
            if result.get("code") not in (None, 0):
                raise RuntimeError(result.get("msg") or "音箱拒绝录音指令")
        except Exception:
            device.unregister_fn("on_record")
            if connection:
                connection.close()
            self.recording = False
            raise
        self.recording = enabled
        logger.info("%s监听%s", self.wake_word, "已开启" if enabled else "已关闭（录音已停止）")

    async def sync(self):
        async with self.lock:
            await self.sync_locked()

    async def sync_locked(self):
        connection = device.connection()
        if connection is not self.connection:
            device.unregister_fn("on_record")
            self.connection = connection
            self.recording = False
            self.capture = self.stream = None
            if self.command and not self.command.done():
                self.command.cancel()
        if connection and self.desired() != self.recording:
            try:
                await self.set_recording(self.desired())
                self.error = ""
            except Exception as exc:
                self.error = "音箱录音控制失败或本地模型不可用"
                logger.warning("%s: %s", self.error, exc)


    async def run(self):
        while True:
            await self.sync()
            await asyncio.sleep(1 if not self.error else 5)

    async def close(self):
        self.timer.cancel()
        await asyncio.gather(self.timer, return_exceptions=True)
        if self.recording and device.connection() is self.connection:
            try:
                await self.set_recording(False)
            except Exception:
                logger.warning("退出时未收到停止录音确认，关闭设备连接")

    def on_record(self, raw):
        if not self.recording or self.stream is None:
            return
        try:
            message = json.loads(raw)
            if message.get("tag") != "record":
                return
            pcm = bytes(message["bytes"])
            if not pcm or len(pcm) % 2:
                return
        except (AttributeError, KeyError, TypeError, ValueError):
            return
        now = time.monotonic()
        self.last_frame_at = now
        if now < self.resume_at or (self.command and not self.command.done()):
            return
        np = self.np
        audio = np.frombuffer(pcm, dtype="<i2").astype(np.float32)
        level = float(np.sqrt(np.mean(audio ** 2)))
        audio = np.clip(audio * (8 / 32768), -1, 1)
        if self.capture is not None:
            chunks, started, last_voice = self.capture
            chunks.append(audio)
            if level >= 40:
                last_voice = now
            if now - started >= 4.5 or (last_voice and now - last_voice >= 0.65):
                self.capture = None
                self.command = asyncio.create_task(self.handle_command(np.concatenate(chunks)))
            else:
                self.capture = chunks, started, last_voice
            return
        self.stream.accept_waveform(RATE, audio)
        while self.kws.is_ready(self.stream):
            self.kws.decode_stream(self.stream)
            if self.kws.get_result(self.stream):
                self.kws.reset_stream(self.stream)
                logger.info("NAS 唤醒命中: %s", self.wake_word)
                self.command = asyncio.create_task(self.cue())
                return

    async def cue(self):
        # 原厂自带本地提示音；直接播放文件，不调用原厂唤醒或云端合成。
        try:
            await device.run_shell("miplayer -f /usr/share/sound-vendor/AiNiRobot/wakeup_zai_01.wav", 2000)
        except Exception:
            logger.info("NAS 唤醒提示音未确认")
        if self.recording and self.desired():
            self.capture = [], time.monotonic(), 0

    def transcribe(self, audio):
        stream = self.asr.create_stream()
        stream.accept_waveform(RATE, audio)
        self.asr.decode_stream(stream)
        return stream.result.text

    async def handle_command(self, audio):
        try:
            text = normalize_keyword(await asyncio.to_thread(self.transcribe, audio)).rstrip("。！？?!，,").strip()
            if not self.recording or not self.desired():
                return
            logger.info("NAS 离线识别: %s", text)
            if text:
                await self.dispatch(text)
        except Exception:
            logger.exception("NAS 本地点歌失败")
        finally:
            self.resume_at = time.monotonic() + 1
