# 修图工作台 · photo-lab

`@local/photo-lab`：会话绑定的照片批处理面板。

- Host 条目：`photo-lab`，路由 `/api/photo-lab`、`/api/photo-lab/state`、`/api/photo-lab/asset`。
- 客户端：会话顶部栏「修图」按钮 + 右侧面板（`shell.overlay`）。
- Agent 工具：`photo_lab`（status / list / sheet / update / grade / export / guide / open）。
- 数据：`~/.dsh/photo-lab/`；原照片只读，导出写入照片目录的 `_graded/`。
- 依赖：`sharp`（npm 预编译二进制，无需系统 Python/ffmpeg）。

```sh
npm install
npm run build
# plugin_manager install_bundle -> link:<绝对路径>/dsh-plugin/plugins/photo-lab
```

安装后新开会话，右上角出现「修图」。详见 [docs/DETAIL.md](docs/DETAIL.md)。
