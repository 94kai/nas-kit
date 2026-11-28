import json

import open_xiaoai_server


def _escape_shell_single_quote(text: str) -> str:
    return text.replace("'", "'\"'\"'")


async def run_shell(script: str, timeout_ms: float = 10_000):
    result = await open_xiaoai_server.run_shell(script, timeout_ms)
    try:
        return json.loads(result)
    except Exception:
        return {"raw": result}


async def speak_text(text: str):
    escaped = _escape_shell_single_quote(text)
    script = f"/usr/sbin/tts_play.sh '{escaped}'"
    return await run_shell(script)


async def ask_xiaoai(text: str, silent: bool = False):
    if type(silent) is not bool:
        raise ValueError("静默参数必须是布尔值")
    payload = {"tts": 0 if silent else 1, "nlp": 1, "nlp_text": text}
    encoded = _escape_shell_single_quote(json.dumps(payload, ensure_ascii=False))
    script = f"ubus call mibrain ai_service '{encoded}'"
    return await run_shell(script)


async def play_music_url(url: str):
    payload = {"url": url, "type": 1}
    encoded = _escape_shell_single_quote(json.dumps(payload))
    script = f"ubus call mediaplayer player_play_url '{encoded}'"
    return await run_shell(script)


async def stop_playback():
    return await run_shell("mphelper pause")


async def set_volume(volume: int):
    value = max(0, min(100, int(volume)))
    payload = json.dumps({"volume": value})
    return await run_shell(f"ubus call mediaplayer player_set_volume '{payload}'")
