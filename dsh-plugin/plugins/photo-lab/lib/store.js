import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const locks = new Map();

/** 同一个文件串行写入，避免 UI 与工具同时改清单时互相覆盖。 */
function withLock(key, run) {
  const previous = locks.get(key) || Promise.resolve();
  const next = previous.then(run, run);
  locks.set(key, next.finally(() => { if (locks.get(key) === next) locks.delete(key); }));
  return next;
}

async function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

export function projectIdFor(dir) {
  return 'p' + crypto.createHash('sha1').update(path.resolve(dir)).digest('hex').slice(0, 10);
}

export function createStore({ dataDir }) {
  const projectsDir = path.join(dataDir, 'projects');
  const bindingsFile = path.join(dataDir, 'bindings.json');
  const projectFile = id => path.join(projectsDir, id, 'project.json');
  const assetDir = (id, kind) => path.join(projectsDir, id, kind);

  async function readJson(file, fallback) {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  }

  async function bindings() { return readJson(bindingsFile, {}); }

  async function bind(sessionId, projectId) {
    return withLock(bindingsFile, async () => {
      const map = await readJson(bindingsFile, {});
      map[sessionId] = projectId;
      await writeAtomic(bindingsFile, JSON.stringify(map, null, 1));
      return map;
    });
  }

  async function projectFor(sessionId) {
    const map = await bindings();
    return map[sessionId] || null;
  }

  async function get(id) {
    const project = await readJson(projectFile(id), null);
    if (!project) return null;
    return project;
  }

  async function save(project) {
    return withLock(projectFile(project.id), async () => {
      project.updatedAt = new Date().toISOString();
      project.revision = (project.revision || 0) + 1;
      await writeAtomic(projectFile(project.id), JSON.stringify(project));
      return project;
    });
  }

  async function list() {
    let entries = [];
    try { entries = await fs.readdir(projectsDir); } catch { return []; }
    const projects = [];
    for (const entry of entries) {
      const p = await get(entry).catch(() => null);
      if (p) projects.push({ id: p.id, dir: p.dir, sessionId: p.sessionId, count: Object.keys(p.photos || {}).length, updatedAt: p.updatedAt });
    }
    return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async function ensureProject({ dir, sessionId }) {
    const absolute = path.resolve(dir);
    const id = projectIdFor(absolute);
    let project = await get(id);
    if (!project) {
      project = {
        version: 1, id, dir: absolute, sessionId,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        revision: 0, style: 'natural', photos: {}
      };
      await fs.mkdir(assetDir(id, 'thumbs'), { recursive: true });
      await fs.mkdir(assetDir(id, 'previews'), { recursive: true });
      await save(project);
    } else if (sessionId && project.sessionId !== sessionId) {
      project.sessionId = sessionId;
      await save(project);
    }
    if (sessionId) await bind(sessionId, id);
    return project;
  }

  return { dataDir, projectsDir, bindingsFile, projectFile, assetDir, get, save, list, ensureProject, bind, projectFor };
}
