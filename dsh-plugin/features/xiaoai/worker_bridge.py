"""将现有 open-xiaoai 设备驱动接入 Allinone 管理接口。"""
import argparse
import hmac
import asyncio
import logging
import json
import os
import random
import signal
import sys
import threading
import types
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def load_config(path):
    with open(path, "r", encoding="utf-8") as file_obj:
        return json.load(file_obj)


parser = argparse.ArgumentParser()
parser.add_argument("--config", required=True)
args = parser.parse_args()
os.umask(0o077)
PROFILE = load_config(args.config)
if not isinstance(PROFILE.get('api_token'), str) or len(PROFILE['api_token']) < 32:
    raise RuntimeError('Missing worker authentication token')

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(args.config)), "python-deps"))
# 音乐核心和小爱协议实现均来自当前模块，不依赖外部项目目录。
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "runtime"))
os.environ["XIAOAI_WS_PORT"] = str(PROFILE["ws_port"])
os.environ["XIAOAI_BIND_HOST"] = PROFILE.get("bind_host", "127.0.0.1")
config_module = types.ModuleType("config")
config_module.MUSIC_CONFIG = PROFILE["music"]
sys.modules["config"] = config_module

import open_xiaoai_server  # noqa: E402
from main import App  # noqa: E402
from automation_runtime import Automation
from player_control import ask_xiaoai, set_volume, speak_text
from music_search import extract_play_keyword, is_stop_play_command  # noqa: E402
from stop_commands import RULES as STOP_COMMAND_RULES

logger = logging.getLogger(__name__)


