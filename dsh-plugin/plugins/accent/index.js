import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 实例配色：在页面 index 响应里注入一段高特异度 CSS，按实例配置替换五个主题 token。
 * 只动主背景、侧栏/标题行的淡底和强调色，文字与状态色保持 DSH 原样；浅色、深色各一组值，
 * 跟随 DSH 的明暗切换自动生效，不需要客户端脚本。
 */

/** 可选配色。每项：强调色、悬停色、侧栏底、主背景、输入框，均为 [浅色, 深色]。 */
const ACCENTS = {
  // 玫瑰粉：中性的粉调，输入框比主背景再深一档（默认）
  rose: {
    accent: ['#82354f', '#db94ac'],
    hover: ['#702e44', '#d47d9a'],
    sidebar: ['#f0d8e0', '#321b23'],
    base: ['#f9f0f3', '#1e1015'],
    input: ['#f4e3e9', '#362329'],
  },
  // 苔绿：温润的灰绿，最安静的一档
  moss: {
    accent: ['#347960', '#93c0af'],
    hover: ['#2c6852', '#80b4a1'],
    sidebar: ['#e7f1ed', '#1a2d26'],
    base: ['#f6fbf9', '#101d18'],
    input: ['#e3f4ee', '#23362f'],
  },
  // 雾青：偏冷的青灰，和默认的蓝区分得开
  sea: {
    accent: ['#316e7d', '#93b7c0'],
    hover: ['#295d6a', '#80aab4'],
    sidebar: ['#e7eff1', '#1a292d'],
    base: ['#f6fafb', '#101a1d'],
    input: ['#e3f1f4', '#233336'],
  },
  // 青灰：安静的靛蓝，颜色最深、最沉
  slate: {
    accent: ['#373a7b', '#989ac0'],
    hover: ['#2f316a', '#8587b4'],
    sidebar: ['#e7e7f1', '#1a1b2d'],
    base: ['#f6f6fb', '#10111d'],
    input: ['#e3e4f4', '#232336'],
  },
  // 陶土：偏暖的赭石，浅色下像旧纸
  clay: {
    accent: ['#864e32', '#c7a797'],
    hover: ['#73432b', '#bc9683'],
    sidebar: ['#f1eae7', '#2d211a'],
    base: ['#fbf8f6', '#1d1410'],
    input: ['#f4e9e3', '#362923'],
  },
  // 灰紫：低饱和的藕紫，深色下最柔和
  plum: {
    accent: ['#7b3d76', '#c398bf'],
    hover: ['#6a3465', '#b785b3'],
    sidebar: ['#f1e7f0', '#2d1a2b'],
    base: ['#fbf6fa', '#1d101c'],
    input: ['#f4e3f3', '#362335'],
  },
};

const DEFAULT_ACCENT = 'rose';
/** 关掉识别色、回到 DSH 原版配色的取值。 */
const PLAIN_ACCENTS = new Set(['none', 'default', 'original']);
const PALETTE_MARK = '/*dsh-accent:palette*/';
const DEVICE_MARK = '/*dsh-accent:device*/';

/** 深层 token 引用：选择器比主题样式表的 body 规则更具体，晚注入的调色板也压不掉。 */
function paletteCss({ accent, hover, sidebar, base, input }) {
  const declare = (mode) => [
    `--dsw-alias-bg-base:${base[mode]}`,
    `--dsw-specific-input-major:${input[mode]}`,
    `--dsw-specific-sidebar-fill:${sidebar[mode]}`,
    `--dsw-alias-state-business-primary:${accent[mode]}`,
    `--dsw-alias-button-info-fill:${accent[mode]}`,
    `--dsw-alias-button-info-hover:${hover[mode]}`,
  ].join(';');
  return `html body{${declare(0)}}html body[data-ds-dark-theme]{${declare(1)}}`;
}

