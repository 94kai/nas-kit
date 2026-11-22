import sharp from 'sharp';
import { applyLocal, maskPreview, imageStats } from './local.js';

/** 风格预设：全部是确定性参数。 */
export const STYLES = {
  natural: { label: '自然通透', brightness: 1.03, saturation: 1.05, contrast: 1.10, offset: -0.004, sharpen: 0.7, vignette: 0.10, tint: [1, 1, 1] },
  film: { label: '暖调胶片', brightness: 1.02, saturation: 1.06, contrast: 1.07, offset: 0.012, sharpen: 0.5, vignette: 0.16, tint: [1.045, 1.0, 0.955] },
  cinema: { label: '冷调电影', brightness: 0.98, saturation: 1.04, contrast: 1.16, offset: -0.012, sharpen: 0.6, vignette: 0.22, tint: [1.0, 1.0, 1.045] },
  fresh: { label: '日系清淡', brightness: 1.10, saturation: 0.88, contrast: 0.98, offset: 0.02, sharpen: 0.4, vignette: 0.05, tint: [1, 1, 1] },
  golden: { label: '金色黄昏', brightness: 1.04, saturation: 1.12, contrast: 1.12, offset: 0.004, sharpen: 0.6, vignette: 0.18, tint: [1.075, 1.0, 0.905] },
  teal: { label: '青橙电影', brightness: 1.0, saturation: 1.1, contrast: 1.15, offset: -0.006, sharpen: 0.65, vignette: 0.2, tint: [1.02, 1.0, 1.035] },
  moody: { label: '暗调氛围', brightness: 0.9, saturation: 0.85, contrast: 1.18, offset: -0.02, sharpen: 0.5, vignette: 0.3, tint: [0.98, 1.0, 1.04] },
  vivid: { label: '鲜艳通透', brightness: 1.05, saturation: 1.25, contrast: 1.12, offset: -0.004, sharpen: 0.8, vignette: 0.12, tint: [1, 1, 1] },
  soft: { label: '柔和人像', brightness: 1.06, saturation: 0.98, contrast: 0.95, offset: 0.02, sharpen: 0.3, vignette: 0.06, tint: [1.02, 1.0, 0.99] },
  mono: { label: '中性黑白', brightness: 1.02, saturation: 0, contrast: 1.18, offset: -0.01, sharpen: 0.8, vignette: 0.18, tint: [1, 1, 1] },
  noir: { label: '高反差黑白', brightness: 0.98, saturation: 0, contrast: 1.35, offset: -0.02, sharpen: 0.9, vignette: 0.25, tint: [1, 1, 1] }
};

const RATIOS = { '1:1': 1, '4:5': 4 / 5, '3:2': 3 / 2, '2:3': 2 / 3, '16:9': 16 / 9, '9:16': 9 / 16 };

function applyAdjust(base, adjust) {
  if (!adjust || typeof adjust !== 'object') return { ...base, tint: [...base.tint] };
  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const preset = { ...base, tint: [...base.tint] };
  preset.brightness *= clamp(adjust.brightness, 0.8, 1.25, 1);
  preset.saturation *= clamp(adjust.saturation, 0.4, 1.6, 1);
  preset.contrast *= clamp(adjust.contrast, 0.7, 1.35, 1);
  preset.sharpen = Math.min(1.5, preset.sharpen * clamp(adjust.sharpen, 0, 1.6, 1));
  preset.vignette = Math.min(0.45, Math.max(0, preset.vignette + clamp(adjust.vignette, -0.2, 0.3, 0)));
  if (Array.isArray(adjust.tint) && adjust.tint.length === 3) {
    preset.tint = preset.tint.map((value, index) => value * clamp(adjust.tint[index], 0.9, 1.1, 1));
  }
  return preset;
}

function cropRect(width, height, crop) {
  if (!crop) return null;
  if (Array.isArray(crop.box) && crop.box.length === 4) {
    const [x0, y0, x1, y1] = crop.box.map(Number);
    const left = Math.round(Math.max(0, Math.min(1, x0)) * width);
    const top = Math.round(Math.max(0, Math.min(1, y0)) * height);
    const right = Math.round(Math.max(0, Math.min(1, x1)) * width);
    const bottom = Math.round(Math.max(0, Math.min(1, y1)) * height);
    return { left, top, width: Math.max(16, right - left), height: Math.max(16, bottom - top) };
  }
  const ratio = RATIOS[crop.aspect];
  if (!ratio) return null;
  let w = width, h = Math.round(width / ratio);
  if (h > height) { h = height; w = Math.round(height * ratio); }
  const fx = Number.isFinite(crop.focusX) ? Math.min(1, Math.max(0, crop.focusX)) : 0.5;
  const fy = Number.isFinite(crop.focusY) ? Math.min(1, Math.max(0, crop.focusY)) : 0.5;
  return {
    left: Math.min(width - w, Math.max(0, Math.round(width * fx - w / 2))),
    top: Math.min(height - h, Math.max(0, Math.round(height * fy - h / 2))),
    width: w, height: h
  };
}

