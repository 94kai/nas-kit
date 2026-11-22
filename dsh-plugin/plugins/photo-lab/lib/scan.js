import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

export function isImage(file) {
  return IMAGE_EXT.has(path.extname(file).toLowerCase());
}

/** 读一张图的尺寸；手机照片带 EXIF 方向，5–8 表示长宽要对调。 */
export async function readSize(file) {
  const meta = await sharp(file).metadata();
  const swap = meta.orientation >= 5 && meta.orientation <= 8;
  return { width: swap ? meta.height : meta.width, height: swap ? meta.width : meta.height, orientation: meta.orientation || 1 };
}

export async function makeDerivatives(file, { thumbPath, previewPath }) {
  await fs.mkdir(path.dirname(thumbPath), { recursive: true });
  await fs.mkdir(path.dirname(previewPath), { recursive: true });
  await sharp(file).rotate().resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(thumbPath);
  await sharp(file).rotate().resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toFile(previewPath);
}

/** 扫描目录：新增/变化的图重新出缩略图，删掉的标 missing，其余不动。 */
export async function scanDirectory(project, store, { onProgress } = {}) {
  const entries = await fs.readdir(project.dir, { withFileTypes: true }).catch(() => {
    throw Object.assign(new Error('目录不可读，请确认路径存在且有权限'), { status: 400 });
  });
  const files = entries
    .filter(entry => entry.isFile() && isImage(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));

  const seen = new Set();
  let added = 0, updated = 0, index = 0;
  const photos = project.photos;

  for (const file of files) {
    const full = path.join(project.dir, file);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat) continue;
    let id = path.basename(file, path.extname(file));
    if (seen.has(id)) id = `${id}_${++index}`;
    seen.add(id);
    const known = photos[id];
    const unchanged = known && !known.missing && known.bytes === stat.size && known.mtime === Math.round(stat.mtimeMs);
    const thumbPath = path.join(store.assetDir(project.id, 'thumbs'), `${id}.jpg`);
    const previewPath = path.join(store.assetDir(project.id, 'previews'), `${id}.jpg`);
    if (unchanged) {
      if (!(await exists(thumbPath)) || !(await exists(previewPath))) await makeDerivatives(full, { thumbPath, previewPath });
      continue;
    }
    const size = await readSize(full).catch(() => null);
    if (!size) continue;
    await makeDerivatives(full, { thumbPath, previewPath });
    photos[id] = {
      id, file,
      width: size.width, height: size.height,
      bytes: stat.size, mtime: Math.round(stat.mtimeMs),
      triage: null,
      decision: { state: null, by: 'ai', note: '', tags: [] },
      rounds: [],
      final: null,
      missing: false
    };
    if (known) updated++; else added++;
    onProgress?.({ done: added + updated, total: files.length, id });
  }

  for (const [id, photo] of Object.entries(photos)) {
    if (!seen.has(id)) photo.missing = true;
  }
  return { added, updated, total: files.length, kept: files.length - added - updated };
}

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}
