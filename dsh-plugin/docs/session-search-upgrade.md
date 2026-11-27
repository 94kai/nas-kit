# 会话搜索：中文检索宿主补丁与升级适配手册

## 先看结论与边界

这是本机对 **DSH 宿主产物**的兼容补丁，**不是 DSH 正式扩展 API**。用户于 2026-11-27 要求「把中文分词一下」并接受"升级后需要重新适配"，随后要求把改动整理进本仓库。升级可能覆盖宿主补丁；不自动重打、不保证新版兼容；**升级后的适配只在用户主动提出时进行**。

- 补丁脚本：[patch.mjs](../features/session-search/patch.mjs)。只处理 `@deepseek-ai/dsh-session-query-sqlite/lib/index.js`，不改权限、存储格式、事件语义，不读写会话内容以外的数据。
- 另有一处 **profile 配置**（不在 npx 目录，升级不丢），见下文「改动明细」第 1 项。
- 索引文件是**派生数据**，升级后必须删库重建，否则切分形态与未打补丁的查询对不上。
- 缺补丁/缺配置时表现是**能力降级**而非崩溃：正文搜不到或退回"整段连续汉字才命中"。不因此自动适配或自动重启。

## 背景：为什么需要

侧边栏搜索"搜不到所有会话记录"有两层根因：

1. **正文检索默认关闭**。`dsh-web-app` 层把 `session-query-sqlite` 配成 `openAt: never` + `path: ':memory:'`，`sessions.search` 直接抛 `SESSION_QUERY_SEARCH_DISABLED`，前端 catch 后显示为「没有匹配」。此时只有会话标题、工作区名、会话 id 能命中（浏览器内存索引）。
2. **中文分词不可用**。打开后走 SQLite FTS5 + `tokenize='unicode61'`，连续汉字被当成**一个 token**，查询又被 `quoteFtsData()` 整体加引号成短语，token 级精确匹配下中文子串必然失败：

   | 正文 | 查询 | 结果 |
   |---|---|---|
   | `今天你好吗` | `今天` / `你好` / `好吗` | 0 命中 |
   | `今天你好吗` | `今天你好吗` | 命中 |

   英文单词、代码标识符、路径不受影响。

**未采用的方案**（避免以后重复讨论）：

- 精简索引（只索引用户消息与模型回复正文）：实测索引文本 1529 万 → 143 万字符、索引约 4MB，但助手侧文档从 4483 条掉到 429 条（多数助手消息是纯工具调用、无正文），且会让 agent 侧历史检索失去工具输出。**已回滚**。
- 官方 `@deepseek-ai/dsh-experimental-session-search`（`session_search` 等 5 个 agent 侧只读工具）：用户 dismiss，**未启用**。
- 换 trigram 分词器：要求查询 ≥3 字符，两字中文词反而搜不到，否决。

## 改动明细（本机 2026-11-27）

### 1. profile 配置（持久，升级保留）

`~/.dsh/profiles/web/cordis.patch.yml` 末尾：

```yaml
- id: session-query-sqlite
  name: "@deepseek-ai/dsh-session-query-sqlite"
  config:
    path: /home/xuekai.xk/.dsh/storages/session-search.sqlite
    openAt: first-search
```

patch 会**整段替换**目标行 `config`，所以 `path` 必须重写；`first-search` 表示首次搜索才加载 `node:sqlite` 并建索引，不拖慢启动。

### 2. 宿主产物补丁（升级丢失）

`lib/index.js` 共 4 处：新增 `segmentCjk()`（Han / Hiragana / Katakana / Hangul 按字拆）、`normalizeQuery()` 套用它、两处建索引（`persisted_docs` / `live_docs`）套用它、`makeSnippet()` 输出时去掉切分空格。索引与查询必须用同一切法，否则互相都对不上。

### 3. 派生数据

`~/.dsh/storages/session-search.sqlite{,-wal,-shm}`：首次搜索自动重建；完整口径约 27MB、15,291 条文档、1,535 万字符（汉字 6%）。

## 升级后操作顺序

### 1. 确认真正运行的新版路径

以当前会话 runtime context、DSH 启动入口和实际包解析结果为准（`pgrep -af "dsh web"`）。npm/npx 升级会换 `_npx/<hash>` 目录，**不要照抄本文历史路径，也不要修改所有搜索命中的副本**。

验证目标：`<install>/node_modules/@deepseek-ai/dsh-session-query-sqlite/package.json` 的 `name` 匹配、记录 `version`。本机记录：`0.2.3-alpha.2`。

### 2. 只检查，不写入

```bash
INSTALL='/已确认的新版安装目录'   # 含 node_modules 的那一级
node features/session-search/patch.mjs "${INSTALL:?}" --check
```