function vignetteSvg(width, height, strength) {
  if (!strength) return null;
  const inner = Math.round(38 + strength * 60);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><radialGradient id="v" cx="50%" cy="50%" r="72%">
      <stop offset="${inner}%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="${(strength * 1.6).toFixed(3)}"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#v)"/></svg>`);
}

/** 旋转 + 裁切准备；返回可继续 resize 的 pipeline 和目标尺寸。 */
async function prepare(file, crop) {
  const angle = crop && Number.isFinite(Number(crop.rotate)) ? Math.max(-45, Math.min(45, Number(crop.rotate))) : 0;
  let source = file;
  let width, height;
  if (angle) {
    const rotated = await sharp(file, { failOn: 'none' }).rotate(angle).toBuffer({ resolveWithObject: true });
    source = rotated.data;
    width = rotated.info.width; height = rotated.info.height;
  } else {
    const meta = await sharp(file, { failOn: 'none' }).metadata();
    width = meta.width; height = meta.height;
    if (meta.orientation >= 5 && meta.orientation <= 8) { width = meta.height; height = meta.width; }
  }
  let pipeline = sharp(source, { failOn: 'none' }).rotate();
  const rect = cropRect(width, height, crop);
  if (rect) {
    const flattened = await sharp(source, { failOn: 'none' }).rotate().toBuffer({ resolveWithObject: true });
    pipeline = sharp(flattened.data).extract({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    width = rect.width; height = rect.height;
  }
  return { pipeline, width, height };
}

/** 渲染一张：width 为长边目标宽度；local 为局部调整数组。 */
export async function render(file, { style = 'natural', crop = null, width = 1280, quality = 84, adjust = null, local = null } = {}) {
  const preset = applyAdjust(STYLES[style] || STYLES.natural, adjust);
  const { pipeline, width: srcW, height: srcH } = await prepare(file, crop);
  const outW = Math.min(width, srcW);
  const outH = Math.max(1, Math.round(srcH * (outW / srcW)));
  let img = pipeline.resize({ width: outW, withoutEnlargement: true });
  if (!preset.saturation) img = img.grayscale();
  else img = img.modulate({ brightness: preset.brightness, saturation: preset.saturation });
  const [r, g, b] = preset.tint;
  if (r !== 1 || g !== 1 || b !== 1) img = img.recomb([[r, 0, 0], [0, g, 0], [0, 0, b]]);
  img = img.linear(preset.contrast, preset.offset);
  const overlay = vignetteSvg(outW, outH, preset.vignette);
  if (overlay) img = img.composite([{ input: overlay, blend: 'over' }]);
  img = img.sharpen({ sigma: preset.sharpen });
  let base = await img.png().toBuffer();
  const masks = Array.isArray(local) ? local.slice(0, 8) : [];
  for (const item of masks) base = await applyLocal(base, item, outW, outH);
  return sharp(base).jpeg({ quality, mozjpeg: true }).toBuffer();
}

/** 只做几何处理（旋转/裁切/缩放），不调色：对比用的「原图」一侧。 */
export async function renderNeutral(file, { crop = null, width = 1280, quality = 84 } = {}) {
  const { pipeline, width: srcW } = await prepare(file, crop);
  const outW = Math.min(width, srcW);
  return pipeline.resize({ width: outW, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
}

export async function renderToFile(file, out, options = {}) {
  const buf = await render(file, options);
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, buf);
  return { bytes: buf.length };
}

/** 局部遮罩自检图：叠加红色范围。 */
export async function renderMaskPreview(file, out, { crop = null, width = 1280, local = [] } = {}) {
  const { pipeline, width: srcW, height: srcH } = await prepare(file, crop);
  const outW = Math.min(width, srcW);
  const outH = Math.max(1, Math.round(srcH * (outW / srcW)));
  const base = await pipeline.resize({ width: outW, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  let buffer = base;
  for (const item of local.slice(0, 8)) buffer = await maskPreview(buffer, item, outW, outH) || buffer;
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, buffer);
  return out;
}

export { imageStats };
