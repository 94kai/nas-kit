# 实例配色 · Instance accent

给不同的 DSH 实例各配一种低调的识别色，多开窗口时一眼分清自己在哪一台。只覆盖四个主题 token，背景、文字和状态色保持 DSH 原样；浅色、深色主题各有一组值，跟着 DSH 的明暗切换自动生效。

## 观感

- **侧栏与标题行**：极淡的同色底（浅色约 `#f4f7f6`，深色约 `#1a211e`），面积最大也最安静。
- **链接、选中态、焦点环**：同色系的灰调，不再用默认的蓝。
- **发送按钮**：填充换成同色，悬停略深。
- 灰阶、边框、正文和错误/警告/成功等状态色不动，所以不会显得花。

## 配色

| 名称 | 观感 | 浅色强调 | 深色强调 |
| --- | --- | --- | --- |
| `moss` | 苔绿，温润的灰绿（默认） | `#446f5d` | `#98bbac` |
| `sea` | 雾青，偏冷的青灰 | `#406a72` | `#98b5bb` |
| `slate` | 青灰，安静的靛灰 | `#424670` | `#9c9ebd` |
| `clay` | 陶土，偏暖的赭石 | `#775440` | `#c2aa9b` |
| `plum` | 灰紫，低饱和的藕紫 | `#734a73` | `#bda0bd` |

同一个包可以装在多台实例上，颜色写在各自 profile 的补丁里，所以每台可以不一样。

## 配置

安装后默认 `moss`。改某个实例的颜色，在它的 profile 补丁（`$DSH_HOME/profiles/<profile>/cordis.patch.yml`）里加一条同 id 覆盖，写全 `config`：

```yaml
- id: dsh-accent
  name: '@local/dsh-accent'
  config:
    accent: sea
```

匹配 id 的条目会整体替换 `config`，改完刷新页面即可。未知配色会退回 `moss`，并在 Host 日志里提示可选值。

## 实现

Host 半边监听 `webserver/index-inject`，在页面 `<head>` 里注入一段 `html body{…}` 的样式声明，覆盖四个 token：

| token | 作用 |
| --- | --- |
| `--dsw-specific-sidebar-fill` | 侧栏列与标题行底色 |
| `--dsw-alias-state-business-primary` | 链接、选中态、焦点环 |
| `--dsw-alias-button-info-fill` / `-hover` | 发送按钮与信息按钮 |

选择器比主题样式表的 `body` 规则更具体，所以客户端后注入的调色板压不掉它；深色模式走 `html body[data-ds-dark-theme]`。没有客户端脚本，首屏就是目标色，不会先闪一下默认配色。

## 安装

用 DSH 插件管理安装，指向包目录本身（link 安装，改代码后重载条目即可）：

```
plugin_manager install_bundle  target: link:/绝对路径/dsh-plugin/accent
```

装完看插件列表里的「实例配色」是否 active，再刷新原 GUI 确认侧栏底色。

## 边界

- 只认 `accent` 配置，不判断地址、账号或实例名；同名多开不会互相干扰。
- 依赖 DSH 的 `webserver/index-inject` 事件与上面四个 `--dsw-*` token 名。DSH 大版本改了 token 命名后需要重新确认；届时颜色会静默退回默认，不会影响启动。
- 只改颜色，不碰字号、字体、主题偏好和其它插件。