- `already current`：补丁已在磁盘，不重复写；仍需实页确认浏览器用的是它。
- `compatible, change planned`：锚点精确匹配，打印目标路径；**不是已应用**。
- `Unsupported…` / 语法错误：停止。重新读新版上下文，保持四处改动的位置与语义，不要盲套旧补丁或整文件覆盖。

### 3. 应用与备份

先删旧索引，再打补丁（顺序很重要，避免"新代码 + 旧切分索引"的混合状态）：

```bash
rm -f ~/.dsh/storages/session-search.sqlite{,-wal,-shm}
node features/session-search/patch.mjs "${INSTALL:?}" --apply
```

`--apply` 先通过语法校验，再把**修改前**的原文按 SHA256 存到本仓库 `.local/session-search-patch/`（600/700），并写出 `manifest-<时间戳>.json`（安装路径、包版本、文件名、前后 SHA256）。记下控制台打印的 manifest 路径。重复应用不会重复备份。

### 4. 重启与验证

```bash
sudo systemd-run --unit=dsh-restart-web --collect /home/xuekai.xk/.dsh/restart-web.sh
cat ~/.dsh/last-web-url.txt   # 每次启动 token 都会变
```

重启必须在 `dsh.service` cgroup 之外执行（在会话内直接 `systemctl restart` 会连执行者一起杀掉）。

验证（缺一不可）：

1. 侧边栏搜「会话记录」「上下文压缩」等两字以上中文词**能命中**，摘要里**没有**「会 话 记 录」这种空格；
2. 搜 `session-query`、`openAt` 等英文/代码词命中变化不大；
3. 首次搜索耗时 2.5–4 秒（全量建索引），之后毫秒级；
4. `~/.dsh/storages/session-search.sqlite` 重新出现；如需取证，直接只读打开统计文档类型分布。

### 5. 回滚（只回到本次修改前）

```bash
node features/session-search/patch.mjs "${INSTALL:?}" --rollback '/绝对路径/.local/session-search-patch/manifest-本次时间戳.json'
rm -f ~/.dsh/storages/session-search.sqlite{,-wal,-shm}
```

脚本先校验安装路径、包版本、备份 hash 与当前内容 hash，全部通过才恢复；任何不符都拒绝，需先调查，不能关掉保护硬写。**已升级宿主时不要用旧 manifest 回滚新版。**

只想关掉正文检索、保留切分补丁：把 profile 配置里的 `openAt` 改回 `never`（或删掉那段 YAML），删索引，重启。

## 已知限制

- 侧边栏正文检索在 API 层只查 `user/message` + `assistant/message`；工具输出、思考、todo 不进结果。这是上游行为，未改。
- 结果上限 **20** 条，超出提示换更精确的词；排序为 `match_count` DESC → `document_length` ASC → `time` DESC，每会话只取最好的一条消息，客户端把标题命中整体排在正文命中之前。
- 单字查询变高频词（「的」「是」几乎命中全部会话）；两字以上是相邻短语匹配，精度好。
- SQLite 调用是同步的，高频词的查询会短暂阻塞宿主事件循环（实测 0.7–230ms）。
- 摘要回显去掉了切分空格；若原文汉字间本来就有空格，展示时会被一起吃点（仅影响摘要文本）。
- profile 配置依赖 row id `session-query-sqlite` 与 `path`/`openAt` 的 schema；上游改名或改 schema 需按新版调整，`--dump-config` 自检最快。

## 实测数据（改造前后，同一份语料）

| 指标 | 改造前 | 改造后 |
|---|---|---|
| 索引 | 26.2 MB | 27.1 MB（+3%，汉字仅占 6%） |
| FTS 建索引（1535 万字） | 565 ms | 759 ms |
| 查询耗时 | 0.1–0.3 ms | 0.1–0.3 ms |
| 命中「会话记录」 | 3 | 26 |
| 命中「搜索」 | 15 | 150 |
| 命中「上下文压缩」 | 0 | 2 |
| 命中 `session` / `sqlite` | 1066 / 135 | 不变 |

## 2026-11-27 实施记录

- 应用方式：先用一次性脚本改宿主产物，后收进本仓库并**按仓库脚本重新应用**（先还原原始文件，再 `--apply`），当前 manifest：`.local/session-search-patch/manifest-1795771175883.json`。
- 本次安装路径：`/data00/home/xuekai.xk/.npm/_npx/02df0ac723a71fb9`，包版本 `0.2.3-alpha.2`；补丁后 sha256 `6cae0ac8…a4a4d`。
- 重启：`dsh.service` 于 17:13:50 重启完成，HTTPS 校验通过。
- 索引：按"删旧库 → 首次搜索重建"执行；删库后到重建前不提供服务，属预期降级。
- 验证边界：脚本 `--check`、语法校验、manifest 与 hash 均已核对；中文命中的**实页验收**仍需在 GUI 里搜一次确认（本轮由用户操作）。
