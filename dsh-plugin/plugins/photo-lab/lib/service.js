import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { scanDirectory } from './scan.js';
import { render, renderToFile, renderNeutral, renderMaskPreview, imageStats, STYLES } from './engine.js';
import { healSpots, detectSpots } from './local.js';
import { createZip } from './zip.js';
import { createStyleLibrary } from './styles.js';

const EXPORT_WIDTH = 4096;

export function createService({ store }) {
  const styleLib = createStyleLibrary({ dataDir: store.dataDir });
  const assetPath = (project, kind, name) => path.join(store.projectsDir, project.id, kind, name);

  function summarize(project) {
    const photos = Object.values(project.photos || {});
    const triaged = photos.filter(p => p.triage).length;
    const keep = photos.filter(p => effectiveDecision(p) === 'keep').length;
    const marked = photos.filter(p => effectiveDecision(p) === 'delete').length;
    const notes = photos.filter(pendingNote).length;
    const graded = photos.filter(p => (p.rounds || []).length > 0).length;
    return {
      id: project.id, dir: project.dir, sessionId: project.sessionId, style: project.style,
      counts: { total: photos.length, triaged, keep, graded, marked, notes, missing: photos.filter(p => p.missing).length },
      manifest: store.projectFile(project.id),
      updatedAt: project.updatedAt, revision: project.revision
    };
  }

  function roundView(project, photo, round) {
    return {
      n: round.n, style: round.style, styleLabel: round.styleLabel || round.style, at: round.at, source: round.source || 'engine', note: round.note || '',
      params: round.params || { style: round.style, crop: round.crop || null, adjust: round.adjust || null },
      output: round.output || null, stats: round.stats || null, override: !!round.override,
      after: `/api/photo-lab/asset?p=${project.id}&id=${encodeURIComponent(photo.id)}&k=after&r=${round.n}`,
      before: `/api/photo-lab/asset?p=${project.id}&id=${encodeURIComponent(photo.id)}&k=before&r=${round.n}`,
      mask: round.mask ? `/api/photo-lab/asset?p=${project.id}&id=${encodeURIComponent(photo.id)}&k=mask&r=${round.n}` : null
    };
  }

  function publicPhoto(project, photo) {
    const rounds = (photo.rounds || []).map(r => roundView(project, photo, r));
    const latest = rounds[rounds.length - 1] || null;
    return {
      id: photo.id, file: photo.file, width: photo.width, height: photo.height,
      bytes: photo.bytes, missing: !!photo.missing, deletedAt: photo.deletedAt || null,
      triage: photo.triage || null,
      decision: photo.decision || { state: null, by: 'ai', note: '', tags: [] },
      effective: effectiveDecision(photo),
      note: (photo.decision && photo.decision.note) || '',
      noteState: (photo.decision && photo.decision.noteState) || 'none',
      noteAt: (photo.decision && photo.decision.noteAt) || null,
      rounds, final: photo.final ?? null,
      latestStats: latest ? latest.stats : null,
      before: latest
        ? `/api/photo-lab/asset?p=${project.id}&id=${encodeURIComponent(photo.id)}&k=before&r=${latest.n}`
        : `/api/photo-lab/asset?p=${project.id}&id=${encodeURIComponent(photo.id)}&k=before`,
      thumb: `/api/photo-lab/asset?p=${project.id}&id=${encodeURIComponent(photo.id)}&k=thumb`,
      original: `/api/photo-lab/asset?p=${project.id}&id=${encodeURIComponent(photo.id)}&k=original`,
      after: latest ? latest.after : null
    };
  }

  function effectiveDecision(photo) {
    if (photo.decision && photo.decision.state) return photo.decision.state;
    if (photo.triage) return photo.triage.tier === 'keep' ? 'keep' : 'skip';
    return 'pending';
  }

  function pendingNote(photo) {
    return !!(photo && photo.decision && photo.decision.noteState === 'saved' && String(photo.decision.note || '').trim());
  }

  async function requireProject(id) {
    const project = await store.get(id);
    if (!project) throw Object.assign(new Error('项目不存在'), { status: 404 });
    return project;
  }

  async function open({ sessionId, dir }) {
    if (!dir || typeof dir !== 'string') throw Object.assign(new Error('请提供照片目录'), { status: 400 });
    const project = await store.ensureProject({ dir, sessionId });
    const result = await scanDirectory(project, store);
    await store.save(project);
    return { project: summarize(project), scan: result };
  }

  async function rescan(id) {
    const project = await requireProject(id);
    const result = await scanDirectory(project, store);
    await store.save(project);
    return { project: summarize(project), scan: result };
  }

  async function state(id) {
    const project = await requireProject(id);
    return {
      project: summarize(project),
      exportStatus: await readExportState(project),
      styles: await styleLib.list(),
      style: project.style,
      photos: Object.values(project.photos).map(photo => publicPhoto(project, photo)).sort((a, b) => a.id.localeCompare(b.id, 'zh-CN'))
    };
  }

  async function resolveStyle(styleId) {
    const id = styleId || 'natural';
    if (STYLES[id]) return { id, base: id, adjust: null, label: STYLES[id].label };
    const custom = await styleLib.get(id);
    if (custom) return { id, base: custom.base && STYLES[custom.base] ? custom.base : 'natural', adjust: custom.adjust || null, label: custom.name };
    return { id: 'natural', base: 'natural', adjust: null, label: STYLES.natural.label };
  }

  async function setStyle(id, style) {
    const project = await requireProject(id);
    const resolved = await resolveStyle(style);
    if (resolved.id !== style && !STYLES[style]) throw Object.assign(new Error('风格不存在'), { status: 400 });
    project.style = resolved.id;
    await store.save(project);
    return { style: resolved.id };
  }

  async function learnStyle({ name, file, adjust, description, base } = {}) {
    if (!name) throw Object.assign(new Error('请给风格起个名字'), { status: 400 });
    let source = file;
    if (source && !path.isAbsolute(source)) source = path.join(store.dataDir, '..', source);
    const style = await styleLib.learn({ name, file: source, adjust, description, base });
    return { style, note: adjust ? '使用调用方给出的参数' : '根据参考图统计生成，可再微调' };
  }

  async function listStyles() {
    return { builtin: Object.entries(STYLES).map(([id, value]) => ({ id, label: value.label })), custom: await styleLib.list() };
  }

  async function deleteStyle(id) { return styleLib.remove(id); }

  async function decide(id, photoId, patch = {}) {
    const project = await requireProject(id);
    const photo = project.photos[photoId];
    if (!photo) throw Object.assign(new Error('照片不存在'), { status: 404 });
    const decision = { ...(photo.decision || {}), ...patch, by: 'user' };
    if (decision.state && !['keep', 'skip', 'delete', 'pending'].includes(decision.state)) throw Object.assign(new Error('状态不合法'), { status: 400 });
    photo.decision = decision;
    await store.save(project);
    return publicPhoto(project, photo);
  }

  async function bulkDecide(id, ids, stateValue) {
    const project = await requireProject(id);
    const target = ids && ids.length ? ids : Object.keys(project.photos);
    for (const photoId of target) if (project.photos[photoId]) {
      project.photos[photoId].decision = { ...(project.photos[photoId].decision || {}), state: stateValue, by: 'user' };
    }
    await store.save(project);
    return { updated: target.length };
  }

  function normalizeCrop(crop) {
    if (!crop || typeof crop !== 'object') return null;
    const rotate = Number(crop.rotate);
    if (Array.isArray(crop.box) && crop.box.length === 4) {
      const [x0, y0, x1, y1] = crop.box.map(Number);
      if ([x0, y0, x1, y1].every(Number.isFinite) && x1 > x0 && y1 > y0 && x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1) {
        return { box: [x0, y0, x1, y1].map(v => Math.round(v * 10000) / 10000), ...(Number.isFinite(rotate) ? { rotate } : {}) };
      }
    }
    if (crop.aspect) return { aspect: String(crop.aspect), focusX: Number(crop.focusX), focusY: Number(crop.focusY), ...(Number.isFinite(rotate) ? { rotate } : {}) };
    if (Number.isFinite(rotate)) return { rotate };
    return null;
  }

  /** AI 写初筛结论；人已经改过决定的照片，decision 不动。 */
  async function updateTriage(id, items = []) {
    const project = await requireProject(id);
    let written = 0;
    const warnings = [];
    for (const item of items) {
      const photo = project.photos[item.id];
      if (!photo) { warnings.push(`照片不存在：${item.id}`); continue; }
      const tier = ['keep', 'maybe', 'skip'].includes(item.tier) ? item.tier : 'maybe';
      photo.triage = {
        tier,
        score: Number.isFinite(item.score) ? Math.max(0, Math.min(100, Math.round(item.score))) : null,
        reasons: Array.isArray(item.reasons) ? item.reasons.slice(0, 6).map(String) : [],
        problems: Array.isArray(item.problems) ? item.problems.slice(0, 6).map(String) : [],
        direction: typeof item.direction === 'string' ? item.direction.slice(0, 300) : '',
        crop: normalizeCrop(item.crop),
        style: STYLES[item.style] ? item.style : null,
        at: new Date().toISOString()
      };
      if (!photo.decision || photo.decision.by !== 'user') {
        photo.decision = { ...(photo.decision || {}), state: tier === 'keep' ? 'keep' : 'skip', by: 'ai' };
      }
      written++;
    }
    await store.save(project);
    return { written, revision: project.revision, ...(warnings.length ? { warnings } : {}) };
  }

  function clampSize(size, fallback) {
    const n = Number(size);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.max(320, Math.min(4096, Math.round(n)));
  }

  /** 渲染：批次默认参数 + items 单张覆盖。 */
  async function grade(id, { ids, items, style, adjust, local, size, mask_preview } = {}) {
    const project = await requireProject(id);
    const width = clampSize(size, 1280);
    const defaultResolved = await resolveStyle(style || project.style);
    const defaults = {
      style: defaultResolved.id, base: defaultResolved.base,
      adjust: { ...(defaultResolved.adjust || {}), ...(adjust || {}) },
      local: Array.isArray(local) ? local.slice(0, 8) : null,
      crop: null
    };
    const overrides = new Map((items || []).map(item => [item.id, item]));
    const baseIds = ids && ids.length ? [...ids] : Object.keys(project.photos).filter(pid => effectiveDecision(project.photos[pid]) === 'keep');
    for (const overrideId of overrides.keys()) if (!baseIds.includes(overrideId)) baseIds.push(overrideId);
    const targets = baseIds.map(pid => project.photos[pid]).filter(photo => photo && !photo.missing);
    const rendered = [];
    for (const photo of targets) {
      const override = overrides.get(photo.id) || {};
      const resolved = override.style ? await resolveStyle(override.style) : defaultResolved;
      const callerAdjust = override.adjust !== undefined ? override.adjust : null;
      const mergedAdjust = { ...(resolved.adjust || {}), ...(callerAdjust || {}), ...(override.style ? {} : {}) };
      Object.assign(mergedAdjust, override.style ? {} : {});
      const chosenAdjust = Object.keys(mergedAdjust).length ? mergedAdjust : null;
      const chosenStyle = resolved.id;
      const baseStyle = resolved.base;
      const chosenLocal = override.local !== undefined ? override.local : defaults.local;
      const crop = override.crop || (photo.triage && photo.triage.crop) || null;
      const source = path.join(project.dir, photo.file);
      const round = (photo.rounds || []).length + 1;
      const buf = await render(source, { style: baseStyle, crop, width, quality: 84, adjust: chosenAdjust, local: chosenLocal });
      const outFile = assetPath(project, 'out', `${photo.id}-v${round}.jpg`);
      await fs.mkdir(path.dirname(outFile), { recursive: true });
      await fs.writeFile(outFile, buf);
      const beforeFile = assetPath(project, 'out', `${photo.id}-v${round}-before.jpg`);
      await fs.writeFile(beforeFile, await renderNeutral(source, { crop, width, quality: 84 }));
      let maskFile = null;
      if (mask_preview && Array.isArray(chosenLocal) && chosenLocal.length) {
        maskFile = assetPath(project, 'out', `${photo.id}-v${round}-mask.jpg`);
        await renderMaskPreview(source, maskFile, { crop, width, local: chosenLocal });
      }
      const meta = await sharp(buf).metadata();
      const stats = await imageStats(buf);
      const entry = {
        n: round, style: chosenStyle, styleLabel: resolved.label, at: new Date().toISOString(), source: 'engine',
        override: !!(override.adjust || override.style || override.local),
        params: { style: chosenStyle, base: baseStyle, adjust: chosenAdjust, local: chosenLocal, crop, width },
        output: { w: meta.width, h: meta.height, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) },
        stats,
        preview: path.relative(store.projectsDir, outFile),
        before: path.relative(store.projectsDir, beforeFile),
        ...(maskFile ? { mask: path.relative(store.projectsDir, maskFile) } : {})
      };
      photo.rounds = [...(photo.rounds || []), entry];
      rendered.push({ id: photo.id, round, style: chosenStyle, styleLabel: resolved.label, stats, warnings: stats.warnings, override: entry.override });
    }
    project.style = defaults.style;
    await store.save(project);
    return { style: defaults.style, styleLabel: defaultResolved.label, width, rendered, revision: project.revision };
  }

  /** 批注：先保存，再决定什么时候执行；执行不等于修图，也可能是回答问题。 */
  async function saveNote(id, photoId, note) {
    const project = await requireProject(id);
    const photo = project.photos[photoId];
    if (!photo) throw Object.assign(new Error('照片不存在'), { status: 404 });
    const text = String(note == null ? '' : note).slice(0, 2000);
    photo.decision = { ...(photo.decision || {}), note: text, noteState: text.trim() ? 'saved' : 'none', noteAt: new Date().toISOString() };
    await store.save(project);
    return publicPhoto(project, photo);
  }

  async function markNotesSent(id, ids) {
    const project = await requireProject(id);
    const targets = ids && ids.length ? ids : Object.keys(project.photos).filter(pid => pendingNote(project.photos[pid]));
    let sent = 0;
    for (const pid of targets) {
      const photo = project.photos[pid];
      if (pendingNote(photo)) { photo.decision.noteState = 'sent'; photo.decision.noteAt = new Date().toISOString(); sent++; }
    }
    if (sent) await store.save(project);
    return { sent };
  }

  /** 去污：auto 只返回检测结果；给 spots 才真正出图，叠在最近一轮的参数上。 */
  async function retouch(id, { ids, items, size, auto } = {}) {
    const project = await requireProject(id);
    const width = clampSize(size, 1280);
    const targets = (ids && ids.length ? ids : Object.keys(project.photos)).map(pid => project.photos[pid]).filter(Boolean);
    const overrides = new Map((items || []).map(item => [item.id, item]));
    const results = [];
    for (const photo of targets) {
      if (photo.missing) continue;
      const item = overrides.get(photo.id) || {};
      const latest = (photo.rounds || [])[(photo.rounds || []).length - 1];
      const params = (latest && latest.params) || {};
      const resolved = await resolveStyle(item.style || params.style || (latest && latest.style) || project.style);
      const style = resolved.id;
      const crop = item.crop || params.crop || (latest && latest.crop) || (photo.triage && photo.triage.crop) || null;
      const adjust = { ...(resolved.adjust || {}), ...(Object.prototype.hasOwnProperty.call(item, 'adjust') ? item.adjust : (params.adjust || {})) };
      const local = Object.prototype.hasOwnProperty.call(item, 'local') ? item.local : (params.local || null);
      const source = path.join(project.dir, photo.file);
      let spots = Array.isArray(item.spots) ? item.spots : null;
      if (spots && spots.length === 0) { results.push({ id: photo.id, error: 'spots 为空，未出图' }); continue; }
      const graded = await render(source, { style: resolved.base, crop, adjust, local, width, quality: 92 });
      const meta = await sharp(graded).metadata();
      if (!spots) {
        if (!(auto && auto.enabled) && !(item.auto && item.auto.enabled)) continue;
        spots = await detectSpots(graded, { sensitivity: (item.auto && item.auto.sensitivity) || (auto && auto.sensitivity) });
        results.push({ id: photo.id, detected: spots.length, spots, width: meta.width, height: meta.height, written: false });
        continue;
      }
      const healedRaw = await healSpots(graded, spots, meta.width, meta.height);
      const healed = await sharp(healedRaw).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      const changed = crypto.createHash('sha256').update(graded).digest('hex') !== crypto.createHash('sha256').update(healed).digest('hex');
      if (!changed) { results.push({ id: photo.id, error: '点位没有产生任何像素变化，未写入新一轮', spots: spots.length }); continue; }
      const round = (photo.rounds || []).length + 1;
      const outFile = assetPath(project, 'out', `${photo.id}-v${round}.jpg`);
      await fs.mkdir(path.dirname(outFile), { recursive: true });
      await fs.writeFile(outFile, healed);
      const beforeFile = assetPath(project, 'out', `${photo.id}-v${round}-before.jpg`);
      await fs.writeFile(beforeFile, await renderNeutral(source, { crop, width, quality: 84 }));
      const outMeta = await sharp(healed).metadata();
      const stats = await imageStats(healed);
      photo.rounds = [...(photo.rounds || []), {
        n: round, style, at: new Date().toISOString(), source: 'retouch',
        params: { style, crop, adjust, local, width, spots },
        output: { w: outMeta.width, h: outMeta.height, bytes: healed.length, sha256: crypto.createHash('sha256').update(healed).digest('hex').slice(0, 16) },
        stats,
        preview: path.relative(store.projectsDir, outFile),
        before: path.relative(store.projectsDir, beforeFile)
      }];
      results.push({ id: photo.id, round, written: true, changed, spots: spots.length, stats });
    }
    await store.save(project);
    return { results, revision: project.revision };
  }

  /** 外部做完的图回写成一轮：导出会用它（尤其 set_final）。 */
  async function ingest(id, { photoId, file, set_final = true, note = '', params = null, as_round = true } = {}) {
    const project = await requireProject(id);
    const photo = project.photos[photoId];
    if (!photo) throw Object.assign(new Error('照片不存在：' + photoId), { status: 404 });
    if (!file || typeof file !== 'string') throw Object.assign(new Error('缺少 file'), { status: 400 });
    const source = path.isAbsolute(file) ? file : path.join(project.dir, file);
    const stat = await fs.stat(source).catch(() => null);
    if (!stat) throw Object.assign(new Error('文件不存在：' + file), { status: 400 });
    const meta = await sharp(source).metadata().catch(() => null);
    if (!meta || !meta.width) throw Object.assign(new Error('文件无法解码'), { status: 400 });
    const ratio = photo.width / photo.height;
    const outRatio = meta.width / meta.height;
    const ratioGap = Math.abs(ratio - outRatio) / ratio;
    const n = (photo.rounds || []).length + 1;
    const outFile = assetPath(project, 'out', `${photo.id}-v${n}.jpg`);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.copyFile(source, outFile);
    const beforeFile = assetPath(project, 'out', `${photo.id}-v${n}-before.jpg`);
    await fs.writeFile(beforeFile, await renderNeutral(path.join(project.dir, photo.file), { crop: (params && params.crop) || null, width: 1280, quality: 84 }));
    const stats = await imageStats(await fs.readFile(outFile));
    const entry = {
      n, style: (params && params.style) || project.style, at: new Date().toISOString(), source: 'external', note,
      params: params || { style: project.style, external: true },
      output: { w: meta.width, h: meta.height, bytes: stat.size, sha256: crypto.createHash('sha256').update(await fs.readFile(outFile)).digest('hex').slice(0, 16) },
      stats,
      preview: path.relative(store.projectsDir, outFile),
      before: path.relative(store.projectsDir, beforeFile)
    };
    if (as_round) photo.rounds = [...(photo.rounds || []), entry];
    if (set_final) photo.final = n;
    await store.save(project);
    return { id: photo.id, round: n, final: photo.final, warning: ratioGap > 0.02 ? '长宽比与原图不一致，对比图和导出可能有位移' : null, revision: project.revision };
  }

  function pickRound(photo) {
    const rounds = photo.rounds || [];
    if (!rounds.length) return null;
    if (photo.final && rounds.some(r => r.n === photo.final)) return rounds.find(r => r.n === photo.final);
    return rounds[rounds.length - 1];
  }

  /** 指定哪一轮是导出用的定稿；round 传 null 表示取消。 */
  async function setFinal(id, photoId, round) {
    const project = await requireProject(id);
    const photo = project.photos[photoId];
    if (!photo) throw Object.assign(new Error('照片不存在'), { status: 404 });
    if (round == null) {
      photo.final = null;
    } else {
      const n = Number(round);
      if (!(photo.rounds || []).some(item => item.n === n)) throw Object.assign(new Error('这一轮不存在：' + round), { status: 400 });
      photo.final = n;
    }
    await store.save(project);
    return publicPhoto(project, photo);
  }

  async function exportArchive(id, { size } = {}) {
    const project = await requireProject(id);
    const current = await readExportState(project);
    if (current && current.status === 'running') return { started: false, status: current };
    const width = Number(size) > 0 ? Math.min(8000, Number(size)) : EXPORT_WIDTH;
    const stamp = new Date();
    const pad = n => String(n).padStart(2, '0');
    const name = `修图导出-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.zip`;
    const outDir = path.join(project.dir, '_export');
    const zipPath = path.join(outDir, name);
    const state = { status: 'running', startedAt: new Date().toISOString(), done: 0, edited: 0, plain: 0, skipped: 0, zip: zipPath };
    await writeExportState(project, state);
    void runExport(project, state, width).catch(async error => {
      await writeExportState(project, { ...state, status: 'error', error: error.message, finishedAt: new Date().toISOString() });
    });
    return { started: true, zip: zipPath };
  }

  async function runExport(project, state, width) {
    const zip = createZip(state.zip);
    const photos = Object.values(project.photos).filter(photo => effectiveDecision(photo) !== 'delete');
    state.total = photos.length;
    const lines = ['修图导出', `目录：${project.dir}`, `时间：${new Date().toLocaleString('zh-CN')}`, '', '修好的/  精修后的图', '原图/    没有修的照片（原样）', '标删的没有导出', ''];
    for (const photo of photos) {
      const source = path.join(project.dir, photo.file);
      try {
        const round = pickRound(photo);
        if (photo.missing) { state.skipped++; }
        else if (round) {
          const base = path.basename(photo.file, path.extname(photo.file));
          if (round.source === 'external' || (round.params && round.params.external)) {
            const stored = path.join(store.projectsDir, round.preview);
            await zip.addFile(`修好的/${base}-${round.style}.jpg`, stored);
          } else {
            const params = round.params || {};
            const resolved = await resolveStyle(params.style || round.style || project.style);
            const buf = await render(source, {
              style: params.base || resolved.base,
              crop: params.crop || null,
              adjust: { ...(resolved.adjust || {}), ...(params.adjust || {}) },
              local: params.local || null,
              width, quality: 92
            });
            await zip.add(`修好的/${base}-${round.style}.jpg`, buf);
          }
          state.edited++;
          lines.push(`修好的/${base}-${round.style}.jpg  ← ${photo.file}（${round.source || 'engine'} v${round.n}）`);
        } else {
          await zip.addFile(`原图/${photo.file}`, source);
          state.plain++;
        }
      } catch (error) {
        state.skipped++;
      }
      state.done++;
      if (state.done % 5 === 0) await writeExportState(project, state);
    }
    await zip.add('说明.txt', Buffer.from(lines.join('\n'), 'utf8'), { compress: true });
    const result = await zip.close();
    await writeExportState(project, { ...state, status: 'done', finishedAt: new Date().toISOString(), bytes: result.bytes, zip: state.zip });
  }

  async function readExportState(project) {
    try { return JSON.parse(await fs.readFile(path.join(store.projectsDir, project.id, 'export.json'), 'utf8')); }
    catch { return null; }
  }

  async function writeExportState(project, state) {
    const file = path.join(store.projectsDir, project.id, 'export.json');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(state));
  }

  async function purgeDeleted(id) {
    const project = await requireProject(id);
    const deleted = [];
    for (const photo of Object.values(project.photos)) {
      if (effectiveDecision(photo) !== 'delete' || photo.missing) continue;
      const full = path.resolve(project.dir, photo.file);
      if (!full.startsWith(path.resolve(project.dir) + path.sep)) continue;
      try { await fs.unlink(full); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      photo.missing = true;
      photo.deletedAt = new Date().toISOString();
      deleted.push(photo.id);
    }
    if (deleted.length) await store.save(project);
    return { deleted, dir: project.dir };
  }

  /** 联系表：默认取待初筛；可传 ids，或 files（项目目录内的绝对路径）。 */
  async function contactSheet(id, { ids, files, perSheet = 6 } = {}) {
    const project = await requireProject(id);
    let pool = [];
    if (Array.isArray(files) && files.length) {
      pool = files.map(file => {
        const absolute = path.resolve(file);
        if (!absolute.startsWith(path.resolve(project.dir) + path.sep) && !absolute.startsWith(path.resolve(store.projectsDir, project.id) + path.sep)) {
          throw Object.assign(new Error('文件不在项目目录内：' + file), { status: 400 });
        }
        return { id: path.basename(file), file: absolute, absolute: true };
      });
    } else {
      pool = (ids && ids.length ? ids : Object.keys(project.photos).filter(pid => !project.photos[pid].triage))
        .map(pid => project.photos[pid]).filter(photo => photo && !photo.missing);
    }
    if (!pool.length) return { sheets: [], note: '没有待处理照片' };
    const sheets = [];
    for (let start = 0; start < pool.length; start += perSheet) {
      const chunk = pool.slice(start, start + perSheet);
      const cell = 560, gap = 12, cols = 3;
      const rows = Math.ceil(chunk.length / cols);
      const tiles = [];
      for (let i = 0; i < chunk.length; i++) {
        const photo = chunk[i];
        const file = photo.absolute ? photo.file : path.join(project.dir, photo.file);
        const buf = await sharp(file).rotate().resize(cell, cell, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
        const x = (i % cols) * (cell + gap) + gap;
        const y = Math.floor(i / cols) * (cell + gap) + gap;
        const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${cell}">
          <rect x="8" y="8" width="74" height="38" rx="8" fill="#000" fill-opacity="0.62"/>
          <text x="45" y="36" font-family="sans-serif" font-size="24" font-weight="bold" fill="#fff" text-anchor="middle">${i + 1}</text></svg>`);
        tiles.push({ input: buf, left: x, top: y });
        tiles.push({ input: label, left: x, top: y });
      }
      const width = cols * (cell + gap) + gap;
      const height = rows * (cell + gap) + gap;
      const sheet = await sharp({ create: { width, height, channels: 3, background: '#141414' } })
        .composite(tiles).jpeg({ quality: 86 }).toBuffer();
      const file = path.join(store.projectsDir, project.id, 'sheets', `sheet-${Date.now()}-${start / perSheet + 1}.jpg`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, sheet);
      sheets.push({ file, ids: chunk.map(p => p.id) });
    }
    return { sheets, note: '每张表按编号顺序对应 ids；建议每张表判断完再写清单' };
  }

  return {
    open, rescan, state, setStyle, resolveStyle, learnStyle, listStyles, deleteStyle, decide, setFinal, bulkDecide, updateTriage, grade, retouch, ingest,
    exportArchive, purgeDeleted, saveNote, markNotesSent, contactSheet, summarize, publicPhoto,
    effectiveDecision, requireProject
  };
}
