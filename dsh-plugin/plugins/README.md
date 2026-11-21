# 独立插件

`dsh-plugin/` 根目录是随身工具箱 `@local/pocket-kit`；这里放**不跟工具箱一起装**的独立插件。每个子目录都是一个完整安装包：各有 `package.json`、`cordis.patch.yml`、自己的构建脚本和 README，通过 DSH 插件管理单独安装、单独启停。

| 目录 | 包名 | 作用 | 安装 |
| --- | --- | --- | --- |
| `accent/` | `@local/dsh-accent` | 实例配色：主背景、侧栏、链接与发送按钮按实例换色调 | `plugin_manager install_bundle` → `link:<repo>/dsh-plugin/plugins/accent` |
| `aside-note/` | `@local/aside-note` | 旁边记：会话/工作区便笺，数据存服务端 | 先 `npm run build`，再 `install_bundle` → `link:<repo>/dsh-plugin/plugins/aside-note` |

## 什么该放进来

- 要在多台设备上各自启用/停用，或不想连带装箱子全部 Host 的功能。
- 跟工具箱业务无关的界面外观类插件，例如配色。
- 已经稳定、生命周期独立、拆出去不增加维护负担的功能。

只在一台机器上用、和工具箱其他功能共享入口或数据的功能，继续留在工具箱的 `features/` 里——拆包不等于更清晰。

## 约定

- 独立包的目录深度与工具箱的 feature 一致（`plugins/<name>/store.js` 对应原来的 `features/<name>/store.js`），`.local/` 数据路径因此不变，迁移时不需要搬数据；改造已有功能时要先确认这一点。
- 根工具箱的 `package.json` 导出、`files` 清单和 `scripts/build.mjs` 都不包含 `plugins/`，装工具箱不会带回这些插件。
- 新增独立包时：建目录 → 写 `package.json`（`dsh.bundle.patch`、必要的 `dsh.client`）→ 写 `cordis.patch.yml` → 写 README → 用插件管理安装；同时更新本表和 `dsh-plugin/AGENTS.md` 索引。