/** 文本转 CSS 字符串字面量（带引号），转义反斜杠与双引号、把换行折成空格。 */
function cssString(text) {
  return `"${String(text).replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * 输入卡左上角的设备名牌：一枚很轻的胶囊，一半压在卡片上边框上，不进入文字流。
 * 只依赖 `[data-composer-card]` 和强调色 token，DSH 换结构后最坏是名牌消失，不影响输入。
 * @param device 行配置里的 `device`：`name` 是名牌文字，`mark` 可覆盖它（短名或 emoji）。
 */
function deviceCss(device, plain) {
  if (device === null || typeof device !== 'object') return '';
  const name = typeof device.name === 'string' ? device.name.trim() : '';
  const mark = typeof device.mark === 'string' && device.mark.trim() !== '' ? device.mark.trim() : name;
  if (mark === '') return '';

  // 原版配色下不跟主题的蓝色走，改用正文色做一枚中性灰胶囊，任何主题里都不会发灰发蓝。
  const tone = plain ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-state-business-primary)';
  // 输入卡原本只有 8px 上边距，胶囊压进去的那半截会紧贴附件缩略图；这里把上边距加厚，
  // 内容整体下移，胶囊仍然一半压在边框上，但和内容之间留出呼吸感。
  return `html body{--dsh-device-mark:${cssString(mark)};--dsh-device-tone:${tone}}`
    + `html body [data-composer-card]{padding-top:14px}`
    + `[data-composer-card]::after{content:var(--dsh-device-mark);position:absolute;top:-9px;left:12px;z-index:1;display:flex;align-items:center;height:18px;padding:0 9px;border-radius:999px;font-size:10.5px;font-weight:600;letter-spacing:.06em;line-height:1;white-space:nowrap;color:var(--dsh-device-tone,${tone});background:color-mix(in srgb,var(--dsh-device-tone,${tone}) 9%,var(--dsw-alias-bg-base));border:.5px solid color-mix(in srgb,var(--dsh-device-tone,${tone}) 26%,transparent);box-shadow:0 1px 3px rgb(0 0 0/.06);pointer-events:none;user-select:none}`;
}

export const inject = ['connection'];

/** 设置里保存的设备名（优先级高于 profile 配置）。路径跟着仓库走，不进 Git。 */
const DEVICE_FILE = fileURLToPath(new URL('../../.local/data/accent/device.json', import.meta.url));
const NO_STORE = { 'Cache-Control': 'no-store' };

/** 去空白、折换行、截断；非字符串当空值。 */
function clean(value, max) {
  return typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').trim().slice(0, max) : '';
}

/** 读设置页保存过的设备名；没有文件或读坏了返回 null，让配置兜底。 */
function readSavedDevice() {
  try {
    const raw = JSON.parse(readFileSync(DEVICE_FILE, 'utf8'));
    return { name: clean(raw?.name, 16), mark: clean(raw?.mark, 8) };
  } catch {
    return null;
  }
}

/**
 * 注册 index 注入；配置在行上（每个实例的 profile 补丁可以各不相同）。
 * @param ctx Host 插件上下文。
 * @param config 行配置；`accent` 取 ACCENTS 的键，`device` 是实例标识。
 */
export function apply(ctx, config) {
  const asked = config !== null && typeof config === 'object' && typeof config.accent === 'string'
    ? config.accent.trim()
    : '';
  if (asked !== '' && !PLAIN_ACCENTS.has(asked) && ACCENTS[asked] === undefined) {
    ctx.logger?.warn?.(`dsh-accent: 没有 "${asked}" 这套配色，改用 ${DEFAULT_ACCENT}；可选：${Object.keys(ACCENTS).join('、')}`);
  }
  const configured = config !== null && typeof config === 'object' && config.device !== null && typeof config.device === 'object'
    ? { name: clean(config.device.name, 16), mark: clean(config.device.mark, 8) }
    : { name: '', mark: '' };
  let device = readSavedDevice() ?? configured;

  // 每次页面请求都按当前设备名现算，设置里改完刷新就生效，不用重载插件。
  // 两段分开注入：配色那段带标记，客户端「原版」选项直接把它整条禁用，胶囊不受影响。
  ctx.on('webserver/index-inject', (table) => {
    if (!PLAIN_ACCENTS.has(asked)) table.push({ kind: 'style', text: PALETTE_MARK + paletteCss(ACCENTS[asked] ?? ACCENTS[DEFAULT_ACCENT]) });
    const marks = deviceCss(device, PLAIN_ACCENTS.has(asked));
    if (marks !== '') table.push({ kind: 'style', text: DEVICE_MARK + marks });
  });

  const json = (body, status = 200) => Response.json(body, { status, headers: NO_STORE });
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/dsh-accent',
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      if (request.method === 'GET') return json(device);
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return json({ error: 'unsupported_media_type' }, 415);
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400);
      }
      device = { name: clean(body?.name, 16), mark: clean(body?.mark, 8) };
      try {
        mkdirSync(dirname(DEVICE_FILE), { recursive: true });
        writeFileSync(DEVICE_FILE, `${JSON.stringify(device)}\n`);
      } catch (error) {
        ctx.logger?.warn?.(`dsh-accent: 设备名没写进 ${DEVICE_FILE}：${error?.message ?? error}`);
        return json({ error: 'write_failed' }, 500);
      }
      return json(device);
    },
  }), 'dsh-accent: 设备名接口');
}
