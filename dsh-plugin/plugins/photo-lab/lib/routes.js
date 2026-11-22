import { promises as fs } from 'node:fs';
import path from 'node:path';

const JSON_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const MAX_BODY = 1024 * 1024;

class BadRequest extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new BadRequest('请求内容过大', 413);
  try { return JSON.parse(text || '{}'); } catch { throw new BadRequest('请求不是有效的 JSON'); }
}

function fail(error) {
  const status = error.status || 500;
  const message = status >= 500 ? '工作台服务出错，请重试' : error.message;
  return Response.json({ error: message }, { status, headers: JSON_HEADERS });
}

export function createApi({ service, store }) {
  async function command(request) {
    if (request.headers.get('x-photo-lab') !== '1') throw new BadRequest('缺少工作台请求标识', 403);
    const site = request.headers.get('sec-fetch-site');
    if (site && !['same-origin', 'none'].includes(site)) throw new BadRequest('拒绝跨站请求', 403);
    if (!request.headers.get('content-type')?.includes('application/json')) throw new BadRequest('需要 JSON 请求', 415);
    const body = await readJson(request);
    const action = body.action;
    switch (action) {
      case 'open': return Response.json(await service.open({ sessionId: body.sessionId, dir: body.dir }), { headers: JSON_HEADERS });
      case 'rescan': return Response.json(await service.rescan(body.projectId), { headers: JSON_HEADERS });
      case 'state': return Response.json(await service.state(body.projectId), { headers: JSON_HEADERS });
      case 'style': return Response.json(await service.setStyle(body.projectId, body.style), { headers: JSON_HEADERS });
      case 'decide': return Response.json(await service.decide(body.projectId, body.id, { state: body.state, note: body.note, tags: body.tags }), { headers: JSON_HEADERS });
      case 'bulk': return Response.json(await service.bulkDecide(body.projectId, body.ids, body.state), { headers: JSON_HEADERS });
      case 'grade': return Response.json(await service.grade(body.projectId, {
        ids: body.ids, items: body.items, style: body.style, adjust: body.adjust,
        local: body.local, size: body.size, mask_preview: body.mask_preview
      }), { headers: JSON_HEADERS });
      case 'retouch': return Response.json(await service.retouch(body.projectId, {
        ids: body.ids, items: body.items, size: body.size, auto: body.auto
      }), { headers: JSON_HEADERS });
      case 'ingest': return Response.json(await service.ingest(body.projectId, {
        photoId: body.id, file: body.file, as_round: body.as_round, set_final: body.set_final,
        note: body.note, params: body.params
      }), { headers: JSON_HEADERS });
      case 'final': return Response.json(await service.setFinal(body.projectId, body.id, body.round), { headers: JSON_HEADERS });
      case 'export': return Response.json(await service.exportArchive(body.projectId, { size: body.size }), { headers: JSON_HEADERS });
      case 'purge': return Response.json(await service.purgeDeleted(body.projectId), { headers: JSON_HEADERS });
      case 'note': return Response.json(await service.saveNote(body.projectId, body.id, body.note), { headers: JSON_HEADERS });
      case 'notesSent': return Response.json(await service.markNotesSent(body.projectId, body.ids), { headers: JSON_HEADERS });
      default: throw new BadRequest('不支持的操作');
    }
  }

  async function stateGet(request) {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('p');
    if (!projectId) throw new BadRequest('缺少项目');
    return Response.json(await service.state(projectId), { headers: JSON_HEADERS });
  }

  async function asset(request) {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('p');
    const photoId = url.searchParams.get('id');
    const kind = url.searchParams.get('k') || 'thumb';
    if (!projectId || !photoId) throw new BadRequest('缺少参数');
    const project = await service.requireProject(projectId);
    const photo = project.photos[photoId];
    if (!photo) throw new BadRequest('照片不存在', 404);
    let file;
    if (kind === 'thumb') file = path.join(store.projectsDir, projectId, 'thumbs', `${photoId}.jpg`);
    else if (kind === 'before') {
      const round = Number(url.searchParams.get('r'));
      const list = photo.rounds || [];
      const target = list.find(item => item.n === round) || list[list.length - 1];
      file = target && target.before
        ? path.join(store.projectsDir, target.before)
        : path.join(store.projectsDir, projectId, 'previews', `${photoId}.jpg`);
    }
    else if (kind === 'after') {
      const round = Number(url.searchParams.get('r'));
      const list = photo.rounds || [];
      const target = (Number.isFinite(round) ? list.find(item => item.n === round) : null) || list[list.length - 1];
      if (!target) throw new BadRequest('还没有修图结果', 404);
      file = path.join(store.projectsDir, target.preview);
    } else if (kind === 'original') {
      file = path.join(store.projectsDir, projectId, 'previews', `${photoId}.jpg`);
    } else if (kind === 'mask') {
      const round = Number(url.searchParams.get('r'));
      const list = photo.rounds || [];
      const target = (Number.isFinite(round) ? list.find(item => item.n === round) : null) || list[list.length - 1];
      if (!target || !target.mask) throw new BadRequest('没有遮罩预览', 404);
      file = path.join(store.projectsDir, target.mask);
    } else throw new BadRequest('未知的资源类型');
    const buf = await fs.readFile(file).catch(() => null);
    if (!buf) throw new BadRequest('图片不存在，请重新扫描', 404);
    return new Response(buf, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=120', 'X-Content-Type-Options': 'nosniff' } });
  }

  async function upload(request) {
    // 手机拍照后补图：still 走 open/rescan，不接收二进制上传。
    return Response.json({ error: '请把照片放进目录后点「扫描新增」' }, { status: 400, headers: JSON_HEADERS });
  }

  return { command, stateGet, asset, upload, fail };
}
