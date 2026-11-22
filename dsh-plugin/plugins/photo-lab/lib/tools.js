import path from 'node:path';
import { guide, GUIDES } from './guide.js';
import { STYLES } from './engine.js';

const LOCALS = {
  type: 'array',
  description: '局部调整，最多 8 个，按顺序叠加。shape=radial 用 cx/cy/rx/ry；linear 用 x0,y0,x1,y1；box 用 box=[x0,y0,x1,y1]；polygon 用 points=[[x,y],...]。feather 0–1（占半径比例），invert=true 表示作用在遮罩外（压暗环境用）。adjust 里 exposure 是 EV(-2..2)，contrast/saturation 是倍数，temperature -1..1（正=暖），clarity -1..1。',
  items: {
    type: 'object',
    properties: {
      shape: { type: 'string', enum: ['radial', 'linear', 'box', 'polygon'] },
      cx: { type: 'number' }, cy: { type: 'number' }, rx: { type: 'number' }, ry: { type: 'number' },
      x0: { type: 'number' }, y0: { type: 'number' }, x1: { type: 'number' }, y1: { type: 'number' },
      box: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
      points: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
      feather: { type: 'number' }, invert: { type: 'boolean' },
      adjust: {
        type: 'object',
        properties: {
          exposure: { type: 'number' }, contrast: { type: 'number' }, saturation: { type: 'number' },
          temperature: { type: 'number' }, clarity: { type: 'number' }
        }
      }
    },
    required: ['shape']
  }
};

const ADJUST = {
  type: 'object',
  description: '风格微调：倍数 1 表示不变。',
  properties: {
    brightness: { type: 'number' }, saturation: { type: 'number' }, contrast: { type: 'number' },
    tint: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
    vignette: { type: 'number' }, sharpen: { type: 'number' }
  }
};

const ITEM = {
  type: 'object',
  description: 'update 时为初筛条目（id/tier/score/reasons/problems/direction/crop）；grade 时为单张覆盖（id/style/adjust/local/crop）；retouch 时为（id/spots/auto）。',
  properties: {
    id: { type: 'string' },
    tier: { type: 'string', enum: ['keep', 'maybe', 'skip'] },
    score: { type: 'number' },
    reasons: { type: 'array', items: { type: 'string' } },
    problems: { type: 'array', items: { type: 'string' } },
    direction: { type: 'string' },
    crop: {
      type: 'object',
      properties: {
        aspect: { type: 'string' }, focusX: { type: 'number' }, focusY: { type: 'number' },
        box: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
        rotate: { type: 'number', description: '旋转角度 -45..45，先旋转再裁切' }
      }
    },
    style: { type: 'string', enum: Object.keys(STYLES) },
    adjust: ADJUST,
    local: LOCALS,
    spots: { type: 'array', items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, r: { type: 'number' } } } },
    auto: { type: 'object', properties: { enabled: { type: 'boolean' }, sensitivity: { type: 'number' } } }
  },
  additionalProperties: true
};

