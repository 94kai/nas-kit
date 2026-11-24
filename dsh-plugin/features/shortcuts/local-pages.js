import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, realpath, rename, stat, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, extname, resolve } from 'node:path';

// Registered local HTML pages. Files stay where they are; only the path is
// stored, so regenerated reports are served fresh on the next open.
export const defaultLocalPagesFile = new URL('../../.local/local-pages.json', import.meta.url);
const maxBytes = 16 * 1024 * 1024;
const maxItems = 200;
const jsonHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const pageHeaders = {
  ...jsonHeaders,
  'Content-Type': 'text/html; charset=utf-8',
  // User-generated HTML shares the DSH origin. An opaque sandbox origin keeps it
  // from reading authenticated DSH APIs; inline scripts and charts still run.
  'Content-Security-Policy': 'sandbox allow-scripts allow-popups allow-forms allow-modals',
  'Referrer-Policy': 'no-referrer',
};
const queues = new Map();
const digest = raw => createHash('sha256').update(raw).digest('hex');

class InputError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const storeFile = file => (file instanceof URL ? fileURLToPath(file) : resolve(file));

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };
function titleOf(raw) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  if (!match) return '';
  return match[1].replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39|apos);/gi, (_, name) => entities[name.toLowerCase()]).replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function publicPage(item) {
  if (!item || typeof item.id !== 'string' || !item.id || typeof item.title !== 'string' || !item.title.trim() || typeof item.path !== 'string' || !item.path) throw new TypeError('Invalid local page');
  const result = { id: item.id, kind: 'local', title: item.title, path: item.path, url: `/api/shortcuts/local-pages/content?id=${encodeURIComponent(item.id)}` };
  if (typeof item.addedAt === 'string') result.addedAt = item.addedAt;
  return result;
}

export function createLocalPages({ file = defaultLocalPagesFile } = {}) {
  const target = storeFile(file);
  async function load() {
    let raw;
    try { raw = await readFile(target, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; raw = '[]'; }
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) throw new TypeError('Invalid local page list');
    return { items, snapshot: { items: items.map(publicPage), revision: digest(raw) } };
  }
  async function save(items) {
    const temporary = `${target}.${randomUUID()}.tmp`;
    let handle, created = false;
    try {
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      handle = await open(temporary, 'wx', 0o600); created = true;
      const raw = `${JSON.stringify(items, null, 2)}\n`;
      await handle.writeFile(raw, 'utf8'); await handle.sync(); await handle.close(); handle = undefined;
      if (dirname(temporary) !== dirname(target) || temporary === target) throw new Error('Invalid temporary path');
      await rename(temporary, target); created = false;
      return { items: items.map(publicPage), revision: digest(raw) };
    } finally {
      if (handle) await handle.close().catch(() => {});
      if (created && dirname(temporary) === dirname(target) && temporary !== target) await unlink(temporary).catch(() => {});
    }
  }
  // Serialize writes inside this process; the CLI is meant to run while the
  // page list is idle, so a cross-process lock is deliberately not added.
  const serialize = run => {
    const previous = queues.get(target) ?? Promise.resolve();
    const result = previous.then(run, run);
    const tail = result.catch(() => {});
    queues.set(target, tail);
    void tail.then(() => { if (queues.get(target) === tail) queues.delete(target); });
    return result;
  };
  return {
    async list() { return (await load()).snapshot; },
    async add(input) {
      if (!input || typeof input.path !== 'string') throw new InputError(400, '请提供 HTML 文件路径。');
      const requested = input.path.trim();
      if (!requested || requested.length > 4096) throw new InputError(400, '路径为空或过长。');
      if (!['.html', '.htm'].includes(extname(requested).toLowerCase())) throw new InputError(400, '只能注册 .html 或 .htm 文件。');
      const path = resolve(requested);
      let info;
      try { info = await stat(path); } catch { throw new InputError(404, `找不到文件：${path}`); }
      if (!info.isFile()) throw new InputError(400, '路径不是文件。');
      if (info.size > maxBytes) throw new InputError(413, 'HTML 文件超过 16 MiB。');
      const canonical = await realpath(path);
      let title = typeof input.title === 'string' ? input.title.trim().slice(0, 200) : '';
      if (!title) title = titleOf(await readFile(canonical, 'utf8')) || basename(canonical, extname(canonical));
      return serialize(async () => {
        const { items } = await load();
        const existing = items.find(item => item.path === canonical);
        if (existing) {
          const changed = existing.title !== title;
          existing.title = title;
          return changed ? save(items) : (await load()).snapshot;
        }
        if (items.length >= maxItems) throw new InputError(400, `最多注册 ${maxItems} 个本地页面。`);
        items.push({ id: randomUUID(), title, path: canonical, addedAt: new Date().toISOString() });
        return save(items);
      });
    },
    async remove(id) {
      return serialize(async () => {
        const { items } = await load();
        const index = items.findIndex(item => item.id === id);
        if (index === -1) throw new InputError(404, '这个本地页面已不存在。');
        items.splice(index, 1);
        return save(items);
      });
    },
    async read(id) {
      const { items } = await load();
      return items.find(item => item.id === id) || null;
    },
  };
}

export function createLocalPagesHandler(store) {
  return async request => {
    try {
      if (!request || request.method === 'GET') return Response.json(await store.list(), { headers: jsonHeaders });
      if (request.method !== 'POST') throw new InputError(405, '仅支持 GET 和 POST。');
      const site = request.headers.get('sec-fetch-site');
      if (request.headers.get('x-pocket-kit') !== '1' || (site && !['same-origin', 'none'].includes(site))) throw new InputError(403, '请从当前工具箱页面操作。');
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new InputError(415, '需要 JSON 请求。');
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 8 * 1024) throw new InputError(413, '输入内容过长。');
      let input;
      try { input = JSON.parse(raw); } catch { throw new InputError(400, 'JSON 格式无效。'); }
      if (input && input.action === 'remove') {
        if (typeof input.id !== 'string' || !input.id) throw new InputError(400, '缺少要移除的 id。');
        return Response.json(await store.remove(input.id), { headers: jsonHeaders });
      }
      return Response.json(await store.add(input), { headers: jsonHeaders });
    } catch (error) {
      const status = error instanceof InputError ? error.status : 500;
      return Response.json({ error: error instanceof InputError ? error.message : '本地页面存储失败。' }, { status, headers: jsonHeaders });
    }
  };
}

export function createLocalPageContentHandler(store) {
  return async request => {
    const fail = (status, message) => new Response(message, { status, headers: { ...jsonHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });
    try {
      const id = new URL(request.url).searchParams.get('id');
      const item = id ? await store.read(id) : null;
      if (!item) return fail(404, '没有找到这个本地页面，可能已从工具箱移除。');
      const [body, info] = await Promise.all([readFile(item.path), stat(item.path)]);
      if (info.size > maxBytes) return fail(413, '本地页面超过 16 MiB。');
      return new Response(body, { headers: pageHeaders });
    } catch (error) {
      return error.code === 'ENOENT' ? fail(404, '本地页面文件已不存在。') : fail(500, '本地页面读取失败。');
    }
  };
}
