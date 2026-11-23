# 实例配色 · Instance accent

给不同的 DSH 实例各配一种低调的识别色，再在输入卡上挂一个设备名/首字母标记，多开窗口时一眼分清自己在哪一台。配色只覆盖六个主题 token，背景、文字和状态色保持 DSH 原样；浅色、深色主题各有一组值，跟着 DSH 的明暗切换自动生效。手机上看不到侧栏和标签页，标记就落在最常看的输入卡上。

## 观感

- **主内容区**：整页淡淡的同色底（浅色约 `#f9f0f3`，深色约 `#1e1015`），占面积最大，白卡片浮在上面。
- **侧栏与标题行**：再深一档的同色底（浅色约 `#f0d8e0`，深色约 `#321b23`），和主区分得开。
- **输入框**：比主背景更实一档（浅色 `#f4e3e9`，深色 `#362329`），输入区不再是一片白。
- **链接、选中态、焦点环**：同色系的灰调，不再用默认的蓝。
- **发送按钮**：填充换成同色，悬停略深。
- 灰阶、边框、正文和错误/警告/成功等状态色不动，所以不会显得花。

## 配色

| 名称 | 观感 | 浅色强调 | 深色强调 | 浅色主背景 | 深色主背景 | 浅色侧栏 | 深色侧栏 | 浅色输入 | 深色输入 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `rose` | 玫瑰粉，中性粉调（默认） | `#82354f` | `#db94ac` | `#f9f0f3` | `#1e1015` | `#f0d8e0` | `#321b23` | `#f4e3e9` | `#362329` |
| `moss` | 苔绿，温润的灰绿 | `#347960` | `#93c0af` | `#f6fbf9` | `#101d18` | `#e7f1ed` | `#1a2d26` | `#e3f4ee` | `#23362f` |
| `sea` | 雾青，偏冷的青灰 | `#316e7d` | `#93b7c0` | `#f6fafb` | `#101a1d` | `#e7eff1` | `#1a292d` | `#e3f1f4` | `#233336` |
| `slate` | 青灰，安静的靛蓝 | `#373a7b` | `#989ac0` | `#f6f6fb` | `#10111d` | `#e7e7f1` | `#1a1b2d` | `#e3e4f4` | `#232336` |
| `clay` | 陶土，偏暖的赭石 | `#864e32` | `#c7a797` | `#fbf8f6` | `#1d1410` | `#f1eae7` | `#2d211a` | `#f4e9e3` | `#362923` |
| `plum` | 灰紫，低饱和的藕紫 | `#7b3d76` | `#c398bf` | `#fbf6fa` | `#1d101c` | `#f1e7f0` | `#2d1a2b` | `#f4e3f3` | `#362335` |

同一个包可以装在多台实例上，颜色写在各自 profile 的补丁里，所以每台可以不一样。

## 配置

安装后默认 `rose`。改某个实例的颜色，在它的 profile 补丁（`$DSH_HOME/profiles/<profile>/cordis.patch.yml`）里加一条同 id 覆盖，写全 `config`：

```yaml
- id: dsh-accent
  name: '@local/dsh-accent'
  config:
    accent: sea
```

匹配 id 的条目会整体替换 `config`，改完刷新页面即可。未知配色会退回 `rose`，并在 Host 日志里提示可选值。

也可以直接在 GUI 里换：**设置 → 通用 → 实例配色**，点色块立刻生效，选择存在当前浏览器的 `localStorage`（`dsh-accent.choice`）。点「跟随配置」回到 profile 里的 `accent`；点「原版」则不套任何识别色，回到 DSH 自带配色（等于配置里写 `accent: none`），设备名胶囊仍然保留、自动改成中性灰（用正文色 `--dsw-alias-label-primary`，不再跟主题里那个偏蓝的强调色走）。浏览器里的选择优先于配置——它写在 body 的内联 token 上，或者直接把 head 里那段配色样式表禁用掉。

两处色值需要同步：`index.js` 的 `ACCENTS` 是 Host 注入的默认配色，`client.js` 的 `ACCENTS` 供设置面板即时切换。改配色时两个文件一起改。

## 设备标识

