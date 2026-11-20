/**
 * 实例配色：在页面 index 响应里注入一段高特异度 CSS，按实例配置替换四个主题 token。
 * 只动侧栏/标题行的淡底和强调色，背景、文字与状态色保持 DSH 原样；浅色、深色各一组值，
 * 跟随 DSH 的明暗切换自动生效，不需要客户端脚本。
 */

/** 可选配色。每项：强调色、悬停色、侧栏底，均为 [浅色, 深色]。 */
const ACCENTS = {
  // 苔绿：温润的灰绿，最不扎眼的一档
  moss: { accent: ['#446f5d', '#98bbac'], hover: ['#3a5f50', '#86ae9e'], sidebar: ['#f4f7f6', '#1a211e'] },
  // 雾青：偏冷的青灰，和默认的蓝区分得开
  sea: { accent: ['#406a72', '#98b5bb'], hover: ['#375b62', '#86a8ae'], sidebar: ['#f4f6f7', '#1a2021'] },
  // 青灰：安静的靛灰，接近原来的中性观感
  slate: { accent: ['#424670', '#9c9ebd'], hover: ['#393c60', '#898cb0'], sidebar: ['#f4f4f7', '#1a1a21'] },
  // 陶土：偏暖的赭石，浅色下像旧纸
  clay: { accent: ['#775440', '#c2aa9b'], hover: ['#674937', '#b69988'], sidebar: ['#f7f5f4', '#211c1a'] },
  // 灰紫：低饱和的藕紫，深色下最柔和
  plum: { accent: ['#734a73', '#bda0bd'], hover: ['#644064', '#b18eb1'], sidebar: ['#f7f4f7', '#211a21'] },
};

const DEFAULT_ACCENT = 'moss';

/** 深层 token 引用：选择器比主题样式表的 body 规则更具体，晚注入的调色板也压不掉。 */
function paletteCss({ accent, hover, sidebar }) {
  const declare = (mode) => [
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
