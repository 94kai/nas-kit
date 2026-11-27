import { constants as F } from 'node:fs'
import { lstat, open, opendir, readFile, realpath, rmdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname } from 'node:path'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'

export const inject = ['connection']

const PREFIX = '/api/local-files/'
const JSON_LIMIT = 16 * 1024
const TEXT_LIMIT = 1024 * 1024
const DIR_LIMIT = 10000
const safeHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "sandbox; default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'Referrer-Policy': 'no-referrer',
}
const media = new Map(Object.entries({
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
}))

function fail(status, message, headers) {
  throw Object.assign(new Error(message), { status, headers })
}
function json(value, status = 200, headers) {
  return Response.json(value, { status, headers: { ...safeHeaders, ...headers } })
}
function safeName(name) {
  if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\/\\\u0000-\u001f\u007f]/u.test(name) || name !== name.toWellFormed() || Buffer.byteLength(name) > 255) fail(400, '文件名无效')
  return name
}
function partsOf(path, home) {
  if (typeof path !== 'string' || Buffer.byteLength(path) > 4096) fail(400, '路径无效')
  const absolute = path.startsWith('/')
  const value = absolute ? path.slice(1) : path
  const parts = value === '' ? [] : value.split('/').map(safeName)
  return absolute ? parts : [...home, ...parts]
}
const fullPath = parts => '/' + parts.join('/')
const within = (parts, root) => parts.length >= root.length && root.every((name, i) => parts[i] === name)
const virtualDir = parts => ['proc', 'sys', 'dev'].includes(parts[0])
const protectedEntry = (parts, home) => virtualDir(parts) || within(home, parts)
const proc = h => `/proc/self/fd/${h.fd}`
const dirFlags = F.O_DIRECTORY | F.O_NOFOLLOW | F.O_RDONLY

// 每一级通过已打开的目录描述符定位；不从经检查的字符串绝对路径重新打开文件。
async function inDir(parts, fn) {
  if (process.platform !== 'linux') fail(501, '此文件服务需要 Linux')
  if (virtualDir(parts)) fail(403, '不开放内核与设备目录')
  let h = await open('/', dirFlags)
  try {
    for (const part of parts) {
      const next = await open(`${proc(h)}/${part}`, dirFlags)
      await h.close()
      h = next
    }
    return await fn(h)
  } finally { await h.close() }
}

function typeOf(stat) {
  return stat.isDirectory() ? 'dir' : stat.isFile() ? 'file' : stat.isSymbolicLink() ? 'link' : 'other'
}
async function list(parts, showHidden, signal, home) {
  return inDir(parts, async h => {
    const entries = []
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
    for await (const entry of await opendir(proc(h), { encoding: 'buffer' })) {
      signal.throwIfAborted()
      let name
      // 跳过无法用 JSON 路径无损往返的字节名，避免误操作同目录的另一项。
      try { name = decoder.decode(entry.name) } catch { continue }
      if (!showHidden && name.startsWith('.')) continue
      if (entries.length >= DIR_LIMIT) fail(413, '目录中的项目过多，无法一次列出')
      let stat
      try { stat = await lstat(`${proc(h)}/${name}`) }
      catch (e) { if (e.code === 'ENOENT') continue; throw e }
      const child = [...parts, name]
      entries.push({ name, path: fullPath(child), protected: protectedEntry(child, home), type: typeOf(stat), size: stat.size, mtime: stat.mtimeMs })
    }
    return { entries }
  })
}

async function plainFile(parts) {
  if (!parts.length) fail(400, '请选择普通文件')
  return inDir(parts.slice(0, -1), async parent => {
    // Linux O_PATH：先固定 inode 再判型，避免打开设备、FIFO 或符号链接目标。
    const node = await open(`${proc(parent)}/${parts.at(-1)}`, 0x200000 | F.O_NOFOLLOW)
    try {
      if (!(await node.stat()).isFile()) fail(403, '只能读取普通文件，不能打开链接或设备')
      return await open(proc(node), F.O_RDONLY)
    } finally { await node.close() }
  })
}