颜色记不住谁是谁时，加一个能读出来的标记：

- **标签**：输入卡左上角一枚 18px 高的胶囊，一半压在卡片上边框上；左边缘与附件缩略图对齐（都从卡片内 10px 起）。宽度跟着文字走，一个字母是一枚小圆牌，三个汉字是一条 45px 左右的胶囊。
- **侧栏品牌**：左上角品牌行里自带的 `deepseek HARNESS` wordmark 会被隐藏，换成同款设备名胶囊，只留小鲸鱼 logo；名字为空时不显示。
- **呼吸感**：卡片的上边距从 8px 加厚到 12px，附件和文字整体下移，胶囊底部到内容之间留出约 3px，不会一进来就贴着缩略图。

```yaml
- id: dsh-accent
  name: '@local/dsh-accent'
  config:
    device:
      name: 开发机
```

`name` 是名牌上的字；想换成更短的首字母或 emoji 就单独写 `mark`。名字别太长，三到四个汉字或三个字母最合适。不写 `device` 就只有配色，行为和旧版一致。

三台机器可以这样分：`NAS`、`主力机`、`开发机`。

不想改配置文件也行：**设置 → 通用 → 设备名** 里直接写，保存后胶囊立刻变。这个值存在本实例的 `.local/data/accent/device.json`，优先级高于 profile 里的 `device.name`；提交请求的是 Host 的 `/api/dsh-accent` 接口，读写都不碰 DSH 本体。清空并保存就把胶囊隐藏。

## 实现

Host 半边监听 `webserver/index-inject`，在页面 `<head>` 里注入一段 `html body{…}` 的样式声明，覆盖六个 token：

| token | 作用 |
| --- | --- |
| `--dsw-alias-bg-base` | 主内容区（整页）底色 |
| `--dsw-specific-sidebar-fill` | 侧栏列与标题行底色 |
| `--dsw-specific-input-major` | 输入框、附件卡等输入区表面 |
| `--dsw-alias-state-business-primary` | 链接、选中态、焦点环 |
| `--dsw-alias-button-info-fill` / `-hover` | 发送按钮与信息按钮 |

选择器比主题样式表的 `body` 规则更具体，所以客户端后注入的调色板压不掉它；深色模式走 `html body[data-ds-dark-theme]`。没有客户端脚本参与默认配色，首屏就是目标色，不会先闪一下默认配色；只有在设置里手动选过颜色时，浏览器才会用 `ctx.theme` 叠一层覆盖。

配色和设备名分成两段 `<style>` 注入，各带注释标记；「原版」按标记找到配色那段把 `sheet.disabled` 置真，不会连带关掉胶囊。

设置页那行通过 Host 注册的 `/api/dsh-accent`（`connection.fetch.register`，同源鉴权）读写设备名，写进 `.local/data/accent/device.json`；每次页面请求时按「文件里的值 → profile 配置」的优先级现算 CSS，所以改完刷新就生效。

`device` 走同一段注入：在 `[data-composer-card]`（输入卡）上用 `::after` 画名牌胶囊，文字经 `--dsh-device-mark` 传进去；再用 `html body [data-composer-card]` 把卡片上边距从 8px 提到 12px（选择器压过宿主的 `.card` 规则）。胶囊高度、圆角、字号都是固定的，宽度由文字撑开。

## 安装

用 DSH 插件管理安装，指向包目录本身（link 安装，改代码后重载条目即可）：

```
plugin_manager install_bundle  target: link:/绝对路径/dsh-plugin/accent
```

装完看插件列表里的「实例配色」是否 active，再刷新原 GUI 确认侧栏底色。

## 边界

- 只认 `accent` 与 `device` 配置，不判断地址、账号或实例名；同名多开不会互相干扰。
- 依赖 DSH 的 `webserver/index-inject` 事件、上面六个 `--dsw-*` token 名和输入卡的 `[data-composer-card]` 标记。DSH 大版本改了这些之后需要重新确认；届时颜色会静默退回默认、名牌会消失，都不会影响启动和输入。
- 只改颜色和输入卡上的两个伪元素，不碰字号、字体、主题偏好和其它插件。
