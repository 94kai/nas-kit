// 视频预览的字节通道：在 DSH 已认证的 /api 通道上按 Range 读文件。
// 原生预览把整文件读进内存（受 maxFileBytes 限制），视频动辄上百 MB，
// 所以视频走这里的分块读取：浏览器每段只取需要的字节，拖动进度也即时生效。
import { isAbsolute } from 'node:path'

export const inject = ['fs', 'connection']

const ROUTE = '/api/file-preview/media'
// 单次读取窗口：一次 Response 内按 4 MiB 逐块写出，内存占用与文件大小无关。
const WINDOW = 4 * 1024 * 1024
const MIME = {
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg',
  mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv', flv: 'video/x-flv', mpg: 'video/mpeg', mpeg: 'video/mpeg',
  m2ts: 'video/mp2t', '3gp': 'video/3gpp', '3g2': 'video/3gpp2', asf: 'video/x-ms-asf',
}
const IMMUTABLE = 'private, max-age=31536000, immutable'
const NO_STORE = 'private, no-store'

const extensionOf = path => {
  const match = /\.([A-Za-z0-9]+)$/.exec(path || '')
  return match ? match[1].toLowerCase() : ''
}

// 只认单段 Range；多段或畸形写法按无障碍处理，直接返回完整文件。
function parseRange(header, size) {
  if (typeof header !== 'string') return undefined
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (match === null) return undefined
  const [, startText, endText] = match
  if (startText === '' && endText === '') return 'unsatisfiable'
  if (startText === '') {
    const length = Number(endText)
    if (!Number.isFinite(length) || length <= 0) return 'unsatisfiable'
    return { start: Math.max(0, size - length), end: size - 1 }
  }
  const start = Number(startText)
  const end = endText === '' ? size - 1 : Math.min(Number(endText), size - 1)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size || end < start) return 'unsatisfiable'
  return { start, end }
}

// 逐窗口读文件并写进响应流；客户端断开时 request.signal 会中止后续读取。
function windowStream(fs, target, request, start, length) {
  let sent = 0
  return new ReadableStream({
    async pull(controller) {
      if (sent >= length) {
        controller.close()
        return
      }
      const bytes = await fs.readByteRange(
        target,
        { offset: start + sent, length: Math.min(WINDOW, length - sent) },
        request.signal,
      )
      if (bytes.byteLength === 0) {
        controller.close()
        return
      }
      sent += bytes.byteLength
      controller.enqueue(bytes)
      if (sent >= length) controller.close()
    },
  })
}

async function serve(request, fs) {
  const url = new URL(request.url)
  const path = url.searchParams.get('path')
  const fail = (status, text) => new Response(request.method === 'HEAD' ? null : text, {
    status,
    headers: { 'Cache-Control': NO_STORE, 'X-Content-Type-Options': 'nosniff' },
  })
  if (path === null || !isAbsolute(path) || /[\u0000-\u001f]/.test(path)) return fail(400, 'invalid path')

  let target
  let info
  try {
    target = await fs.resolve(path, { signal: request.signal })
    info = await fs.stat(target, request.signal)
  } catch (error) {
    const code = error && error.code
    if (code === 'FS_PERMISSION_DENIED' || code === 'FS_SANDBOX_DENIED') return fail(403, 'denied')
    if (code === 'FS_NOT_FOUND') return fail(404, 'not found')
    throw error
  }
  if (info === undefined) return fail(404, 'not found')
  if (info.type !== 'file') return fail(403, 'not a regular file')

  const size = typeof info.size === 'number' ? info.size : 0
  const headers = {
    'Content-Type': MIME[extensionOf(path)] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    // 地址里带着文件版本时可长期缓存，改了文件版本也就变了。
    'Cache-Control': url.searchParams.get('v') === info.version ? IMMUTABLE : NO_STORE,
  }
  if (size === 0) return new Response(request.method === 'HEAD' ? null : new Uint8Array(0), {
    headers: { ...headers, 'Content-Length': '0' },
  })

  const range = parseRange(request.headers.get('range'), size)
  if (range === 'unsatisfiable') return new Response(null, {
    status: 416,
    headers: { ...headers, 'Content-Range': `bytes */${size}` },
  })
  const start = range === undefined ? 0 : range.start
  const end = range === undefined ? size - 1 : range.end
  const length = end - start + 1
  const responseHeaders = {
    ...headers,
    'Content-Length': String(length),
    ...range === undefined ? {} : { 'Content-Range': `bytes ${start}-${end}/${size}` },
  }
  const status = range === undefined ? 200 : 206
  if (request.method === 'HEAD') return new Response(null, { status, headers: responseHeaders })
  return new Response(windowStream(fs, target, request, start, length), { status, headers: responseHeaders })
}

// Host 侧只为视频播放提供一个字节路由，其余都在浏览器里完成。
export function apply(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE,
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: request => serve(request, ctx.fs),
  }), 'file-preview: media route')
}
