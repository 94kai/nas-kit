import { mkdir, readFile, writeFile } from 'node:fs/promises';
// 客户端是单个模块加载器文件，构建只做复制，避免把私有路径或依赖打进产物。
const root = new URL('./', import.meta.url);
const source = await readFile(new URL('client.js', root), 'utf8');
if (!source.startsWith('window.__ModuleLoader__.load(')) throw new Error('client.js 不是模块加载器格式');
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/client.js', root), source);
console.log('Built @local/photo-lab client.');
