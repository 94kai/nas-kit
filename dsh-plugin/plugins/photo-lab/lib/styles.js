import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const FILE = 'styles.json';

function clamp(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** 从参考图估一组「感觉」参数：亮度/对比/饱和/偏色/暗角。只是起点，允许模型覆盖。 */
export async function analyzeStyle(file) {
  const { data, info } = await sharp(file, { failOn: 'none' }).rotate().resize({ width: 256, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const luma = new Float32Array(w * h);
  let rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0, p = 0; i < data.length; i += 3, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    rSum += r; gSum += g; bSum += b;
    luma[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const total = luma.length;
  let sum = 0;
  for (let i = 0; i < total; i++) sum += luma[i];
  const mean = sum / total;
  let variance = 0;
  for (let i = 0; i < total; i++) variance += (luma[i] - mean) ** 2;
  const std = Math.sqrt(variance / total);
  let satSum = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    satSum += max > 0 ? (max - min) / max : 0;
  }
  const sat = satSum / total;
  // 中心与四角的亮度差 → 暗角
  let centerSum = 0, centerCount = 0, cornerSum = 0, cornerCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const value = luma[y * w + x];
      const dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.35) { centerSum += value; centerCount++; }
      else if (d > 0.9) { cornerSum += value; cornerCount++; }
    }
  }
  const center = centerCount ? centerSum / centerCount : mean;
  const corner = cornerCount ? cornerSum / cornerCount : mean;
  const vignette = clamp(((center - corner) / Math.max(1, center)) * 0.6, -0.08, 0.3, 0);
  const r = rSum / total, g = gSum / total, b = bSum / total;
  const tint = [
    clamp(r / Math.max(1, g), 0.96, 1.04, 1),
    1,
    clamp(b / Math.max(1, g), 0.96, 1.04, 1)
  ];
  const adjust = {
    brightness: clamp((mean / 255) / 0.42, 0.92, 1.1, 1),
    contrast: clamp(std / 55, 0.85, 1.3, 1),
    saturation: clamp(sat / 0.22, 0.6, 1.35, 1),
    tint,
    vignette: Math.round(vignette * 100) / 100
  };
  return { adjust, stats: { mean_luma: Math.round(mean), contrast_std: Math.round(std), saturation: Math.round(sat * 100) / 100, rgb_mean: [r, g, b].map(v => Math.round(v)) } };
}

export function createStyleLibrary({ dataDir }) {
  const file = path.join(dataDir, FILE);
  async function read() {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch { return { version: 1, styles: {} }; }
  }
  async function write(data) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 1));
  }

  async function list() {
    const data = await read();
    return Object.values(data.styles || {}).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function get(id) {
    const data = await read();
    return (data.styles && data.styles[id]) || null;
  }

  /** 新建：auto 用统计值，传了 adjust 就用调用方的（更准）。 */
  async function learn({ name, file: source, adjust = null, description = '', base = 'natural' }) {
    const id = 's' + crypto.createHash('sha1').update(String(name) + Date.now()).digest('hex').slice(0, 8);
    const data = await read();
    const analyzed = source ? await analyzeStyle(source).catch(() => null) : null;
    const style = {
      id,
      name: String(name || '未命名风格').slice(0, 40),
      base,
      adjust: adjust || (analyzed ? analyzed.adjust : {}),
      description: String(description || '').slice(0, 400),
      source: source || null,
      stats: analyzed ? analyzed.stats : null,
      createdAt: new Date().toISOString()
    };
    data.styles = data.styles || {};
    data.styles[id] = style;
    await write(data);
    return style;
  }

  async function remove(id) {
    const data = await read();
    if (!data.styles || !data.styles[id]) return { removed: false };
    delete data.styles[id];
    await write(data);
    return { removed: true };
  }

  return { list, get, learn, remove };
}