async function text(parts) {
  const h = await plainFile(parts)
  try {
    const { size } = await h.stat()
    if (size > TEXT_LIMIT) fail(413, '文本预览上限为 1 MiB，请下载查看')
    const buffer = Buffer.allocUnsafe(TEXT_LIMIT + 1)
    let total = 0
    while (total <= TEXT_LIMIT) {
      const { bytesRead } = await h.read(buffer, total, buffer.length - total, total)
      if (!bytesRead) break
      total += bytesRead
    }
    if (total > TEXT_LIMIT) fail(413, '文本预览上限为 1 MiB，请下载查看')
    const bytes = buffer.subarray(0, total)
    if (bytes.includes(0)) fail(415, '不是可预览的 UTF-8 文本')
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) } }
    catch { fail(415, '不是可预览的 UTF-8 文本') }
  } finally { await h.close() }
}

function rangeOf(header, size) {
  if (header === null) return { start: 0, end: size - 1 }
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  const invalid = () => fail(416, '请求的文件范围无效', { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' })
  if (!m || (!m[1] && !m[2]) || !size) invalid()
  const a = Number(m[1]), b = Number(m[2])
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) invalid()
  const start = m[1] ? a : Math.max(size - b, 0)
  const end = m[1] && m[2] ? Math.min(b, size - 1) : size - 1
  if (start > end) invalid()
  return { start, end }
}
async function content(request, home) {
  const query = new URL(request.url).searchParams
  const parts = partsOf(query.get('path'), home)
  const h = await plainFile(parts)
  let streaming = false
  try {
    const { size } = await h.stat()
    const range = request.headers.get('range')
    const { start, end } = rangeOf(range, size)
    const name = parts.at(-1)
    const mime = media.get(extname(name).slice(1).toLowerCase())
    const attachment = query.get('download') === '1' || !mime
    const headers = {
      ...safeHeaders,
      'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1),
      'Content-Type': attachment ? 'application/octet-stream' : mime,
      'Content-Disposition': `${attachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}`,
    }
    if (range !== null) headers['Content-Range'] = `bytes ${start}-${end}/${size}`
    const init = { status: range === null ? 200 : 206, headers }
    if (request.method === 'HEAD' || !size) return new Response(null, init)
    const stream = h.createReadStream({ start, end, autoClose: true, signal: request.signal })
    streaming = true
    return new Response(Readable.toWeb(stream, { strategy: { highWaterMark: 1 } }), init)
  } finally { if (!streaming) await h.close() }
}

// Node 的 rename() 会覆盖并发出现的目标。用 Linux 原子 NOREPLACE，不做预检+覆盖式 rename 的退化。
const renameProgram = `import ctypes, errno, os, sys
c = ctypes.CDLL(None, use_errno=True)
if not hasattr(c, 'renameat2'): sys.exit(errno.ENOSYS)
f = c.renameat2
f.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint)
src, dst = sys.stdin.buffer.read().split(b'\\0')
sys.exit(ctypes.get_errno() if f(3, src, 4, dst, 1) != 0 else 0)`
function renameExclusive(source, name, dest, newName) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/python3', ['-I', '-S', '-c', renameProgram], { stdio: ['pipe', 'ignore', 'ignore', source.fd, dest.fd] })
    child.stdin.on('error', () => {}) // 拒绝原因取自 spawn 或 exit。
    child.once('error', () => reject(Object.assign(new Error('无法使用安全移动功能（需要系统 Python 3）'), { status: 501 })))
    child.once('close', code => {
      if (code === 0) return resolve()
      const errors = { 2: [404, '项目已不存在'], 13: [403, '没有操作权限'], 17: [409, '目标已存在，不会覆盖'], 18: [409, '不支持跨文件系统移动'], 22: [400, '目标目录无效或文件系统不支持安全移动'], 38: [501, '系统不支持安全移动'], 95: [501, '文件系统不支持安全移动'] }
      const [status, message] = errors[code] || [409, '无法移动该项目']
      reject(Object.assign(new Error(message), { status }))
    })
    child.stdin.end(Buffer.from(`${name}\0${newName}`))
  })
}

