import io
import logging
import ipaddress
import math
import mimetypes
import os
import socket
import struct
import threading
import wave
from http.server import BaseHTTPRequestHandler
from http.server import ThreadingHTTPServer
from urllib.parse import quote
from urllib.parse import unquote
from urllib.parse import urlparse


logger = logging.getLogger(__name__)


CUE_TONES = {"ok": ((880, 110),), "err": ((660, 90), (660, 90))}


def build_cue_wav(name):
    """短提示音：成功一声高音，失败两声低音，用于不打断播放的语音反馈。"""
    rate = 48000
    frames = []
    for index, (freq, milliseconds) in enumerate(CUE_TONES[name]):
        if index:
            frames.append(b"\x00\x00" * int(rate * 0.09))
        count = int(rate * milliseconds / 1000)
        fade = max(int(rate * 0.008), 1)
        for sample in range(count):
            gain = 0.6
            if sample < fade:
                gain *= sample / fade
            elif sample > count - fade:
                gain *= (count - sample) / fade
            frames.append(struct.pack("<h", int(gain * 32767 * math.sin(2 * math.pi * freq * sample / rate))))
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(b"".join(frames))
    return buffer.getvalue()


def guess_local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        sock.close()


class LocalMusicHttpServer:
    def __init__(self, host: str, port: int, base_url: str, allowed_dirs=None):
        self.allowed_dirs = [os.path.realpath(root) for root in (allowed_dirs or [])]
        self.host = host
        self.port = port
        self.base_url = base_url.rstrip("/")
        self._allowed_files: set[str] = set()
        self._cue_files: dict[str, bytes] = {}
        self._lock = threading.Lock()
        self._server = ThreadingHTTPServer((self.host, self.port), self._build_handler())
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    def _build_handler(self):
        server_ref = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                parsed = urlparse(self.path)
                path = unquote(parsed.path)

                if path.startswith("/file/"):
                    encoded = path.split("/", 3)[2] if len(path.split("/", 3)) >= 3 else ""
                    server_ref._serve_file(self, encoded)
                    return

                if path.startswith("/cue/"):
                    server_ref._serve_cue(self, path.rsplit("/", 1)[-1].split(".")[0])
                    return

                self.send_response(404)
                self.end_headers()

            def do_HEAD(self):
                parsed = urlparse(self.path)
                path = unquote(parsed.path)
                if path.startswith("/file/"):
                    encoded = path.split("/", 3)[2] if len(path.split("/", 3)) >= 3 else ""
                    server_ref._serve_file(self, encoded, head_only=True)
                    return
                if path.startswith("/cue/"):
                    server_ref._serve_cue(self, path.rsplit("/", 1)[-1].split(".")[0], head_only=True)
                    return
                self.send_response(404)
                self.end_headers()

            def log_message(self, fmt, *args):
                return

        return Handler

    def _encode_path(self, path: str) -> str:
        return path.encode("utf-8").hex()

    def _decode_path(self, encoded: str) -> str:
        return bytes.fromhex(encoded).decode("utf-8")

    def _serve_cue(self, handler: BaseHTTPRequestHandler, name: str, head_only: bool = False):
        with self._lock:
            payload = self._cue_files.get(name)
            if payload is None and name in CUE_TONES:
                payload = build_cue_wav(name)
                self._cue_files[name] = payload
        if payload is None:
            handler.send_response(404)
            handler.end_headers()
            return
        handler.send_response(200)
        handler.send_header("Content-Type", "audio/wav")
        handler.send_header("Content-Length", str(len(payload)))
        handler.send_header("Cache-Control", "max-age=86400")
        handler.end_headers()
        if not head_only:
            handler.wfile.write(payload)

    def _serve_file(self, handler: BaseHTTPRequestHandler, encoded: str, head_only: bool = False):
        try:
            file_path = self._decode_path(encoded)
        except Exception:
            handler.send_response(400)
            handler.end_headers()
            return

        with self._lock:
            is_allowed = file_path in self._allowed_files
        if not is_allowed:
            handler.send_response(403)
            handler.end_headers()
            return

        resolved = os.path.realpath(file_path)
        if not any(os.path.commonpath([root, resolved]) == root and resolved != root for root in self.allowed_dirs):
            handler.send_response(403)
            handler.end_headers()
            return
        if not os.path.isfile(file_path):
            handler.send_response(404)
            handler.end_headers()
            return

        content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        file_size = os.path.getsize(file_path)
        range_header = handler.headers.get("Range")

        start = 0
        end = file_size - 1
        status = 200

        if range_header:
            parsed = self._parse_range_header(range_header, file_size)
            if parsed is None:
                handler.send_response(416)
                handler.send_header("Content-Range", f"bytes */{file_size}")
                handler.end_headers()
                return
            start, end = parsed
            status = 206

        content_length = end - start + 1
        handler.send_response(status)
        handler.send_header("Content-Type", content_type)
        handler.send_header("Accept-Ranges", "bytes")
        handler.send_header("Content-Length", str(content_length))
        if status == 206:
            handler.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        handler.end_headers()

        if head_only:
            return

        with open(file_path, "rb") as file_obj:
            file_obj.seek(start)
            remaining = content_length
            while remaining > 0:
                chunk = file_obj.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                try:
                    handler.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break
                remaining -= len(chunk)

    def _parse_range_header(self, range_header: str, file_size: int) -> tuple[int, int] | None:
        value = range_header.strip().lower()
        if not value.startswith("bytes="):
            return None

        spec = value.split("=", 1)[1].split(",", 1)[0].strip()
        if "-" not in spec:
            return None
        start_text, end_text = spec.split("-", 1)

        try:
            if start_text == "":
                suffix_len = int(end_text)
                if suffix_len <= 0:
                    return None
                start = max(file_size - suffix_len, 0)
                end = file_size - 1
            else:
                start = int(start_text)
                end = file_size - 1 if end_text == "" else int(end_text)
                if start < 0 or end < start:
                    return None
                if start >= file_size:
                    return None
                end = min(end, file_size - 1)
            return start, end
        except Exception:
            return None

    def start(self):
        logger.info(
            "HTTP 服务启动: host=%s port=%d base_url=%s",
            self.host,
            self.port,
            self.base_url,
        )
        self._thread.start()

    def stop(self):
        logger.info("HTTP 服务停止")
        self._server.shutdown()
        self._server.server_close()

    def create_file_url(self, file_path: str) -> str:
        file_path = os.path.realpath(file_path)
        if not any(os.path.commonpath([root, file_path]) == root and file_path != root for root in self.allowed_dirs):
            raise ValueError("Music path is outside permitted directories")
        with self._lock:
            self._allowed_files.add(file_path)
        encoded = self._encode_path(file_path)
        filename = quote(os.path.basename(file_path), safe="")
        return f"{self.base_url}/file/{encoded}/{filename}"


def build_music_server(http_config: dict) -> LocalMusicHttpServer:
    port = int(http_config.get("port", 18080))
    base_url = str(http_config.get("base_url") or "").strip()

    if not base_url:
        base_url = f"http://{guess_local_ip()}:{port}"

    host = str(http_config.get("host", "127.0.0.1"))
    address = ipaddress.ip_address(host)
    if address.version != 4 or address.is_unspecified or not (address.is_private or address.is_loopback):
        raise RuntimeError("Unsafe music listener address")
    return LocalMusicHttpServer(host=host, port=port, base_url=base_url, allowed_dirs=http_config.get("allowed_dirs", []))
