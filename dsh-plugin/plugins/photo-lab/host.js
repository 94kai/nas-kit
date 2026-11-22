import os from 'node:os';
import path from 'node:path';
import { createStore } from './lib/store.js';
import { createService } from './lib/service.js';
import { createApi } from './lib/routes.js';
import { registerTools } from './lib/tools.js';

export const inject = ['connection', 'tools'];

const JSON_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function apply(ctx, config = {}) {
  const dataDir = config.dataDir || path.join(os.homedir(), '.dsh', 'photo-lab');
  const store = createStore({ dataDir });
  const service = createService({ store });
  const api = createApi({ service, store });

  ctx.effect(() => {
    const disposers = [];
    disposers.push(ctx.connection.fetch.register({
      path: '/api/photo-lab', methods: ['POST'], requestBody: 'buffered',
      async fetch(request) { try { return await api.command(request); } catch (error) { return api.fail(error); } }
    }));
    disposers.push(ctx.connection.fetch.register({
      path: '/api/photo-lab/state', methods: ['GET'], requestBody: 'buffered',
      async fetch(request) {
        try {
          const url = new URL(request.url);
          let projectId = url.searchParams.get('p');
          if (!projectId) {
            const sessionId = url.searchParams.get('s');
            projectId = sessionId ? await store.projectFor(sessionId) : null;
            if (!projectId) return Response.json({ bound: false }, { headers: JSON_HEADERS });
          }
          return Response.json(await service.state(projectId), { headers: JSON_HEADERS });
        } catch (error) { return api.fail(error); }
      }
    }));
    disposers.push(ctx.connection.fetch.register({
      path: '/api/photo-lab/asset', methods: ['GET'], requestBody: 'buffered',
      async fetch(request) { try { return await api.asset(request); } catch (error) { return api.fail(error); } }
    }));
    disposers.push(registerTools(ctx, { service, store }));
    return () => { for (const dispose of disposers.reverse()) dispose(); };
  });
}
