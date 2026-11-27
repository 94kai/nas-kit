import { mkdir, readFile, writeFile } from 'node:fs/promises';
const file = name => new URL(name, import.meta.url);
const read = name => readFile(file(name), 'utf8');
const moduleBody = async (name, fn) => `(() => {\n${(await read(name)).replace(/^export function /gm, 'function ')}\nreturn ${fn};\n})()`;
const browser = await moduleBody('browser.js', 'createFileBrowser');
const preview = await moduleBody('preview.js', 'createPreview');
const css = JSON.stringify(await read('browser.css') + '\n' + await read('preview.css'));
const source =  (await read('client.js'))
  .replace('/* BROWSER */ null', () => browser)
  .replace('/* PREVIEW */ null', () => preview)
  .replace('/* STYLES */ ""', () => css);
await mkdir(file('dist/'), {recursive:true});
await writeFile(file('dist/client.js'), source);
console.log('Built @local/files client.');
