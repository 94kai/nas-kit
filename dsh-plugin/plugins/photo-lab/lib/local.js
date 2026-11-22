import sharp from 'sharp';

const clamp = (value, min, max, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** 生成一个 SVG 遮罩（白=生效）；invert 时反相。 */
function maskMarkup(local, w, h) {
  const feather = clamp(local.feather, 0, 1, 0.5);
  const blurPx = Math.max(0, feather * Math.min(w, h) * 0.035);
  const blur = blurPx > 0.4 ? `<filter id="f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blurPx.toFixed(2)}"/></filter>` : '';
  let shape = '';
  if (local.shape === 'radial' || (!local.shape && local.rx)) {
    const cx = clamp(local.cx, 0, 1, 0.5) * w;
    const cy = clamp(local.cy, 0, 1, 0.5) * h;
    const rx = Math.max(2, clamp(local.rx, 0.005, 1, 0.25) * w);
    const ry = Math.max(2, clamp(local.ry, 0.005, 1, 0.25) * h);
    shape = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"${blurPx > 0.4 ? ' filter="url(#f)"' : ''}/>`;
  } else if (local.shape === 'linear') {
    const x0 = clamp(local.x0, 0, 1, 0) * w, y0 = clamp(local.y0, 0, 1, 0) * h;
    const x1 = clamp(local.x1, 0, 1, 1) * w, y1 = clamp(local.y1, 0, 1, 1) * h;
    const soft = Math.min(0.95, Math.max(0.05, feather));
    shape = `<linearGradient id="lg" gradientUnits="userSpaceOnUse" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}">
      <stop offset="0" stop-color="white"/><stop offset="${(1 - soft).toFixed(3)}" stop-color="white"/><stop offset="1" stop-color="black"/>
    </linearGradient><rect width="${w}" height="${h}" fill="url(#lg)"/>`;
  } else if (local.shape === 'box' && Array.isArray(local.box) && local.box.length === 4) {
    const [bx0, by0, bx1, by1] = local.box.map(v => clamp(v, 0, 1));
    shape = `<rect x="${bx0 * w}" y="${by0 * h}" width="${Math.max(1, (bx1 - bx0) * w)}" height="${Math.max(1, (by1 - by0) * h)}" fill="white"${blurPx > 0.4 ? ' filter="url(#f)"' : ''}/>`;
  } else if (local.shape === 'polygon' && Array.isArray(local.points) && local.points.length >= 3) {
    const d = local.points.map(([x, y]) => `${clamp(x, 0, 1) * w},${clamp(y, 0, 1) * h}`).join(' ');
    shape = `<polygon points="${d}" fill="white"${blurPx > 0.4 ? ' filter="url(#f)"' : ''}/>`;
  } else {
    return null;
  }
  const invert = !!local.invert;
  const body = invert
    ? `<rect width="${w}" height="${h}" fill="white"/><g fill="black">${shape.replace(/fill="white"/, 'fill="black"')}</g>`
    : shape;
  return { blur, body, invert };
}

/** 把一张已经调过色的图，按遮罩叠回底图。 */
export async function applyLocal(baseBuffer, local, width, height) {
  const markup = maskMarkup(local, width, height);
  if (!markup) return baseBuffer;
  const adjust = local.adjust || {};
  let adjusted = sharp(baseBuffer);
  const exposure = clamp(adjust.exposure, -2, 2, 0);
  const contrast = clamp(adjust.contrast, 0.5, 1.8, 1);
  const saturation = clamp(adjust.saturation, 0.2, 2, 1);
  const temperature = clamp(adjust.temperature, -1, 1, 0);
  const clarity = clamp(adjust.clarity, -1, 1, 0);
  if (exposure) adjusted = adjusted.modulate({ brightness: Math.pow(2, exposure) });
  if (saturation !== 1) adjusted = adjusted.modulate({ saturation });
  if (contrast !== 1) adjusted = adjusted.linear(contrast, (1 - contrast) / 2);
  if (temperature) {
    const t = temperature * 0.06;
    adjusted = adjusted.recomb([[1 + t, 0, 0], [0, 1, 0], [0, 0, 1 - t]]);
  }
  if (clarity) adjusted = adjusted.sharpen({ sigma: Math.max(0.4, clarity) }).modulate({ brightness: clarity < 0 ? 0.97 : 1 });
  const adjustedBuffer = await adjusted.png().toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>${markup.blur}
      <mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="black"/>${markup.body}
      </mask>
    </defs>
    <image href="data:image/png;base64,${adjustedBuffer.toString('base64')}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" mask="url(#m)"/>
  </svg>`;
  return sharp(baseBuffer).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

/** 自检用：遮罩范围叠成红色半透明。 */
export async function maskPreview(baseBuffer, local, width, height) {
  const markup = maskMarkup(local, width, height);
  if (!markup) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>${markup.blur}
      <mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="black"/>${markup.body}
      </mask>
    </defs>
    <rect width="${width}" height="${height}" fill="#ff3b30" fill-opacity="0.55" mask="url(#m)"/>
  </svg>`;
  return sharp(baseBuffer).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 80 }).toBuffer();
}

