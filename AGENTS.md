# nas-kit 仓库索引

本仓库把两个**相互独立**的个人项目放在同一套 Git 历史和工作区里，便于一起阅读、提交和维护。合并的只是代码仓库，不是运行环境。

| 目录 | 项目 | 是什么 | 怎么运行 |
| --- | --- | --- | --- |
| [`dsh-plugin/`](dsh-plugin/) | 随身工具箱 · Pocket Kit（`@local/pocket-kit`） | DSH 插件。按功能分模块的个人工具包：进京证、健康、终端、记账单、音乐、小爱音箱、旁边记、快捷访问等，界面在现有 DSH GUI 的「工具箱」里。 | 构建后以 `link:` 方式安装进 DSH 的 `web` profile；不单独监听端口，不替代 DSH 服务。 |
| [`fn-aio/`](fn-aio/) | FN AIO（`fn-aio`） | 飞牛（fnOS）上的独立 App 与私有服务网关：经飞牛登录管理 NAS 自建 HTTP 服务，可选对外业务入口。不是 DSH 插件。 | 构建 FPK 后在飞牛应用中心安装，由飞牛运行；不依赖、不启动、不迁移 DSH 或业务服务。 |

## 先读哪个文件

- 改工具箱：本文件 → [`dsh-plugin/AGENTS.md`](dsh-plugin/AGENTS.md) → 对应的 `dsh-plugin/docs/`。
- 改 FN AIO：本文件 → [`fn-aio/AGENTS.md`](fn-aio/AGENTS.md) → [`fn-aio/README.md`](fn-aio/README.md) 与 `fn-aio/docs/`。
- 子项目的 `AGENTS.md` 和文档是第一手规范；本文件只做导航，不覆盖它们的约束。

## 边界

- 两个子项目不得互相依赖、导入、启动或修改对方的代码与配置。共用仓库不等于共用运行时，也不构成拆包、合并安装包或共享数据的理由。
- 一次任务默认只改一个子项目；需要跨项目改动时先说明范围并取得同意。
- 私有数据、凭据、构建产物分别放在各子项目的 `.local/`，已被 Git 忽略；不得写入文档、提交或发布包。
- 不因本仓库合并而修改 DSH 宿主、飞牛 Nginx/Lucky、PM2 进程或其他旁路服务；宿主与设备侧的操作仍按子项目文档的授权和风险说明执行。

## 本机路径

- 仓库根目录：`/home/xuekai/project/nas-kit/`
- 工具箱源码与 DSH `link:` 安装目标：`/home/xuekai/project/nas-kit/dsh-plugin/`
- 工具箱私有运行数据：`/home/xuekai/project/nas-kit/dsh-plugin/.local/`
- 进京证凭据配置：`/home/xuekai/project/nas-kit/dsh-plugin/.local/data/beijing-pass/config.json`
- FN AIO 本机构建策略：`/home/xuekai/project/nas-kit/fn-aio/.local/gateway.json`
- 兼容软链：`/home/xuekai/project/dsh-plugin/` 与 `/home/xuekai/project/fn-aio/` 指向 `nas-kit/` 下的对应子目录，供 DSH 工作区与 PM2 等旧引用继续使用；不要把软链当独立仓库开发，也不要在未经用户确认时删除。

## 常用命令

```sh
# 工具箱：构建、语法检查和测试
cd dsh-plugin && npm run verify

# FN AIO：语法检查和测试
cd fn-aio && npm run verify

# FN AIO：用本机策略构建 FPK
cd fn-aio && npm run build -- /home/xuekai/project/nas-kit/fn-aio/.local/gateway.json
```

Android APK 构建、FPK 安装、DSH 插件重载等操作分别见 [`dsh-plugin/README.md`](dsh-plugin/README.md)、[`fn-aio/docs/android.md`](fn-aio/docs/android.md) 和 [`fn-aio/README.md`](fn-aio/README.md)。

## Git

- 两个上游仓库的提交历史已完整合入本仓库，分别位于 `dsh-plugin/` 和 `fn-aio/` 子目录；单文件回溯历史用 `git log --follow -- <文件>`。
- 合并前的上游为 `git@github.com:94kai/dsh-plugin.git`（`master`）和 `git@github.com:94kai/fn-aio.git`（`main`）。
- 远端为 `git@github.com:94kai/nas-kit.git`（`origin`），`main` 已跟踪 `origin/main`；两个旧上游地址只作历史参考，不要强推。
- 本文件是仓库级导航；修改任一子项目的行为、安全边界或配置结构时，同步更新该项目自己的 README、文档和 `AGENTS.md`。
