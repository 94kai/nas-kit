# 文件预览（`@local/file-preview`）

给 DSH **原生右侧栏**的文件预览补充文件类型渲染器。当前支持音频与视频：在右侧栏打开音乐或视频文件即可直接播放，不再落到“该格式文件暂时无法预览”。后续其他文件类型（文档等）也在这个插件里继续扩展。

## 安装

```text
plugin_manager install_bundle  target: link:/绝对路径/dsh-plugin/plugins/file-preview
```

客户端插件，Host 半边只注册一个视频字节路由。装完按 DSH 返回结果处理（通常是刷新原 GUI；返回 applied 时无需重启）。不随工具箱安装，也不依赖 `dsh-better-sidebar`。

## 音频播放

- 注册扩展名：mp3、flac、m4a、m4b、aac、wav、ogg、oga、opus、weba、aif、aiff、ape、wma、wv、amr、mka、ac3、dts、dsf、dff、tta；同时声明为二进制，覆盖原生预览的“不可预览”判定。
- 交互：播放/暂停、进度拖动、前进/后退 10 秒、音量与静音、当前时间/总时长；音频读取失败或编码不支持时在卡片内提示。
- 数据：字节来自 DSH `workspaceFiles` 的整文件读取，在浏览器里转成 Blob URL 播放，组件卸载时释放。受宿主 `workspaceFiles.maxFileBytes` 限制（默认 32 MiB）；超过时由原生预览显示读取上限错误。
- 编码：浏览器本身不支持的编码（如 APE、WMA、DSF）仍会提示无法播放，本插件不做转码。

## 视频播放

- 注册扩展名：mp4、m4v、webm、ogv、mov、mkv、avi、wmv、flv、mpg、mpeg、m2ts、3gp、3g2、asf。不收录 `.ts` / `.mts`，避免把 TypeScript 源码当成视频抢走。
- 交互：使用浏览器原生视频控件（播放/暂停、进度拖动、音量、全屏、画中画、播放速度），外面是一层深色舞台和一行「容器 · 大小 · 分辨率 · 时长」信息；编码不支持时在舞台内提示并给「重新加载」。
- 数据：**不走整文件读取**。渲染器以 `renderer` 模式注册，正文自己经 Host 路由 `GET /api/file-preview/media?path=<绝对路径>&v=<版本>` 取字节。
  - Host 端用 `ctx.fs` 解析并 `readByteRange` 分块（每块 4 MiB）写响应，支持 `Range` / `HEAD` / `206` / `416`，所以几百 MB 的视频也能边下边播、拖动进度只取需要的那一段，内存占用与文件大小无关。
  - 路由挂在 DSH 已认证的 `/api` 通道上，只有 owner 主体可访问；地址带文件版本，命中当前版本时返回 `private, max-age=31536000, immutable`，版本不符则 `no-store`。
  - 客户端断开会中止后续读取；无需额外配置、不写文件、不联网。

## 已知限制

- **编码仍由浏览器决定。** 封装能识别不等于能解码：HEVC / AV1 取决于浏览器与系统解码器，AVI、MKV、WMV、FLV 通常无法播放，会显示舞台内提示。本插件不做转码。
- 音频仍是整文件读取，因此仍受 `maxFileBytes` 上限（默认 32 MiB）约束；只有视频用分块路由。
- 视频不接管侧栏的滚动位置记忆：切换 tab 后回来从 00:00 开始。

## 生命周期与兼容

通过 `ctx.inject(['documentPreviews','slots'])` 注册音频与视频两个渲染器；Host 半边 `export const inject = ['fs','connection']`，在 `ctx.effect` 里注册并随插件停用拆除。原生右侧栏未安装或未启用时客户端保持休眠，不影响客户端启动。没有定时器、监听或后台任务。

## 验证记录与限制

2026-11-26：音频版本，`node --check client.js` 通过；未做浏览器实页验收。
2026-11-27：加入视频播放与 Host 分块路由，`node --check client.js && node --check host.js` 通过；插件重载后 Host 行 active。未做浏览器实页验收。
