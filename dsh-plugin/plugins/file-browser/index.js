/**
 * 文件浏览 · Host 半边：只读目录列举，供左侧栏的全局「文件」页使用。
 *
 * 与内置工作区文件树不同，这里不把路径限制在会话工作目录内：路由挂在 DSH
 * 连接层的共享 `/api` 通道上，只有已认证的同源所有者能读到；读权限与 Agent
 * 自己的文件读取一致。只有列举，没有写入、删除、重命名或上传路由。
 */
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export const inject = ['connection'];

/** 一层目录最多返回的条目数，避免超大目录把响应撑爆。 */
const MAX_ENTRIES = 2000;
/** 元数据并发数：目录里可能有几千个条目，逐个 stat 串行太慢。 */
const STAT_CONCURRENCY = 24;

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

class BrowseError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** `~` 展开成进程用户的主目录；其余必须是绝对路径。 */
function absolutePath(input) {
  const expanded = input === '~'
    ? homedir()
    : input.startsWith('~/') ? path.join(homedir(), input.slice(2)) : input;
  if (!path.isAbsolute(expanded)) {
    throw new BrowseError(400, 'invalid_path', '路径必须是绝对路径。');
  }
  return path.resolve(expanded);
}

/** 把 Node 的 errno 翻成页面能直接展示的分类。 */
function refused(error) {
  if (error instanceof BrowseError) return error;
  switch (error?.code) {
    case 'ENOENT':
      return new BrowseError(404, 'not_found', '这个目录不在了。可能已被移动或删除。');
    case 'EACCES':
    case 'EPERM':
      return new BrowseError(403, 'permission_denied', '没有权限读取这个目录。');
    case 'ENOTDIR':
      return new BrowseError(400, 'not_directory', '这不是一个目录。');
    case 'ELOOP':
      return new BrowseError(400, 'invalid_path', '路径里的符号链接形成了环。');
    default:
      return new BrowseError(500, 'list_failed', `读取目录失败${error?.code ? `（${error.code}）` : ''}。`);
  }
}

/** 文件大小与修改时间；坏链接只退化成「其他」，不拖垮整层列表。 */
async function metadata(fullPath) {
  try {
    const info = await stat(fullPath);
    return {
      kind: info.isDirectory() ? 'dir' : info.isFile() ? 'file' : 'other',
      ...info.isFile() ? { size: info.size } : {},
      ...Number.isFinite(info.mtimeMs) ? { mtimeMs: Math.round(info.mtimeMs) } : {},
    };
  } catch {
    return { kind: 'other' };
  }
}

/**
 * 列举一层目录：目录优先、按名称自然排序，截断后再读元数据。
 * @param {string} input 绝对路径或 `~` 开头的路径；空串表示主目录。
 * @param {boolean} showHidden 是否包含 `.` 开头的条目。
 */
async function list(input, showHidden) {
  const target = absolutePath(input === '' ? '~' : input);
  let dirents;
  try {
    dirents = await readdir(target, { withFileTypes: true });
  } catch (error) {
    throw refused(error);
  }
  const visible = dirents.filter(dirent => showHidden || !dirent.name.startsWith('.'));
  // 先按条目类型和名字排好再截断，超大目录里就不必 stat 不会返回的条目。
  const ordered = visible
    .map(dirent => ({ name: dirent.name, link: dirent.isSymbolicLink(), dir: dirent.isDirectory() }))
    .sort((left, right) => (left.dir === right.dir ? 0 : left.dir ? -1 : 1) || collator.compare(left.name, right.name));
  const truncated = ordered.length > MAX_ENTRIES;
  const kept = ordered.slice(0, MAX_ENTRIES);

  const entries = new Array(kept.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < kept.length) {
      const index = cursor;
      cursor += 1;
      const dirent = kept[index];
      const fullPath = path.join(target, dirent.name);
      entries[index] = { name: dirent.name, path: fullPath, link: dirent.link, ...await metadata(fullPath) };
    }
  };
  await Promise.all(Array.from({ length: Math.min(STAT_CONCURRENCY, kept.length) }, worker));

  const parent = path.dirname(target);
  return {
    path: target,
    parent: parent === target ? null : parent,
    home: homedir(),
    count: entries.length,
    truncated,
    entries,
  };
}

async function handler(request) {
  const url = new URL(request.url);
  try {
    const listing = await list(url.searchParams.get('path') ?? '', url.searchParams.get('hidden') === '1');
    return Response.json(listing, { headers });
  } catch (error) {
    const refusal = refused(error);
    return Response.json({ error: refusal.code, message: refusal.message }, { status: refusal.status, headers });
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/file-browser',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: handler,
  }));
}
