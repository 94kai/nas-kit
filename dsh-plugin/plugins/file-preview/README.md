# 文件预览（`@local/file-preview`）

给 DSH **原生右侧栏**的文件预览补充文件类型渲染器。当前支持音频：在右侧栏打开音乐文件即可直接播放，不再落到“该格式文件暂时无法预览”。后续其他文件类型（视频、文档等）也在这个插件里继续扩展。

## 安装

```text
plugin_manager install_bundle  target: link:/绝对路径/dsh-plugin/plugins/file-preview
```

客户端插件，Host 只是让包被组合进来的空载体。装完按 DSH 返回结果处理（通常是刷新原 GUI；返回 applied 时无需重启）。不随工具箱安装，也不依赖 `dsh-better-sidebar`。

## 当前能力：音频播放

- 注册扩展名：mp3、flac、m4a、m4b、aac、wav、ogg、oga、opus、weba、aif、aiff、ape、wma、wv、amr、mka、ac3、dts、dsf、dff、tta；同时声明为二进制，覆盖原生预览的“不可预览”判定。
- 交互：播放/暂停、进度拖动、前进/后退 10 秒、音量与静音、当前时间/总时长；音频读取失败或编码不支持时在卡片内提示。
- 数据：不注册 Host 路由、不写文件、不联网。字节来自 DSH `workspaceFiles` 的整文件读取，在浏览器里转成 Blob URL 播放，组件卸载时释放。
- 上限：整文件读取受宿主 `workspaceFiles.maxFileBytes` 限制（默认 32 MiB）；超过时由原生预览显示读取上限错误。
- 编码：浏览器本身不支持的编码（如 APE、WMA、DSF）仍会提示无法播放，本插件不做转码。

## 生命周期与兼容

通过 `ctx.inject(['documentPreviews','slots'])` 注册；原生右侧栏未安装或未启用时保持休眠，不影响客户端启动。注册项与 slot 都由 `ctx.effect` 跟随插件停用清理。没有定时器、监听或后台任务。

## 验证记录与限制

2026-11-26：`node --check client.js` 通过；尚未做浏览器实页验收（没有主动开浏览器）。本机 profile 原先没有安装工具箱，所以最初放进工具箱的组件不会加载；这就是改为独立插件的原因。