class Runtime:
    loop = None
    listener_task = None
    api_server = None
    stopping = False
    automation = None
    local_voice = None
    playlist_pipe = None

    @classmethod
    def report_voice_playlist(cls, paths):
        if not paths or not cls.playlist_pipe:
            return
        with App.searcher._lock:
            items = {song.path: song for song in App.searcher._songs}
        songs = [cls.song_payload(items[path]) for path in paths if path in items]
        try:
            cls.playlist_pipe.write(json.dumps(songs, ensure_ascii=False) + "\n")
            cls.playlist_pipe.flush()
        except OSError:
            logger.warning("离线语音播放列表未能同步到工具箱")

    @staticmethod
    def song_payload(song):
        return {"path": song.path, "name": os.path.basename(song.path), "title": song.title_lower,
                "artist": song.artist_lower, "album": song.album_lower, "size": song.size}

    @classmethod
    def on_player_event(cls, event):
        # 原厂主动播音频时只清除 NAS 待播与切歌计时，不发任何设备命令。
        song = App.current_song
        if not song:
            return
        try:
            data = json.loads(event)
            if data.get("event") != "instruction":
                return
            line = json.loads(data["data"]["NewLine"])
            header = line["header"]
            if header.get("namespace") == "AudioPlayer" and header.get("name") == "Play" and song.url not in json.dumps(line.get("payload"), ensure_ascii=False):
                asyncio.create_task(cls.release_queue(song))
        except (KeyError, TypeError, ValueError, AttributeError):
            return

    @staticmethod
    async def release_queue(song):
        async with App.local_music_lock:
            if App.current_song is song:
                await App._clear_queue_unlocked(stop_device=False)
                logger.info("原厂播放器已开始播放，取消 NAS 自动切歌")

    @classmethod
    async def play_keyword(cls, keyword, voice=False):
        if not keyword:
            raise ValueError("请输入搜索关键词")
        paths = await asyncio.to_thread(App.searcher.find, keyword, phonetic_fallback=voice)
        if not paths:
            logger.info("未找到匹配歌曲: 关键词=%s", keyword)
            if voice:
                return
            raise ValueError("没有找到可播放的歌曲")
        played = await cls.play_playlist(App.play_mode, paths, trigger="理想同学" if voice else "搜索播放")
        if voice:
            cls.report_voice_playlist(played)

    @classmethod
    async def voice_command(cls, text):
        if is_stop_play_command(text, App.stop_keywords):
            if App.current_song:
                await App.stop_music()
        elif cls.automation and await cls.automation.voice(text):
            return
        elif App._is_refresh_index_command(text):
            await App.refresh_music_index("理想同学语音刷新")
        elif App._is_random_play_command(text):
            paths = await asyncio.to_thread(App.searcher.random_pick)
            if paths:
                cls.report_voice_playlist(await cls.play_playlist(App.play_mode, paths, trigger="理想同学随机播放"))
        elif keyword := extract_play_keyword(text, App.play_keywords):
            await cls.play_keyword(keyword, voice=True)

    @classmethod
    async def stop_connection(cls):
        if cls.listener_task:
            cls.listener_task.cancel()
            try:
                await cls.listener_task
            except asyncio.CancelledError:
                pass
            cls.listener_task = None

    @classmethod
    def status(cls):
        current = App.current_song
        queue = []
        if current:
            queue.append({"name": current.name, "path": current.path, "durationSec": current.duration_sec, "current": True})
        queue.extend({"name": song.name, "path": song.path, "durationSec": song.duration_sec, "current": False} for song in App.play_queue[:99])
        return {
            "automation": cls.automation.status() if cls.automation else None,
            "id": PROFILE["id"],
            "name": PROFILE["name"],
            "localVoice": cls.local_voice.status() if cls.local_voice else None,
            "builtinStopKeywords": STOP_COMMAND_RULES["commands"],
            "speakerConnected": open_xiaoai_server.is_connected(),
            "librarySize": App.searcher.index_size(),
            "refreshing": App.index_refresh_lock.locked(),
            "currentSong": current.name if current else None,
            "queueSize": len(App.play_queue),
            "playMode": App.play_mode,
            "queue": queue,
            "wsPort": PROFILE["ws_port"],
            "httpPort": PROFILE["music"]["http"]["port"],
        }

    @classmethod
    def search(cls, keyword):
        key = keyword.strip().lower()
        if not key:
            return []
        with App.searcher._lock:
            songs = App.searcher._songs[:]
        result = []
        for song in songs:
            if key not in (song.name_lower, song.title_lower, song.artist_lower, song.album_lower) and not any(
                key in value for value in (song.name_lower, song.title_lower, song.artist_lower, song.album_lower)
            ):
                continue
            result.append(cls.song_payload(song))
            if len(result) >= 100:
                break
        return result

    @classmethod
    async def play_path(cls, path, repeat=1):
        with App.searcher._lock:
            allowed = any(song.path == path for song in App.searcher._songs)
        if not allowed:
            raise ValueError("歌曲不在当前曲库索引中")
        songs = await asyncio.to_thread(App._build_song_items, [path], App.music_server)
        if not songs:
            raise ValueError("无法读取歌曲时长")
        repeat = max(1, min(20, int(repeat)))
        songs *= repeat
        await App.clear_queue(stop_device=True)
        async with App.local_music_lock:
            App.play_queue = songs
            first_song = App.play_queue.pop(0)
            await App._start_song_unlocked(first_song, trigger="网页播放")

    PLAY_MODES = ("sequence", "loop-all", "loop-one", "shuffle")

    @classmethod
    async def play_paths(cls, paths, repeat=1):
        """Legacy repeat-based playback used by scheduled playlists and voice."""
        clean_paths = list(dict.fromkeys(str(item) for item in paths if str(item)))[:500]
        if not clean_paths:
            raise ValueError("播放列表不能为空")
        with App.searcher._lock:
            allowed = {song.path for song in App.searcher._songs}
        if any(item not in allowed for item in clean_paths):
            raise ValueError("播放列表包含不在当前曲库中的歌曲")
        songs = await asyncio.to_thread(App._build_song_items, clean_paths, App.music_server)
        if not songs:
            raise ValueError("播放列表中没有可播放的歌曲")
        repeat = max(1, min(20, int(repeat)))
        if len(songs) * repeat > 2000:
            raise ValueError("循环后的播放队列不能超过 2000 首")
        songs *= repeat
        await App.clear_queue(stop_device=True)
        async with App.local_music_lock:
            App.play_queue = songs
            first_song = App.play_queue.pop(0)
            await App._start_song_unlocked(first_song, trigger="歌单播放")
        return list(dict.fromkeys(song.path for song in songs))

    @classmethod
    async def play_playlist(cls, mode, source, paths=None, *, trigger="网页播放列表"):
        """Single playlist playback: ordered source plus a playback mode."""
        source_paths = list(dict.fromkeys(str(item) for item in (source or []) if str(item)))[:1000]
        if not source_paths:
            raise ValueError("播放列表不能为空")
        with App.searcher._lock:
            allowed = {song.path for song in App.searcher._songs}
        if any(item not in allowed for item in source_paths):
            raise ValueError("播放列表包含不在当前曲库中的歌曲")
        songs = await asyncio.to_thread(App._build_song_items, source_paths, App.music_server)
        if not songs:
            raise ValueError("播放列表中没有可播放的歌曲")
        mode = str(mode) if str(mode) in cls.PLAY_MODES else "sequence"
        start = 0
        if paths:
            first = str(paths[0])
            start = next((index for index, song in enumerate(songs) if song.path == first), -1)
            if start < 0:
                raise ValueError("歌曲不在播放列表中")
        if mode == "shuffle":
            order = list(songs)
            random.shuffle(order)
        else:
            order = songs[start:]
        # Stop the device before starting a new song: some players reject or hang
        # when player_play_url is issued while another track is still active.
        await App.clear_queue(stop_device=True)
        async with App.local_music_lock:
            App.play_source = songs
            App.play_mode = mode
            App.play_queue = order
            first_song = App.play_queue.pop(0)
            logger.info(
                "开始播放列表: 模式=%s 共%d首 起始位置=%d 待播=%d",
                mode,
                len(songs),
                start,
                len(App.play_queue),
            )
            await App._start_song_unlocked(first_song, trigger=trigger)
        return [song.path for song in songs]

    @classmethod
    async def set_play_mode(cls, mode):
        mode = str(mode)
        if mode not in cls.PLAY_MODES:
            raise ValueError("播放模式无效")
        async with App.local_music_lock:
            if not App.play_source:
                App.play_source = ([App.current_song] if App.current_song else []) + list(App.play_queue)
            App.play_mode = mode
            if mode == "shuffle" and App.play_queue:
                random.shuffle(App.play_queue)
        return {"success": True, "playMode": mode}


