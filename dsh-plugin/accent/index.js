/**
 * 实例配色：在页面 index 响应里注入一段高特异度 CSS，按实例配置替换五个主题 token。
 * 只动主背景、侧栏/标题行的淡底和强调色，文字与状态色保持 DSH 原样；浅色、深色各一组值，
 * 跟随 DSH 的明暗切换自动生效，不需要客户端脚本。
 */

/** 可选配色。每项：强调色、悬停色、侧栏底、主背景，均为 [浅色, 深色]。 */
const ACCENTS = {
  // 玫瑰粉：中性的粉调，明确但不甜腻（默认）
  rose: {
    accent: ['#82354f', '#db94ac'],
    hover: ['#702e44', '#d47d9a'],
    sidebar: ['#f0d8e0', '#321b23'],
    base: ['#f9f0f3', '#1e1015'],
  },
  // 苔绿：温润的灰绿，最安静的一档
  moss: {
    accent: ['#347960', '#93c0af'],
    hover: ['#2c6852', '#80b4a1'],
    sidebar: ['#e7f1ed', '#1a2d26'],
    base: ['#f6fbf9', '#101d18'],
  },
  // 雾青：偏冷的青灰，和默认的蓝区分得开
  sea: {
    accent: ['#316e7d', '#93b7c0'],
    hover: ['#295d6a', '#80aab4'],
    sidebar: ['#e7eff1', '#1a292d'],
    base: ['#f6fafb', '#101a1d'],
  },
  // 青灰：安静的靛蓝，颜色最深、最沉
  slate: {
    accent: ['#373a7b', '#989ac0'],
    hover: ['#2f316a', '#8587b4'],
    sidebar: ['#e7e7f1', '#1a1b2d'],
    base: ['#f6f6fb', '#10111d'],
  },
  // 陶土：偏暖的赭石，浅色下像旧纸
  clay: {
    accent: ['#864e32', '#c7a797'],
    hover: ['#73432b', '#bc9683'],
    sidebar: ['#f1eae7', '#2d211a'],
    base: ['#fbf8f6', '#1d1410'],
  },
  // 灰紫：低饱和的藕紫，深色下最柔和
  plum: {
    accent: ['#7b3d76', '#c398bf'],
    hover: ['#6a3465', '#b785b3'],
    sidebar: ['#f1e7f0', '#2d1a2b'],
    base: ['#fbf6fa', '#1d101c'],
  },
};

const DEFAULT_ACCENT = 'rose';

/** 深层 token 引用：选择器比主题样式表的 body 规则更具体，晚注入的调色板也压不掉。 */
function paletteCss({ accent, hover, sidebar, base }) {
  const declare = (mode) => [
    `--dsw-alias-bg-base:${base[mode]}`,
    `--dsw-specific-sidebar-fill:${sidebar[mode]}`,
    `--dsw-alias-state-business-primary:${accent[mode]}`,
    `--dsw-alias-button-info-fill:${accent[mode]}`,
    `--dsw-alias-button-info-hover:${hover[mode]}`,
  ].join(';');
  return `html body{${declare(0)}}html body[data-ds-dark-theme]{${declare(1)}}`;
}

/**
 * 注册 index 注入；配置在行上（每个实例的 profile 补丁可以各不相同）。
 * @param ctx Host 插件上下文。
 * @param config 行配置；`accent` 取 ACCENTS 的键。
 */
export function apply(ctx, config) {
  const asked = config !== null && typeof config === 'object' && typeof config.accent === 'string'
    ? config.accent.trim()
    : '';
  if (asked !== '' && ACCENTS[asked] === undefined) {
    ctx.logger?.warn?.(`dsh-accent: 没有 "${asked}" 这套配色，改用 ${DEFAULT_ACCENT}；可选：${Object.keys(ACCENTS).join('、')}`);
  }
  const css = paletteCss(ACCENTS[asked] ?? ACCENTS[DEFAULT_ACCENT]);
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'style', text: css });
  });
}
