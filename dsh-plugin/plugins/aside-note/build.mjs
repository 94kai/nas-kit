import { mkdir, readFile, writeFile } from 'node:fs/promises';

// 只拼装本插件自己的三个源码文件，不扫描目录：产物里不含任何私有数据。
const root = new URL('./', import.meta.url);
const source = await readFile(new URL('client.js', root), 'utf8');
const model = (await readFile(new URL('client-model.js', root), 'utf8')).replace(/^export /gm, '');
const ui = await readFile(new URL('original-ui.js', root), 'utf8');
const css = await readFile(new URL('original.css', root), 'utf8');

if (source.split('/* NOTES_MODEL */').length !== 2) throw new Error('client.js 缺少 NOTES_MODEL 标记');
if (source.split('/* NOTES_ORIGINAL_UI */').length !== 2) throw new Error('client.js 缺少 NOTES_ORIGINAL_UI 标记');

const output = source
  .replace('/* NOTES_MODEL */', () => model)
  .replace('/* NOTES_ORIGINAL_UI */', () => ui)
  .replace("/* NOTES_ORIGINAL_CSS */ ''", () => JSON.stringify(css));

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/client.js', root), output);
console.log('Built @local/aside-note client.');
