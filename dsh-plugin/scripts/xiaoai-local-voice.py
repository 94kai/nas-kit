#!/usr/bin/env python3
"""Control a speaker's NAS wake-word listener via its local worker."""
import argparse
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description="理想同学监听")
parser.add_argument("--speaker", choices=("new-speaker", "living-room"), default="new-speaker")
commands = parser.add_subparsers(dest="action", required=True)
for action in ("status", "on", "off", "unschedule"):
    commands.add_parser(action)
wake = commands.add_parser("wake-word", help="为所选音箱设置唤醒词")
wake.add_argument("word", metavar="唤醒词")
clock = commands.add_parser("schedule", help="设置每日开启和关闭时间（Asia/Shanghai）")
clock.add_argument("start", metavar="开启时间")
clock.add_argument("stop", metavar="关闭时间")
args = parser.parse_args()
if args.action in ("on", "off"):
    body = {"enabled": args.action == "on"}
elif args.action == "wake-word":
    body = {"wakeWord": args.word}
elif args.action == "schedule":
    body = {"start": args.start, "stop": args.stop}
elif args.action == "unschedule":
    body = {"start": None, "stop": None}
else:
    body = None

path = Path(__file__).resolve().parents[1] / f".local/data/xiaoai-music/{args.speaker}-worker.json"
try:
    config = json.loads(path.read_text(encoding="utf-8"))
    request = Request(f"http://127.0.0.1:{int(config['api_port'])}/local-voice",
                      data=json.dumps(body).encode() if body is not None else None,
                      headers={"Authorization": "Bearer " + config["api_token"], "Content-Type": "application/json"})
    with urlopen(request, timeout=22) as response:
        print(json.dumps(json.load(response), ensure_ascii=False, indent=2))
except HTTPError as exc:
    raise SystemExit(json.load(exc).get("error", f"监听接口返回 {exc.code}")) from None
except (URLError, FileNotFoundError):
    raise SystemExit("音箱监听服务不可用") from None