/** 直方图统计：判断过曝、死黑、发灰。 */
export async function imageStats(buffer) {
  const { data, info } = await sharp(buffer).resize({ width: 320, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const luma = new Float32Array(info.width * info.height);
  let rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0, p = 0; i < data.length; i += 3, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    rSum += r; gSum += g; bSum += b;
    luma[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const hist = new Uint32Array(256);
  for (let i = 0; i < luma.length; i++) hist[Math.min(255, Math.max(0, Math.round(luma[i])))]++;
  const total = luma.length;
  let acc = 0, p01 = 0, p99 = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc / total >= 0.01 && !p01) p01 = i; if (acc / total >= 0.99) { p99 = i; break; } }
  let sum = 0; for (let i = 0; i < luma.length; i++) sum += luma[i];
  const mean = sum / total;
  let variance = 0; for (let i = 0; i < luma.length; i++) variance += (luma[i] - mean) ** 2;
  const std = Math.sqrt(variance / total);
  const high = hist.slice(250).reduce((a, b) => a + b, 0) / total * 100;
  const low = hist.slice(0, 6).reduce((a, b) => a + b, 0) / total * 100;
  const warnings = [];
  if (std < 22) warnings.push('flat');
  if (high > 1) warnings.push('clipped_high');
  if (low > 25) warnings.push('clipped_low');
  return {
    mean_luma: Math.round(mean * 10) / 10, p01, p99,
    clipped_high_pct: Math.round(high * 10) / 10,
    clipped_low_pct: Math.round(low * 10) / 10,
    contrast_std: Math.round(std * 10) / 10,
    rgb_mean: [rSum / total, gSum / total, bSum / total].map(v => Math.round(v * 10) / 10),
    warnings
  };
}

/** 自动找污点：按「比周围暗多少 × 面积」排序取前 N，返回归一化坐标（不落盘）。 */
export async function detectSpots(buffer, { sensitivity = 0.6 } = {}) {
  const width = 1000;
  const { data, info } = await sharp(buffer).resize({ width, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 3, p++) gray[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  const blur = await sharp(Buffer.from(gray.map(v => v | 0)), { raw: { width: w, height: h, channels: 1 } }).blur(Math.max(1, w / 140)).raw().toBuffer();
  const threshold = 10 + (1 - Math.min(1, Math.max(0, sensitivity))) * 30;
  const cell = 14;
  const buckets = new Map();
  for (let y = 2; y < h - 2; y++) {
    const rowBase = y * w;
    for (let x = 2; x < w - 2; x++) {
      const index = rowBase + x;
      const diff = blur[index] - gray[index];
      if (diff <= threshold) continue;
      if (gray[index] < 18 || gray[index] > 200) continue;
      const key = (Math.floor(x / cell)) + ':' + (Math.floor(y / cell));
      const bucket = buckets.get(key) || { sumX: 0, sumY: 0, count: 0, maxDiff: 0 };
      bucket.sumX += x; bucket.sumY += y; bucket.count++; bucket.maxDiff = Math.max(bucket.maxDiff, diff);
      buckets.set(key, bucket);
    }
  }
  const ranked = [...buckets.values()]
    .filter(bucket => bucket.count >= 2)
    .map(bucket => ({ bucket, score: bucket.maxDiff * Math.min(bucket.count, 12) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);
  return ranked.map(({ bucket }) => ({
    x: Math.round((bucket.sumX / bucket.count / w) * 10000) / 10000,
    y: Math.round((bucket.sumY / bucket.count / h) * 10000) / 10000,
    r: Math.round(Math.min(0.03, Math.max(0.002, Math.sqrt(bucket.count / Math.PI) * 1.8 / Math.min(w, h))) * 10000) / 10000
  }));
}

/** 按点位做去污：用更大的周围采样覆盖圆点，边缘羽化。 */
export async function healSpots(buffer, spots, width, height) {
  if (!Array.isArray(spots) || !spots.length) return buffer;
  const short = Math.min(width, height);
  const radii = spots.map(spot => Math.max(2, clamp(spot.r, 0.001, 0.2) * short));
  const maxRadius = Math.max(...radii);
  const sigma = Math.max(3, maxRadius * 1.4);
  const blurred = await sharp(buffer).blur(sigma).png().toBuffer();
  const circles = spots.map((spot, index) => {
    const r = radii[index] * 1.5;
    return `<circle cx="${clamp(spot.x, 0, 1) * width}" cy="${clamp(spot.y, 0, 1) * height}" r="${r}" fill="white"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${Math.max(1, maxRadius * 0.35).toFixed(2)}"/></filter>
      <mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="black"/><g filter="url(#soft)">${circles}</g>
      </mask>
    </defs>
    <image href="data:image/png;base64,${blurred.toString('base64')}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" mask="url(#m)"/>
  </svg>`;
  return sharp(buffer).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}