export function registerTools(ctx, { service, store }) {
  return ctx.tools.register({
    name: 'photo_lab',
    description: '修图工作台：管理当前会话绑定的照片项目。action=status 看项目进度；style_learn 从参考图学一个风格（可带模型给的 adjust）；style_list 列出可用风格；list 列照片（带最近一轮参数与直方图统计）；sheet 生成联系表（可传 ids 或 files）；update 写初筛结论；grade 渲染（支持 style/adjust/local 局部调整/items 单张覆盖/size）；retouch 去污（auto 只返回检测点，带 spots 才出图）；ingest 把外部修好的图回写成一轮（导出以 final 为准）；export 打压缩包到 _export/；purge 删除标删原图（不可恢复）；guide 读细则。没有绑定项目时 status 会说明。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'list', 'sheet', 'update', 'grade', 'retouch', 'ingest', 'export', 'purge', 'guide', 'open', 'style_learn', 'style_list', 'style_delete', 'final'] },
        projectId: { type: 'string', description: '默认当前会话绑定的项目，一般不用传。' },
        dir: { type: 'string', description: 'open 时指定照片目录的绝对路径。' },
        filter: { type: 'string', enum: ['pending', 'keep', 'maybe', 'skip', 'delete', 'graded', 'all'], description: 'list 用，默认 pending。' },
        ids: { type: 'array', items: { type: 'string' }, description: '要处理的照片 id；grade 省略时默认所有 keep。' },
        files: { type: 'array', items: { type: 'string' }, description: 'sheet 用：项目目录内的绝对路径列表，拼「修完的这批」总览。' },
        style: { type: 'string', description: '风格 id：内置（natural/film/cinema/…）或 style_learn 学会的自定义风格 id。' },
        name: { type: 'string', description: 'style_learn：给风格起的名字。' },
        description: { type: 'string', description: 'style_learn：这个风格的一句话说明（给以后看）。' },
        adjust: ADJUST,
        local: LOCALS,
        items: { type: 'array', items: ITEM, description: 'update 的初筛条目 / grade 的单张覆盖 / retouch 的点位。' },
        size: { type: 'number', description: '渲染长边像素，默认 1280，上限 4096。' },
        mask_preview: { type: 'boolean', description: 'grade 时为每张带遮罩的图额外输出一张红色遮罩预览。' },
        auto: { type: 'object', properties: { enabled: { type: 'boolean' }, sensitivity: { type: 'number' } }, description: 'retouch 自动找污点；只返回点位，不落盘。' },
        id: { type: 'string', description: 'ingest / final：照片 id。' },
        round: { type: 'number', description: 'final：要设为导出的轮次；省略或 null 表示取消定稿。' },
        file: { type: 'string', description: 'ingest：外部图片路径（绝对路径或相对照片目录）。' },
        set_final: { type: 'boolean', description: 'ingest：同时设为定稿，导出优先用它。' },
        note: { type: 'string', description: 'ingest：这一轮做了什么。' },
        params: { type: 'object', additionalProperties: true, description: 'ingest：记录用的参数对象。' },
        revision: { type: 'number', description: '写操作可选：清单被改过则拒绝，防覆盖。' },
        topic: { type: 'string', enum: Object.keys(GUIDES), description: 'guide 的主题。' }
      },
      required: ['action'],
      additionalProperties: false
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }]
    },
    async execute(args, exec) {
      const sessionId = exec?.agent?.id;
      const projectId = args.projectId || (sessionId ? await store.projectFor(sessionId) : null);
      if (args.action === 'guide') return guide(args.topic);
      if (args.action === 'open') {
        const result = await service.open({ sessionId, dir: args.dir });
        return { project: result.project, scan: result.scan };
      }
      if (!projectId) {
        return { error: '当前会话还没有绑定修图项目', next: '请在会话右上角的「修图」面板里选择一个照片目录，或调用 open 指定绝对路径。' };
      }
      if (args.revision != null) {
        const project = await service.requireProject(projectId);
        if (Number(args.revision) !== project.revision) {
          return { error: '清单已被改动', revision: project.revision, next: '先重新读取状态再写。' };
        }
      }
      switch (args.action) {
        case 'status': {
          const project = await service.requireProject(projectId);
          const st = await service.state(projectId);
          return {
            project: service.summarize(project), manifest: store.projectFile(projectId),
            exportStatus: st.exportStatus,
            next: Object.values(project.photos).some(p => !p.triage) ? '还有照片没初筛，可以 sheet 拿联系表' : '可以 grade 渲染预览'
          };
        }
        case 'list': {
          const project = await service.requireProject(projectId);
          const filter = args.filter || 'pending';
          const items = Object.values(project.photos)
            .filter(photo => {
              if (args.ids && args.ids.length) return args.ids.includes(photo.id);
              if (filter === 'pending') return !photo.triage;
              if (filter === 'keep') return service.effectiveDecision(photo) === 'keep';
              if (filter === 'maybe') return photo.triage && photo.triage.tier === 'maybe';
              if (filter === 'skip') return service.effectiveDecision(photo) === 'skip';
              if (filter === 'delete') return service.effectiveDecision(photo) === 'delete';
              if (filter === 'graded') return (photo.rounds || []).length > 0;
              return true;
            })
            .slice(0, 80)
            .map(photo => {
              const pub = service.publicPhoto(project, photo);
              const latest = pub.rounds[pub.rounds.length - 1];
              return {
                id: photo.id, file: photo.file, size: `${photo.width}x${photo.height}`, decision: pub.effective,
                triage: photo.triage ? { tier: photo.triage.tier, reasons: photo.triage.reasons, direction: photo.triage.direction, crop: photo.triage.crop } : null,
                preview: path.join(store.projectsDir, project.id, 'previews', `${photo.id}.jpg`),
                rounds: (photo.rounds || []).length,
                latest_round: latest ? { n: latest.n, source: latest.source, params: latest.params, output: latest.output, stats: latest.stats, after: latest.after } : null,
                final: photo.final || null,
                note: pub.note, noteState: pub.noteState
              };
            });
          return { total: items.length, filter, revision: project.revision, items };
        }
        case 'sheet': return service.contactSheet(projectId, { ids: args.ids, files: args.files });
        case 'update': {
          if (!Array.isArray(args.items) || !args.items.length) return { error: 'items 不能为空' };
          return service.updateTriage(projectId, args.items);
        }
        case 'grade': return service.grade(projectId, {
          ids: args.ids, items: args.items, style: args.style, adjust: args.adjust,
          local: args.local, size: args.size, mask_preview: args.mask_preview
        });
        case 'retouch': return service.retouch(projectId, { ids: args.ids, items: args.items, size: args.size, auto: args.auto });
        case 'final': return service.setFinal(projectId, args.id, args.round ?? null);
        case 'style_learn': return service.learnStyle({ name: args.name, file: args.file, adjust: args.adjust, description: args.description, base: args.style });
        case 'style_list': return service.listStyles();
        case 'style_delete': return service.deleteStyle(args.id || args.name);
        case 'ingest': return service.ingest(projectId, {
          photoId: args.id, file: args.file, set_final: args.set_final !== false,
          note: args.note, params: args.params
        });
        case 'export': return service.exportArchive(projectId, { size: args.size });
        case 'purge': return service.purgeDeleted(projectId);
        default: return { error: '不支持的操作' };
      }
    },
    isConcurrencySafe: args => ['status', 'list', 'guide'].includes(args.action)
  });
}
