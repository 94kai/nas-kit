// DSH 会话搜索宿主补丁：让 FTS5 索引支持中文按字切分。
// 只处理 @deepseek-ai/dsh-session-query-sqlite 的构建产物 lib/index.js，不读写任何会话数据。
// 用法：node features/session-search/patch.mjs /absolute/dsh-install [--check|--apply|--rollback manifest.json]
import { readFile, writeFile, mkdir, realpath, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';

const requested = process.argv[2], mode = process.argv[3] || '--check';
if (!requested || !path.isAbsolute(requested) || !['--check', '--apply', '--rollback'].includes(mode)) {
  throw Error('Usage: node features/session-search/patch.mjs /absolute/dsh-install [--check|--apply|--rollback manifest.json]');
}
const base = await realpath(requested);
const packageDir = await realpath(path.join(base, 'node_modules/@deepseek-ai/dsh-session-query-sqlite')).catch(() => {
  throw Error('Not a DSH install directory: ' + base + '/node_modules/@deepseek-ai/dsh-session-query-sqlite');
});
const pkg = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'));
if (pkg.name !== '@deepseek-ai/dsh-session-query-sqlite') throw Error('Not the session-query-sqlite package');

const target = path.join(packageDir, 'lib/index.js');
if (await realpath(target) !== target) throw Error('Refusing redirected artifact: ' + target);
const backupDir = new URL('../../.local/session-search-patch/', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');

const CJK = String.raw`[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]`;
const MARKER = 'function segmentCjk(';

// FTS5 的 unicode61 把整段连续汉字当成一个 token，查询又被整体加引号成短语，
// 所以 token 级精确匹配下中文子串永远搜不到。索引与查询两侧都按字拆开即可对齐。
const helper = `
const CJK_RUN = /${CJK}+/gu
/** CJK 按字切分，使 unicode61 下的子串查询可以命中。 */
function segmentCjk(text) {
	return text.replace(CJK_RUN, run => Array.from(run).join(" "))
}
`;

// [锚点, 替换, 期望出现次数, 说明]
const edits = [
  ['return sanitizeFtsText(query);', 'return segmentCjk(sanitizeFtsText(query));', 1, '查询侧切分'],
  ['const text = sanitizeFtsText(document.text);', 'const text = segmentCjk(sanitizeFtsText(document.text));', 2, '建索引侧切分'],
  [
    'return `${prefix}${characters.slice(start, end).join("")}${suffix}`;',
    `return \`\${prefix}\${characters.slice(start, end).join("")}\${suffix}\`.replace(/(?<=${CJK}) (?=${CJK})/gu, "");`,
    1,
    '摘要回显去掉切分空格',
  ],
];

function syntax(source) {
  const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source, encoding: 'utf8' });
  if (result.status !== 0) throw Error('Syntax validation failed; no target written: ' + result.stderr);
}

function patch(source) {
  if (source.includes(MARKER)) return source;
  const anchor = 'function sanitizeFtsText(text) {';
  const start = source.indexOf(anchor);
  if (start < 0) throw Error('Unsupported DSH session-search artifact: sanitizeFtsText not found; stop and inspect the new version');
  const end = source.indexOf('\n}\n', start);
  if (end < 0) throw Error('Unsupported DSH session-search artifact: sanitizeFtsText body not found');
  let updated = source.slice(0, end + 2) + helper + source.slice(end + 2);
  for (const [from, to, count, label] of edits) {
    const found = updated.split(from).length - 1;
    if (found !== count) throw Error(`Unsupported DSH session-search artifact: ${label} expected ${count} site(s), found ${found}; stop and inspect the new version`);
    updated = updated.split(from).join(to);
  }
  syntax(updated);
  return updated;
}

if (mode === '--rollback') {
  const manifestPath = process.argv[4];
  if (!manifestPath || !path.isAbsolute(manifestPath)) throw Error('Pass the absolute backup manifest path');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.base !== base || manifest.version !== pkg.version) throw Error('Backup belongs to another installation/version');
  if (!Array.isArray(manifest.files) || manifest.files.length !== 1) throw Error('Invalid backup manifest');
  const [entry] = manifest.files;
  if (entry.name !== 'lib/index.js') throw Error('Invalid backup entry');
  if (!/^[a-f0-9]{64}$/.test(entry.originalHash) || !/^[a-f0-9]{64}$/.test(entry.patchedHash)) throw Error('Invalid backup hash');
  const current = await readFile(target, 'utf8');
  const original = await readFile(new URL(entry.originalHash + '.original', backupDir), 'utf8');
  if (hash(current) !== entry.patchedHash || hash(original) !== entry.originalHash) throw Error('Hash mismatch; refusing rollback');
  syntax(original);
  await writeFile(target, original);
  console.log('Restored ' + target + '; sha256 ' + entry.originalHash);
  process.exit(0);
}

const original = await readFile(target, 'utf8');
const updated = patch(original);
if (updated === original) {
  console.log('already current; ' + target + '; package ' + pkg.version);
  process.exit(0);
}
if (mode === '--check') {
  console.log('CHECK ONLY: 1 file(s); no files written. Package ' + pkg.version);
  console.log('compatible, change planned; ' + target);
  process.exit(0);
}

await mkdir(backupDir, { recursive: true, mode: 0o700 });
const originalHash = hash(original), patchedHash = hash(updated);
const backup = new URL(originalHash + '.original', backupDir);
await writeFile(backup, original, { flag: 'wx', mode: 0o600 })
  .catch(async error => {
    if (error.code !== 'EEXIST') throw error;
    if (hash(await readFile(backup, 'utf8')) !== originalHash) throw Error('Backup hash mismatch');
  });
const manifest = {
  base,
  version: pkg.version,
  createdAt: new Date().toISOString(),
  files: [{ name: 'lib/index.js', originalHash, patchedHash }],
};
const manifestFile = new URL('manifest-' + Date.now() + '.json', backupDir);
await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log('Rollback manifest: ' + manifestFile.pathname);
if (hash(await readFile(target, 'utf8')) !== originalHash) throw Error('Artifact changed during patch; stop');
await writeFile(target, updated);
console.log('Patched ' + target + '; sha256 ' + patchedHash);