def run_async(coro, timeout=120):
    future = asyncio.run_coroutine_threadsafe(coro, Runtime.loop)
    return future.result(timeout=timeout)


class ApiHandler(BaseHTTPRequestHandler):
    def send_json(self, status, body):
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def read_json(self):
        size = int(self.headers.get("Content-Length", "0"))
        if size < 0 or size > 64 * 1024:
            raise ValueError("请求内容过大")
        return json.loads(self.rfile.read(size) or b"{}")

    def authorized(self):
        expected = "Bearer " + PROFILE["api_token"]
        if not hmac.compare_digest(self.headers.get("Authorization", ""), expected):
            self.send_json(401, {"error": "Worker authorization required"})
            return False
        return True

    def do_GET(self):
        if not self.authorized():
            return
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/status":
                return self.send_json(200, Runtime.status())
            if parsed.path == "/local-voice" and Runtime.local_voice:
                return self.send_json(200, Runtime.local_voice.status())
            if parsed.path == "/search":
                keyword = parse_qs(parsed.query).get("q", [""])[0]
                return self.send_json(200, {"items": Runtime.search(keyword)})
            self.send_json(404, {"error": "接口不存在"})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def do_POST(self):
        if not self.authorized():
            return
        try:
            body = self.read_json()
            if self.path == "/local-voice":
                if not Runtime.local_voice:
                    return self.send_json(503, {"error": "本地语音模型未配置"})
                return self.send_json(200, run_async(Runtime.local_voice.update(body), 20))
            if self.path == "/play":
                run_async(Runtime.play_path(str(body.get("path", "")), body.get("repeat", 1)))
            elif self.path == "/queue/play":
                run_async(Runtime.play_paths(body.get("paths", []), body.get("repeat", 1)))
            elif self.path == "/queue/playlist":
                run_async(Runtime.play_playlist(body.get("mode", "sequence"), body.get("source", []), body.get("paths")))
            elif self.path == "/queue/mode":
                return self.send_json(200, run_async(Runtime.set_play_mode(body.get("mode", ""))))
            elif self.path == "/play-search":
                run_async(Runtime.play_keyword(str(body.get("keyword", "")).strip()))
            elif self.path == "/random":
                run_async(Runtime.play_paths(App.searcher.random_pick(), body.get("repeat", 1)))
            elif self.path == "/stop":
                run_async(App.stop_music())
            elif self.path == "/refresh":
                total, cost_ms = run_async(App.refresh_music_index("网页刷新"), 600)
                return self.send_json(200, {"success": True, "total": total, "costMs": cost_ms})
            elif self.path == "/volume":
                volume = max(0, min(100, int(body.get("volume", 0))))
                run_async(set_volume(volume))
                return self.send_json(200, {"success": True, "volume": volume})
            elif self.path == "/speak":
                text = str(body.get("text", "")).strip()
                if not text:
                    raise ValueError("请输入要播报的文字")
                if len(text) > 500:
                    raise ValueError("播报文字不能超过 500 个字符")
                if any(ord(char) < 32 and char not in "\n\r\t" for char in text):
                    raise ValueError("播报文字包含不支持的控制字符")
                run_async(speak_text(text), 30)
            elif self.path == "/ask":
                text = str(body.get("text", "")).strip()
                if not text:
                    raise ValueError("请输入要执行的小爱指令")
                if len(text) > 200:
                    raise ValueError("小爱指令不能超过 200 个字符")
                if any(ord(char) < 32 and char not in "\n\r\t" for char in text):
                    raise ValueError("小爱指令包含不支持的控制字符")
                silent = body.get("silent", False)
                if type(silent) is not bool:
                    raise ValueError("静默参数必须是布尔值")
                run_async(ask_xiaoai(text, silent=silent), 30)
            else:
                return self.send_json(404, {"error": "接口不存在"})
            self.send_json(200, {"success": True})
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def log_message(self, fmt, *args):
        return