// 按目录描述符递归；链接只 unlink，遇到子挂载（含 bind mount）停止，不删除挂载的数据。
async function mountId(h) {
  const info = await readFile(`/proc/self/fdinfo/${h.fd}`, 'utf8')
  const id = /^mnt_id:\s*(\d+)$/m.exec(info)?.[1]
  if (!id) fail(501, '无法确认挂载边界，已停止删除')
  return id
}
async function removeEntry(parent, name, boundary) {
  // 内部名字可能不是 UTF-8，使用内核返回的原始字节，不误删同形名称。
  const path = Buffer.concat([Buffer.from(proc(parent) + '/'), Buffer.from(name)])
  const stat = await lstat(path)
  if (!stat.isDirectory()) return unlink(path)
  const h = await open(path, dirFlags)
  try {
    if (await mountId(h) !== boundary) fail(409, '目录包含挂载点，已停止删除')
    for await (const entry of await opendir(proc(h), { encoding: 'buffer' })) {
      await removeEntry(h, entry.name, boundary)
    }
    await rmdir(path)
  } finally { await h.close() }
}

async function mutate(action, parts, data, home) {
  if (protectedEntry(parts, home)) fail(403, '不能修改这个受保护的目录本身')
  const name = parts.at(-1)
  return inDir(parts.slice(0, -1), async parent => {
    const path = `${proc(parent)}/${name}`
    const stat = await lstat(path)
    if (action === 'delete') {
      if (stat.isDirectory()) await removeEntry(parent, name, await mountId(parent))
      else await unlink(path) // 符号链接仅移除目录项，不接触其目标。
    } else if (action === 'rename') {
      const newName = safeName(data.name)
      if (name === newName) fail(409, '名称没有变化')
      await renameExclusive(parent, name, parent, newName)
    } else {
      const dest = partsOf(data.destination, home)
      if (stat.isDirectory() && parts.length <= dest.length && parts.every((part, i) => part === dest[i])) fail(400, '不能移入自身或其子目录')
      await inDir(dest, target => renameExclusive(parent, name, target, name))
    }
    return { ok: true }
  })
}

async function body(request) {
  if (request.headers.get('x-local-files') !== '1') fail(403, '缺少文件管理器请求标记')
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) fail(415, '仅接受 JSON 请求')
  if (Number(request.headers.get('content-length')) > JSON_LIMIT) fail(413, '请求内容过大')
  let size = 0
  const chunks = []
  if (request.body) for await (const chunk of request.body) {
    size += chunk.length
    if (size > JSON_LIMIT) fail(413, '请求内容过大')
    chunks.push(chunk)
  }
  let data
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { fail(400, 'JSON 格式无效') }
  if (!data || Array.isArray(data) || typeof data !== 'object') fail(400, '请求内容无效')
  return data
}
const fsErrors = { ENOENT: [404, '项目不存在或已移动'], ENOTDIR: [403, '不是可访问的目录（不能进入符号链接）'], ELOOP: [403, '不能跟随符号链接'], EPERM: [403, '没有操作权限'], EACCES: [403, '没有操作权限'], EROFS: [403, '文件系统为只读'], ENOTEMPTY: [409, '目录非空，不能删除'], EBUSY: [409, '项目正被占用'], EEXIST: [409, '目标已存在'] }
async function dispatch(action, request) {
  try {
    const home = (await realpath(homedir())).split('/').filter(Boolean)
    if (action === 'content') return await content(request, home)
    const data = await body(request)
    const parts = partsOf(data.path, home)
    if (action === 'list') return json({path: fullPath(parts), home: fullPath(home), ...await list(parts, data.showHidden === true, request.signal, home)})
    if (action === 'text') return json(await text(parts))
    return json(await mutate(action, parts, data, home))
  } catch (e) {
    const [status, error] = e.status ? [e.status, e.message] : fsErrors[e.code] || [500, '文件操作失败']
    return json({ error }, status, e.headers)
  }
}
export function apply(ctx) {
  for (const action of ['list', 'rename', 'move', 'delete', 'text', 'content']) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: PREFIX + action, methods: action === 'content' ? ['GET', 'HEAD'] : ['POST'],
      requestBody: action === 'content' ? 'buffered' : 'streaming', fetch: req => dispatch(action, req),
    }), `local-files: ${action}`)
  }
}
