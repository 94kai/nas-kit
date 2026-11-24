#!/usr/bin/env node
// Register a local HTML report so it shows up on the toolbox home page.
// Runs on the machine that hosts DSH; it writes the same list the Host reads.
import { createLocalPages } from '../features/shortcuts/local-pages.js';

const [command = 'list', ...args] = process.argv.slice(2);
const positional = [];
let title;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--title' || arg === '-t') title = args[++index];
  else if (arg.startsWith('--title=')) title = arg.slice('--title='.length);
  else positional.push(arg);
}

const pages = createLocalPages();
const print = snapshot => {
  if (!snapshot.items.length) return console.log('还没有注册本地页面。');
  for (const item of snapshot.items) console.log(`${item.id}  ${item.title}\n    ${item.path}`);
};

try {
  if (command === 'add') {
    if (!positional[0]) throw new Error('用法：node scripts/local-pages.mjs add <HTML 文件路径> [--title 标题]');
    const snapshot = await pages.add({ path: positional[0], title });
    print(snapshot);
  } else if (command === 'remove') {
    if (!positional[0]) throw new Error('用法：node scripts/local-pages.mjs remove <id>');
    const snapshot = await pages.remove(positional[0]);
    print(snapshot);
  } else if (command === 'list') {
    print(await pages.list());
  } else {
    throw new Error('可用命令：add <路径> [--title 标题] | list | remove <id>');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
