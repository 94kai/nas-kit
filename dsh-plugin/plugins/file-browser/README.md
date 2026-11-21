# 文件浏览 · File browser（独立插件）

`@local/file-browser`：左侧栏的全局「文件」页。以会话工作目录或主页为起点，浏览**这台机器上的任意目录**，点文件在右侧预览中打开；带面包屑、上一级、主目录、显示隐藏项和刷新。

单独成包的理由：它不依赖工具箱的任何业务、数据或入口，装到哪台 DSH 都只多一个左侧栏面板；与工具箱一起装只会连带无关 Host。

单独安装：

```sh
# plugin_manager install_bundle  target: link:/绝对路径/dsh-plugin/plugins/file-browser
```

客户端产物就是 `client.js` 本身，没有构建步骤；安装或改动后刷新浏览器页面生效。

## 目的与入口

DSH 自带的文件树以会话工作目录为根，Host 拒绝列举工作区之外的目录，预览面板里的目录树也因此到工作目录为止。本插件补的正是这一段：不把路径限制在工作区内，可以从 `/` 或主目录一路点下去。

- 左侧栏面板行：`sidebar.panellist`，id `file-browser`，标签「文件浏览」，order 20。
- 页本体：`main` keyed slot，key `file-browser`。
- 点文件：用 `ctx.sidebarRight.openResource` 在右侧栏打开内置文档预览，地址为 `dsh-resource://file/session/<sessionId>/<path>`；工作目录内的文件用相对路径，之外保留绝对路径（预览读取允许工作区外的文件，只是内置树不列它们）。没有选中会话时提示先打开会话。
- 只有文件行会打开预览；目录行进入下一层，`other`（管道、设备等）灰显不可点。

## API

Host 只有一条只读路由，挂在 DSH 连接层共享的 `/api` 通道上，走既有的同源与所有者认证，不另开端口：

`GET /api/file-browser?path=<绝对路径或 ~ 开头>&hidden=1`

返回：

```json
{
  "path": "/abs/dir",
  "parent": "/abs",
  "home": "/home/user",
  "count": 12,
  "truncated": false,
  "entries": [
    { "name": "src", "path": "/abs/dir/src", "kind": "dir", "mtimeMs": 1730000000000, "link": false },
    { "name": "a.md", "path": "/abs/dir/a.md", "kind": "file", "size": 2048, "mtimeMs": 1730000000000, "link": false }
  ]
}
```

- 空 `path` 表示主目录；相对路径拒绝（`invalid_path`）。
- 目录优先、名称按中文自然排序（忽略大小写）；一层最多 2000 项，`truncated` 标记截断。
- `kind` 为 `dir` / `file` / `other`；符号链接按目标类型归类并带 `link: true`，坏链接退化为 `other`。
- 失败返回 `{ error, message }`：`not_found`(404)、`permission_denied`(403)、`not_directory`(400)、`invalid_path`(400)、`list_failed`(500)。

没有写入、删除、重命名、上传或下载路由。响应带 `Cache-Control: no-store`。

## 权限与数据

- **读的就是本机文件系统。** 认证后的 DSH 所有者能列出这台机器上运行 DSH 的进程可读的所有目录，与 Agent 自己的文件读取权限一致。不要把 DSH 暴露给不受信任的人。
- 不读文件内容，只读目录项和 `stat` 元数据（大小、修改时间）；文件内容只在你点开右侧预览时由 DSH 自己的预览通道读取。
- 插件不保存任何业务数据；只把「上次停留的目录」和「显示隐藏项」写进当前标签页的 `sessionStorage`（`local.file-browser.view.v1`），关掉标签页即失效。
- 目录内容不进入模型请求，也不写进会话记录。

## 限制

- 只读：不能新建、删除、重命名、移动或上传。
- 一层的条目上限 2000；超大目录（例如 `node_modules`）会被截断。
- 隐藏项默认不列；打开眼睛按钮后一起显示，同样受 2000 项上限。
- 文件类型只按扩展名选图标，不代表预览一定支持该格式；预览能否渲染由 DSH 的预览器决定。
- 右侧预览需要当前有选中会话；全局面板打开时 `mainView` 仍由工作区导航持有，因此照常可用。

## 验证

- 语法：`node --check index.js`、`node --check client.js` 通过（无构建步骤）。
- Host：用假 ctx 捕获路由后直接请求，确认主目录、指定目录、`not_found`、`invalid_path` 与目录优先排序都符合上面的返回结构。
- 客户端：用最小 hook 运行时做无浏览器冒烟，跑通「加载完成」渲染（面包屑、隐藏项过滤、大小/时间格式、会话存储）并确认点文件得到的地址是 `dsh-resource://file/session/s1/README.md`（工作目录内）和 `dsh-resource://file/session/s1//opt/shared/notes.md`（工作目录外）。
- 未做浏览器实页验收：左侧栏行、页面样式、真实预览打开都还需要刷新页面后目视确认。
