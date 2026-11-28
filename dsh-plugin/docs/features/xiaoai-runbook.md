# 小爱音箱交接手册

这里记录项目归属、音箱与 NAS 的分工、部署和排查顺序。页面入口和完整业务接口见[小爱音乐与小爱控制](xiaoai.md)。

## 项目归属与运行位置

| 项目 | 跑在哪里、负责什么 |
| --- | --- |
| [idootop/open-xiaoai](https://github.com/idootop/open-xiaoai) 的 [Rust client](https://github.com/idootop/open-xiaoai/tree/main/packages/client-rust) | 跑在音箱上，主动通过局域网 WebSocket 连 NAS；接收录音、播放等 RPC。上游的[客户端入口](https://github.com/idootop/open-xiaoai/blob/main/packages/client-rust/src/bin/client.rs)和[录音实现](https://github.com/idootop/open-xiaoai/blob/main/packages/client-rust/src/services/audio/record.rs)是核对设备协议的入口。卧室已通过设备 RPC 确认为 OH2P、client 1.0.0；客厅已验证录音流，不据此推断其型号、固件或客户端版本。 |
| [94kai/XiaoAiMusic](https://github.com/94kai/XiaoAiMusic) | 原始 NAS 点歌项目，曲库搜索和播放控制的上游来源。其 Rust 目录是供 Python 使用的 **服务端**扩展，不是装在音箱上的程序；[README](https://github.com/94kai/XiaoAiMusic#运行)明确要求另装 Open‑XiaoAI client。 |
| 本仓库 `dsh-plugin` | 当前运行的 NAS 端。使用本仓库的 Python 兼容服务端与 DSH Host。XiaoAiMusic 仅是来源参考，不是当前运行依赖。 |

自定义唤醒和整句转写都跑在 NAS，不需要更改音箱上的 Open‑XiaoAI client 或固件。上游 KWS 示例并非此部署的一部分。音箱的局域网客户端和原厂语音服务是不同程序：不要把停用 NAS 录音等同于关闭原厂麦克风。

## 当前链路与改动入口

- **原厂语音**：喊「小爱同学」由原厂处理。原厂开始播报（`SpeechSynthesizer/Speak`）、接管播放或把播放状态置为 `Paused` 时，NAS 清空当前队列并取消切歌计时，不再自动续播；`Idle` 的自然播完仍按顺序切下一首，NAS 刚发起播放的 2 秒内忽略过渡暂停。原厂唤醒是否短暂压低音乐由固件决定。
- **工具箱「小爱控制」**：操作经 DSH 鉴权 Host 和目标 Python worker，由音箱端 Open‑XiaoAI 执行设备命令。`speak` 调用固件朗读，`ask` 把文字交给原厂 AI（`silent` 只关闭其语音回复）；快捷控制复用同一入口。音量用 `mediaplayer` 的 `player_set_volume`，不会主动清空或停止播放，适合只想调小声。操作都以用户选中的设备为准。
- **NAS 本地语音**：所选音箱开启监听 → NAS 通过 RPC 发 `start_recording` → 音箱按 8 声道 16 kHz 采集（ch0–5 麦克风、ch6/7 播放参考），NAS 丢掉参考声道后取麦克风平均 → NAS 检测该音箱的唤醒词（默认「理想同学」）→ 音箱播放内置提示音 → NAS 转写下一句，匹配停止、语音歌单、刷新、随机和播放关键词。命中歌曲后直接用局域网播放 URL，不调用原厂语音接口。目前没有通用问答；离线语音可调音量，失败和刷新结果用短提示音反馈。
- **播放列表**：离线点歌复用本地索引及播放队列；语音搜索结果、随机结果及语音歌单通过子进程专用管道通知 Host。Host 校验曲库路径并替换**当前音箱**保存的播放列表，更新 `voicePlaylistRevision`，页面轮询后刷新，不修改飞牛收藏或命名歌单。

| 从哪里开始查 | 对应代码 |
| --- | --- |
| UI、播放台、唤醒词、手动开关、每日时段 | [`view.js`](../../features/xiaoai/view.js) |
| Agent 与 UI 共用接口、worker 生命周期、列表持久化 | [`host.mjs`](../../features/xiaoai/host.mjs)、[`music.mjs`](../../features/xiaoai/music.mjs) |
| 音箱通信、录音帧、开始和停止录音 | [`open_xiaoai_server.py`](../../features/xiaoai/runtime/open_xiaoai_server.py)、[`local_voice.py`](../../features/xiaoai/runtime/local_voice.py) |
| 指令分派、原厂播放时被动让出、语音和定时歌单 | [`worker_bridge.py`](../../features/xiaoai/worker_bridge.py)、[`automation_runtime.py`](../../features/xiaoai/automation_runtime.py) |
| 搜索、数字/拼音兜底、NAS 切歌与播放器控制 | [`music_search.py`](../../features/xiaoai/runtime/music_search.py)、[`main.py`](../../features/xiaoai/runtime/main.py)、[`player_control.py`](../../features/xiaoai/runtime/player_control.py) |

## 本地资产与配置

以 `dsh-plugin` 为工作目录，私有根是 `.local/data/xiaoai-music/`。不要把 `.local`、模型、配置、日志或 worker token 提交、打包、回显。两台音箱分别是 `living-room`（客厅）和 `new-speaker`（卧室）。每台有自己的连接、录音状态和调度，共用模型文件但各自加载模型。

| 路径 | 内容和恢复来源 |
| --- | --- |
| `local-voice/deps/` | NAS worker 所用 Python 的独立依赖目录；当前环境为 Python 3.11，`sherpa-onnx==2.0.3`、`numpy<3`。自行迁机时用目标 worker 的 Python 安装到此目录；自定义词另需 `python-deps/` 下的 `pypinyin==0.55.0`，不装到系统 Python。 |
| `local-voice/kws-zh-en-2025-12/` | 当前使用的 [Sherpa-ONNX 中英唤醒模型](https://github.com/k2-fsa/sherpa-onnx/releases/tag/kws-models) `sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20`（chunk-16，int8 encoder/joiner）的 `tokens.txt`、`en.phone` 与 `*-epoch-13-avg-2-chunk-16-left-64.*`。`local_voice.py` 的 `KWS_DIR`/`KWS_MODEL` 指定；`local-voice/kws/` 保留旧的 `zh-wenetspeech-3.3M-2024-01-01` 可一行回退。默认词写在 `local_voice.py`；自定义词存于所选设备的 NAS 配置，由 `pypinyin` 生成带声调 token，并校验模型词表。 |
| `local-voice/asr/` | [中文小型 Paraformer](https://huggingface.co/csukuangfj/sherpa-onnx-paraformer-zh-small-2024-03-09/tree/63ddc3cd0f2810b68289a7b3876e62ef5d53d6df) 的 `model.int8.onnx` 和 `tokens.txt`。初次部署已核对模型 SHA‑256：`3ef6c19369b912f7caf3cef8e545c5ccd1a33d9d7ec792a46668dc41c4b229ec`。 |
| `local-voice/<profile-id>-settings.json` | 每台设备的唤醒词、监听状态和北京时间监听时段（星期 + 起止时间，可多条）。新设备无配置默认关闭。模型没准备好时，不启用本地语音入口。 |
| `<profile-id>-worker.json`、`<profile-id>-worker.log` | 前者由 Host 生成，含回环 API 临时 token，勿手改或回显；后者按设备记录连接、录音控制、唤醒、转写、搜索和播放，可能含真实语音文本和路径。原始音频不落盘。 |

监听开启期间，房间音频持续在可信局域网发往 NAS，NAS 只在唤醒后跑整句识别。不录音的需求应**关监听**，不是关闭网页或静音音箱。停用本地监听不影响原厂语音、网页播放和定时歌单。禁止公网转发设备 WebSocket 或音频端口；回环管理接口继续使用 worker 鉴权。不要自行修改 LAN 风险许可。

## 操作、更新与验收顺序

1. **先只读查状态。** 工具箱 → 小爱音乐 → 选设备 → 播放台 →「本地语音监听」，或在 `dsh-plugin` 下执行 `python3 scripts/xiaoai-local-voice.py --speaker living-room status`（卧室改用 `new-speaker`）。Agent 可用 `pocket_xiaoai` 的 `GET /profiles/<id>/local-voice`。`enabled` 是期望开关，`recording` 是 worker 的录音状态，`streaming` 才表示近期实际收到帧。只得到开始录音的应答不等于音频已到。
2. **控制实际录音须按用户授权。** 同一 CLI 支持 `on`、`off`、`wake-word 你好小纳`、`schedule 08:00 23:00`、`unschedule`。改词也可在页面保存；只重建所选设备的唤醒检测流，不停录音、不重启、不重新加载整句识别模型。定时例子不代表现有配置；保存时段会立即依当前时间应用，手动开关覆盖到下一个定时点。`unschedule` 会保留服务连接但清除时段并关闭录音。需要立即停录音先用 `off`，并确认 `recording` 和 `streaming` 为 `false`。
3. **按改动范围重载。** 只改 Python 可通过现有 `worker/stop` 和 `worker/start` 重启目标音箱，不动另一台。改 Host 路由或语音列表持久化才重载 `include:pocket-kit-xiaoai`，会重新连接两台；先查当前播放，不擅自中断用户正在听的音频。改前端从 `dsh-plugin` 执行 `npm run build`，只按需重载 `include:pocket-kit` 客户端载体，由用户刷新现有工具箱。不要重启整个 DSH 或启动替代服务。
4. **先确认连接，再做用户在场的真机验收。** 先读 `speakerConnected`、`streaming` 和新日志。用户喊页面显示的当前唤醒词，等提示音后说「播放老友记第二十二集」，观察当前曲、播放列表、另一台未被误操作；再喊「小爱同学，今天天气怎么样」确认仍按原厂处理。不自行发送真实播放、调音或米家指令作为验证。两台距离近时同一唤醒词可能都被听到；目前没有跨音箱仲裁，验收时分房间测试，必要时临时关另一台监听。

## 故障定位：只看目标音箱和对应时段

| 现象 | 优先检查 |
| --- | --- |
| 页面没有「本地语音监听」或状态接口不可用 | 区分客户端没刷新、Host 路由未生效、worker 未连接、NAS 模型/依赖缺失。先读状态，不重启整个系统。 |
| 开关打开但没音频 | 看 `recording` 和 `streaming`，再看目标 `worker.log` 的连接变化和录音 RPC 错误。检查按设备的 WS 和模型依赖，不盲目刷机或改防火墙。 |
| 有音频但喊不醒或提示音后没反应 | 依次找 `NAS 唤醒命中`、`NAS 离线识别`；喊完唤醒词要等提示音再说指令，避开背景播放，确认喊的是目标音箱。没听到提示音不等于模型没命中。 |
| 识别有字但没播 | 核对完整关键词、曲库命中、数字写法/拼音兜底、受控目录及播放下发日志。ASR 转写不是用户说话结束的时间点；`开始播放`只是设备调用返回附近的日志，不能证明扬声器恰在那一刻出声。 |
| 音箱播了但页面列表没更新 | 查 worker 向 Host 的专用同步管道、Host 是否保存当前设备列表、界面是否取到新 `voicePlaylistRevision`；先刷新状态再判断，不盲目重复点播。 |

本次核验：两台音箱在线且有实时音频帧；「理想同学」「理香同学」「你好小纳」均能用当前模型初始化，原厂词及其同音词被拒绝。未替用户修改实际唤醒词，未用浏览器或音箱实测新词触发。 语音提示音改为设备本机 `aplay` 播放后，已在卧室用麦克风录音确认提示音与音乐同时存在、播放器未暂停；音量绝对值与相对值均生效。客厅测试期间音量被设为 100 后整机离线，断电重启后恢复，原因未确认。之后又加入唤醒时压低音量、放宽唤醒阈值与任意未识别口令的双声反馈；唤醒模型已换成 `sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20`，用户在客厅实测「你好小纳」命中率好于旧模型；随后录音改为 8 声道并丢弃 ch6/7 参考声道，阈值降到 0.02、加权 3.5，用户反馈比之前更好，误唤醒率仍待观察。播放中断即停（暂停/原厂接管/原厂播报）已由用户真机确认。