async def main():
    Runtime.loop = asyncio.get_running_loop()
    App.loop = Runtime.loop
    App._ensure_ffprobe_available()
    from music_service import build_music_server
    App.music_server = build_music_server(PROFILE["music"].get("http", {}))
    App.music_server.start()
    Runtime.api_server = ThreadingHTTPServer(("127.0.0.1", PROFILE["api_port"]), ApiHandler)
    threading.Thread(target=Runtime.api_server.serve_forever, daemon=True).start()
    if "XIAOAI_PLAYLIST_FD" in os.environ:
        Runtime.playlist_pipe = os.fdopen(int(os.environ["XIAOAI_PLAYLIST_FD"]), "w", encoding="utf-8")
    voice_root = Path(args.config).resolve().parent / "local-voice"
    if (voice_root / "asr/model.int8.onnx").is_file() and (voice_root / "kws/tokens.txt").is_file() and (voice_root / "deps").is_dir():
        from local_voice import LocalVoice
        Runtime.local_voice = LocalVoice(voice_root, PROFILE["id"], Runtime.voice_command)
    open_xiaoai_server.register_fn("on_event", Runtime.on_player_event)
    Runtime.listener_task = open_xiaoai_server.start_server()
    await App.refresh_music_index("启动刷新")
    Runtime.automation = Automation(PROFILE, Runtime.play_paths, open_xiaoai_server.is_connected, Runtime.report_voice_playlist)
    Runtime.automation.timer = asyncio.create_task(Runtime.automation.run())
    if App.refresh_interval_sec > 0:
        App.index_refresh_task = asyncio.create_task(App.run_index_refresh_loop())
    stop_event = asyncio.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        Runtime.loop.add_signal_handler(sig, stop_event.set)
    await stop_event.wait()
    if Runtime.local_voice:
        await Runtime.local_voice.close()
    if Runtime.automation:
        await Runtime.automation.stop()
    await Runtime.stop_connection()
    if App.index_refresh_task:
        App.index_refresh_task.cancel()
    tasks = [App.index_refresh_task, App.timer_task]
    for task in tasks:
        if task:
            task.cancel()
    await asyncio.gather(*(task for task in tasks if task), return_exceptions=True)
    Runtime.api_server.shutdown()
    Runtime.api_server.server_close()
    App.music_server.stop()
    if Runtime.playlist_pipe:
        Runtime.playlist_pipe.close()


asyncio.run(main())
