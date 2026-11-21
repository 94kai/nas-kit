window.__ModuleLoader__.load({
  id: '@local/file-browser',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** 左侧栏面板 id，也是 `main` 面板的 key。 */
    const PANEL = 'file-browser';
    const NS = 'file-browser';
    /** 同一个浏览器标签页里记住上次停留的目录与隐藏项选择。 */
    const VIEW_KEY = 'local.file-browser.view.v1';

    const zh = {
      title: '文件',
      subtitle: '浏览这台机器上的目录，点文件在右侧预览中打开。',
      back: '返回会话',
      up: '上一级',
      home: '主目录',
      path: '当前路径',
      refresh: '刷新',
      hidden: '显示隐藏项',
      loading: '正在读取目录…',
      empty: '这个目录是空的。',
      hiddenOnly: '这里只有隐藏项。',
      count: '个项目',
      truncated: '只显示前 2000 项，请收起隐藏项或换个目录。',
      readOnly: '只读浏览',
      retry: '重试',
      errorTitle: '读不了这个目录',
      notFound: '这个目录不在了。可能已被移动或删除。',
      permissionDenied: '没有权限读取这个目录。',
      notDirectory: '这不是一个目录。',
      invalidPath: '路径无效。',
      unavailable: '文件服务暂不可用，请确认「文件浏览」插件已启用。',
      noSession: '先在左侧打开一个会话，再点文件在右侧预览。',
      openFailed: '右侧预览打不开这个文件。',
      link: '符号链接',
    };

    const en = {
      title: 'Files',
      subtitle: 'Browse this machine; open a file in the right sidebar preview.',
      back: 'Back to chat',
      up: 'Parent folder',
      home: 'Home folder',
      path: 'Current path',
      refresh: 'Refresh',
      hidden: 'Show hidden entries',
      loading: 'Reading directory…',
      empty: 'This directory is empty.',
      hiddenOnly: 'Only hidden entries are here.',
      count: 'entries',
      truncated: 'Only the first 2000 entries are shown.',
      readOnly: 'Read-only',
      retry: 'Retry',
      errorTitle: 'Cannot read this directory',
      notFound: 'This directory is gone.',
      permissionDenied: 'No permission to read this directory.',
      notDirectory: 'This is not a directory.',
      invalidPath: 'Invalid path.',
      unavailable: 'The file service is unavailable.',
      noSession: 'Open a conversation first, then click a file to preview it.',
      openFailed: 'The right sidebar could not open this file.',
      link: 'Symbolic link',
    };

    const css = `
.fb-page{--fb-accent:var(--dsw-alias-state-business-primary,#5a6cf0);--fb-ink:var(--dsw-alias-label-primary,#20222a);--fb-muted:var(--dsw-alias-label-secondary,#6b7280);--fb-faint:var(--dsw-alias-label-tertiary,#9aa0ab);--fb-line:var(--dsw-alias-border-l3,#e8e8ee);--fb-hover:var(--dsw-alias-interactive-bg-hover,#f2f2f6);--fb-active:var(--dsw-alias-interactive-bg-active,#e9e9f2);box-sizing:border-box;height:100%;overflow:auto;padding:28px clamp(16px,4vw,40px) 32px;color:var(--fb-ink);background:var(--dsw-alias-bg-base,#fff);font:14px/1.5 system-ui,-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
.fb-page *,.fb-page *::before,.fb-page *::after{box-sizing:border-box}
.fb-page :is(button,.fb-crumbs):focus-visible{outline:2px solid var(--fb-accent);outline-offset:2px}
.fb-inner{max-width:900px;margin:0 auto}
.fb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:0 0 22px}
.fb-title{display:flex;align-items:center;gap:12px;min-width:0}
.fb-mark{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:13px;color:var(--fb-accent);background:color-mix(in srgb,var(--fb-accent) 10%,transparent)}
.fb-title h1{margin:0;font-size:22px;font-weight:650;letter-spacing:-.4px;line-height:1.25}
.fb-title p{margin:3px 0 0;color:var(--fb-muted);font-size:12.5px}
.fb-ghost{flex:none;min-height:34px;padding:6px 12px;border:1px solid var(--fb-line);border-radius:9px;background:transparent;color:var(--fb-muted);font:inherit;font-size:12.5px;cursor:pointer}
.fb-ghost:hover{background:var(--fb-hover);color:var(--fb-ink)}
.fb-bar{display:flex;align-items:center;gap:2px;min-width:0;margin:0 0 8px;padding:4px;border:1px solid var(--fb-line);border-radius:13px;background:color-mix(in srgb,var(--fb-ink) 2%,transparent)}
.fb-nav{display:grid;place-items:center;flex:none;width:32px;height:32px;padding:0;border:0;border-radius:9px;background:transparent;color:var(--fb-muted);cursor:pointer}
.fb-nav:hover:not(:disabled){background:var(--fb-hover);color:var(--fb-ink)}
.fb-nav:disabled{opacity:.32;cursor:default}
.fb-toggle[aria-pressed=true]{background:var(--fb-active);color:var(--fb-ink)}
.fb-crumbs{display:flex;align-items:center;flex:1 1 auto;min-width:0;padding:0 4px;overflow-x:auto;white-space:nowrap;scrollbar-width:none;font-size:12.5px}
.fb-crumbs::-webkit-scrollbar{display:none}
.fb-crumb{flex:none;max-width:200px;min-height:26px;padding:3px 6px;overflow:hidden;border:0;border-radius:7px;background:transparent;color:var(--fb-muted);font:inherit;font-size:12.5px;text-overflow:ellipsis;cursor:pointer}
.fb-crumb:hover{background:var(--fb-hover);color:var(--fb-ink)}
.fb-crumb-sep{flex:none;padding:0 1px;color:var(--fb-faint);user-select:none}
.fb-crumb-current{flex:none;max-width:260px;padding:3px 6px;overflow:hidden;color:var(--fb-ink);font-weight:600;text-overflow:ellipsis}
.fb-progress{position:relative;height:2px;margin:0 2px;overflow:hidden;border-radius:2px;background:color-mix(in srgb,var(--fb-accent) 12%,transparent)}
.fb-progress::after{content:"";position:absolute;inset:0;width:38%;border-radius:2px;background:var(--fb-accent);animation:fb-slide 1.1s ease-in-out infinite}
@keyframes fb-slide{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}
.fb-notice{margin:8px 2px 0;padding:7px 10px;border-radius:9px;color:var(--fb-ink);font-size:12.5px;background:color-mix(in srgb,var(--fb-accent) 9%,transparent)}
.fb-rows{list-style:none;margin:2px 0 0;padding:2px 0 0;border-top:1px solid var(--fb-line)}
.fb-rows[aria-busy=true]{opacity:.55}
.fb-row{display:flex;align-items:center;gap:10px;width:100%;min-width:0;min-height:38px;padding:6px 10px;border:0;border-radius:9px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.fb-row:disabled{cursor:default;color:var(--fb-faint)}
@media(hover:hover){.fb-row:hover:not(:disabled){background:var(--fb-hover)}}
.fb-icon{display:grid;place-items:center;flex:none;width:20px;height:20px;color:var(--fb-faint)}
.fb-icon[data-kind=dir]{color:var(--fb-accent)}
.fb-name{display:flex;align-items:center;gap:5px;flex:1 1 auto;min-width:0;overflow:hidden;font-size:13.5px;white-space:nowrap;text-overflow:ellipsis}
.fb-link{flex:none;color:var(--fb-faint);font-size:11px}
.fb-meta{flex:none;color:var(--fb-faint);font-size:11.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
.fb-chev{flex:none;margin-left:2px;color:var(--fb-faint);font-size:15px;line-height:1}
.fb-state{padding:56px 12px;text-align:center;color:var(--fb-muted)}
.fb-state p{margin:0 0 14px;font-size:13px}
.fb-state h2{margin:0 0 6px;color:var(--fb-ink);font-size:14.5px;font-weight:600}
.fb-state-actions{display:flex;justify-content:center;gap:8px}
.fb-skel{display:flex;flex-direction:column;gap:2px;padding-top:8px}
.fb-skel span{display:block;height:34px;border-radius:8px;background:linear-gradient(90deg,var(--fb-hover),color-mix(in srgb,var(--fb-ink) 4%,transparent),var(--fb-hover));background-size:220% 100%;animation:fb-shimmer 1.4s ease-in-out infinite}
.fb-skel span:nth-child(2n){width:76%}
.fb-skel span:nth-child(3n){width:88%}
@keyframes fb-shimmer{0%{background-position:100% 0}100%{background-position:-120% 0}}
.fb-foot{display:flex;justify-content:space-between;gap:12px;margin:14px 2px 0;color:var(--fb-faint);font-size:11.5px}
.fb-foot span:last-child{text-align:right}
@media(max-width:720px){.fb-page{padding:18px 14px 26px}.fb-head{margin-bottom:16px}.fb-title p{display:none}.fb-mark{width:38px;height:38px;border-radius:12px}.fb-title h1{font-size:20px}.fb-ghost{min-height:32px;padding:5px 10px}.fb-row{min-height:48px;padding:9px 8px}.fb-name{font-size:14px}.fb-meta{font-size:11px}.fb-crumb,.fb-crumb-current{max-width:140px}}
@media(prefers-reduced-motion:reduce){.fb-progress::after,.fb-skel span{animation:none}.fb-progress{display:none}}
`;

    const svg = (children, size = 16) => h(
      'svg',
      { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false', style: { display: 'block' } },
      children,
    );

    const IconFolder = size => svg(h('path', { d: 'M2 5.2A1.7 1.7 0 0 1 3.7 3.5h2.6l1.5 1.7h4.5A1.7 1.7 0 0 1 14 6.9v5.4a1.7 1.7 0 0 1-1.7 1.7H3.7A1.7 1.7 0 0 1 2 12.3V5.2Z' }), size);
    const IconFile = size => svg([h('path', { key: 'a', d: 'M4 1.8h5l3 3v9.4H4V1.8Z' }), h('path', { key: 'b', d: 'M9 1.8v3.1h3' })], size);
    const IconImage = size => svg([h('rect', { key: 'a', x: 2, y: 2.8, width: 12, height: 10.4, rx: 1.8 }), h('circle', { key: 'b', cx: 5.8, cy: 6, r: 1.1 }), h('path', { key: 'c', d: 'm2.6 12 3.2-3 2.2 2 1.7-1.6 3.7 2.6' })], size);
    const IconCode = size => svg([h('path', { key: 'a', d: 'M5.2 5 2.4 8l2.8 3' }), h('path', { key: 'b', d: 'm10.8 5 2.8 3-2.8 3' })], size);
    const IconMedia = size => svg([h('rect', { key: 'a', x: 2, y: 2.8, width: 12, height: 10.4, rx: 2 }), h('path', { key: 'b', d: 'm6.6 5.8 3.8 2.2-3.8 2.2z', fill: 'currentColor', stroke: 'none' })], size);
    const IconArchive = size => svg([h('path', { key: 'a', d: 'M2.6 5.4h10.8v7.2a1.6 1.6 0 0 1-1.6 1.6H4.2a1.6 1.6 0 0 1-1.6-1.6V5.4Z' }), h('path', { key: 'b', d: 'M2 2.8h12v2.6H2z' }), h('path', { key: 'c', d: 'M6.6 8.4h2.8' })], size);
    const IconDoc = size => svg([h('path', { key: 'a', d: 'M4 1.8h5l3 3v9.4H4V1.8Z' }), h('path', { key: 'b', d: 'M9 1.8v3.1h3' }), h('path', { key: 'c', d: 'M5.8 8.6h4.4M5.8 11h3' })], size);
    const IconUp = size => svg(h('path', { d: 'm4.4 9.6 3.6-3.4 3.6 3.4' }), size);
    const IconHome = size => svg([h('path', { key: 'a', d: 'm2.4 7 5.6-5 5.6 5' }), h('path', { key: 'b', d: 'M4 6.2v7.2h8V6.2' })], size);
    const IconEye = size => svg([h('path', { key: 'a', d: 'M1.6 8S4.2 3.8 8 3.8 14.4 8 14.4 8 11.8 12.2 8 12.2 1.6 8 1.6 8Z' }), h('circle', { key: 'b', cx: 8, cy: 8, r: 2 })], size);
    const IconEyeOff = size => svg([h('path', { key: 'a', d: 'M1.8 8S4.3 4.2 8 4.2 14.2 8 14.2 8 11.7 11.8 8 11.8 1.8 8 1.8 8Z' }), h('circle', { key: 'b', cx: 8, cy: 8, r: 2 }), h('path', { key: 'c', d: 'm2.4 2.4 11.2 11.2' })], size);
    const IconRefresh = size => svg([h('path', { key: 'a', d: 'M13.4 8a5.4 5.4 0 1 1-1.6-3.8' }), h('path', { key: 'b', d: 'M13.6 2.6v3.2h-3.2' })], size);

    const IMAGE_EXT = new Set(['avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
    const CODE_EXT = new Set(['c', 'cc', 'cpp', 'css', 'go', 'h', 'hpp', 'html', 'java', 'js', 'json', 'jsx', 'kt', 'mjs', 'cjs', 'md', 'php', 'py', 'rb', 'rs', 'scss', 'sh', 'sql', 'swift', 'toml', 'ts', 'tsx', 'vue', 'xml', 'yaml', 'yml']);
    const MEDIA_EXT = new Set(['aac', 'avi', 'flac', 'm4a', 'mkv', 'mov', 'mp3', 'mp4', 'ogg', 'opus', 'wav', 'webm']);
    const ARCHIVE_EXT = new Set(['7z', 'bz2', 'gz', 'rar', 'tar', 'tgz', 'xz', 'zip']);
    const DOC_EXT = new Set(['csv', 'doc', 'docx', 'epub', 'md', 'pdf', 'ppt', 'pptx', 'xls', 'xlsx']);

    const SIZE_UNITS = ['KB', 'MB', 'GB', 'TB'];

    const dateFormat = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });

    function extensionOf(name) {
      const dot = name.lastIndexOf('.');
      return dot <= 0 || dot === name.length - 1 ? '' : name.slice(dot + 1).toLowerCase();
    }

    function glyphOf(entry) {
      if (entry.kind === 'dir') return IconFolder();
      const extension = extensionOf(entry.name);
      if (IMAGE_EXT.has(extension)) return IconImage();
      if (MEDIA_EXT.has(extension)) return IconMedia();
      if (ARCHIVE_EXT.has(extension)) return IconArchive();
      if (CODE_EXT.has(extension)) return IconCode();
      if (DOC_EXT.has(extension)) return IconDoc();
      return IconFile();
    }

    function formatSize(bytes) {
      if (!Number.isFinite(bytes)) return '';
      if (bytes < 1024) return `${bytes} B`;
      let value = bytes;
      let unit = -1;
      do {
        value /= 1024;
        unit += 1;
      } while (value >= 1024 && unit < SIZE_UNITS.length - 1);
      return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '')} ${SIZE_UNITS[unit]}`;
    }

    function formatDate(ms) {
      if (!Number.isFinite(ms)) return '';
      try {
        return dateFormat.format(new Date(ms));
      } catch {
        return '';
      }
    }

    /** 把绝对路径拆成可点击的面包屑；Windows 盘符也认。 */
    function crumbsOf(raw) {
      const unified = String(raw).replace(/\\/g, '/');
      const drive = /^([A-Za-z]:)(?=\/|$)/.exec(unified);
      const nodes = drive === null
        ? [{ label: '/', path: '/' }]
        : [{ label: drive[1], path: `${drive[1]}/` }];
      let accumulated = nodes[0].path;
      for (const part of unified.slice(drive === null ? 0 : drive[1].length).split('/')) {
        if (part === '') continue;
        accumulated = accumulated.endsWith('/') ? accumulated + part : `${accumulated}/${part}`;
        nodes.push({ label: part, path: accumulated });
      }
      return nodes;
    }

    /** `dsh-resource://file/session/<id>/<path>`：工作目录之内用相对路径，之外保留绝对路径。 */
    function fileAddress(sessionId, cwd, absolutePath) {
      const normalized = String(absolutePath).replace(/\\/g, '/');
      const root = String(cwd || '').replace(/\\/g, '/').replace(/\/+$/, '');
      const relative = root !== '' && normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
      const encoded = relative.split('/').map(part => encodeURIComponent(part).replace(/%3A/gi, ':')).join('/');
      return `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${encoded}`;
    }

    function PanelIcon({ size }) {
      return IconFolder(size);
    }

    return {
      inject: ['slots', 'layout', 'locale', 'sidebarRight', 'sessions'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }));

        /** 当前会话：`mainView` 由工作区导航持有，面板打开期间仍然有效。 */
        function selection() {
          const state = ctx.sessions?.list.getSnapshot();
          const rows = state?.byId === undefined ? [] : Object.values(state.byId);
          const current = rows.find(row => (row.retainedBy?.mainView || 0) > 0);
          return current === undefined ? undefined : { id: current.id, cwd: current.cwd };
        }

        function readView() {
          try {
            const parsed = JSON.parse(window.sessionStorage.getItem(VIEW_KEY) || 'null');
            if (parsed !== null && typeof parsed === 'object') {
              return { path: typeof parsed.path === 'string' ? parsed.path : '', hidden: parsed.hidden === true };
            }
          } catch {
            // 存储不可用时退回未记住的状态。
          }
          return { path: '', hidden: false };
        }

        function writeView(view) {
          try {
            window.sessionStorage.setItem(VIEW_KEY, JSON.stringify(view));
          } catch {
            // 同上：记住路径只是便利，不该影响浏览。
          }
        }

        function Page({ t }) {
          const tr = typeof t === 'function' ? t : key => key;
          const saved = React.useRef();
          if (saved.current === undefined) saved.current = readView();
          const initial = React.useRef();
          if (initial.current === undefined) {
            initial.current = saved.current.path || selection()?.cwd || '';
          }

          const [target, setTarget] = React.useState(initial.current);
          const [hidden, setHidden] = React.useState(saved.current.hidden === true);
          const [revision, setRevision] = React.useState(0);
          const [view, setView] = React.useState(null);
          const [phase, setPhase] = React.useState('loading');
          const [failure, setFailure] = React.useState(null);
          const [notice, setNotice] = React.useState('');
          const noticeTimer = React.useRef(0);
          const crumbsRef = React.useRef(null);

          const flash = React.useCallback(message => {
            setNotice(message);
            window.clearTimeout(noticeTimer.current);
            noticeTimer.current = window.setTimeout(() => setNotice(''), 3600);
          }, []);

          React.useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

          React.useEffect(() => {
            const controller = new AbortController();
            setPhase('loading');
            setFailure(null);
            const query = new URLSearchParams();
            if (target) query.set('path', target);
            // 隐藏项由页面自己切换：主机一次返回整层，眼睛按钮不再重新请求。
            query.set('hidden', '1');
            fetch(new URL(`api/file-browser?${query}`, document.baseURI), {
              credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
            })
              .then(async response => {
                const body = await response.json().catch(() => null);
                if (!response.ok) {
                  const error = new Error(body?.error || 'unavailable');
                  error.detail = body?.message;
                  throw error;
                }
                if (controller.signal.aborted) return;
                setView(body);
                setPhase('ready');
                // 保留切换后的隐藏项偏好：请求期间可能刚点过眼睛按钮。
                writeView({ path: body.path, hidden: readView().hidden });
              })
              .catch(cause => {
                if (controller.signal.aborted) return;
                setView(null);
                setPhase('error');
                setFailure({ code: cause?.message || 'unavailable', detail: cause?.detail });
              });
            return () => controller.abort();
          }, [target, revision]);

          React.useEffect(() => {
            const node = crumbsRef.current;
            if (node) node.scrollLeft = node.scrollWidth;
          }, [view?.path]);

          const crumbs = React.useMemo(() => (view ? crumbsOf(view.path) : []), [view?.path]);

          const entries = React.useMemo(() => {
            if (view === null) return [];
            return hidden ? view.entries : view.entries.filter(entry => !entry.name.startsWith('.'));
          }, [view, hidden]);

          const hiddenCount = view === null ? 0 : view.entries.length - entries.length;

          const toggleHidden = () => {
            const next = !hidden;
            setHidden(next);
            writeView({ path: view?.path || '', hidden: next });
          };

          const openEntry = entry => {
            if (entry.kind === 'dir') {
              setTarget(entry.path);
              return;
            }
            if (entry.kind !== 'file') return;
            const session = selection();
            if (session === undefined) {
              flash(tr('noSession'));
              return;
            }
            try {
              ctx.sidebarRight.openResource(fileAddress(session.id, session.cwd, entry.path));
            } catch {
              flash(tr('openFailed'));
            }
          };

          const errorText = () => {
            if (failure === null) return tr('unavailable');
            switch (failure.code) {
              case 'not_found': return tr('notFound');
              case 'permission_denied': return tr('permissionDenied');
              case 'not_directory': return tr('notDirectory');
              case 'invalid_path': return tr('invalidPath');
              default: return failure.detail || tr('unavailable');
            }
          };

          const metaOf = entry => {
            const parts = entry.kind === 'file'
              ? [formatSize(entry.size), formatDate(entry.mtimeMs)]
              : [formatDate(entry.mtimeMs)];
            return parts.filter(Boolean).join(' · ');
          };

          const rowOf = entry => h('li', { key: entry.path },
            h('button', {
              type: 'button',
              className: 'fb-row',
              'data-kind': entry.kind,
              title: entry.path,
              disabled: entry.kind === 'other',
              onClick: () => openEntry(entry),
            },
              h('span', { className: 'fb-icon', 'data-kind': entry.kind, 'aria-hidden': true }, glyphOf(entry)),
              h('span', { className: 'fb-name' },
                entry.name,
                entry.link ? h('span', { className: 'fb-link', title: tr('link'), 'aria-label': tr('link') }, '↗') : null),
              metaOf(entry) ? h('span', { className: 'fb-meta' }, metaOf(entry)) : null,
              entry.kind === 'dir' ? h('span', { className: 'fb-chev', 'aria-hidden': true }, '›') : null,
            ));

          const body = () => {
            if (phase === 'error') {
              return h('div', { className: 'fb-state', role: 'alert' },
                h('h2', null, tr('errorTitle')),
                h('p', null, errorText()),
                h('div', { className: 'fb-state-actions' },
                  h('button', { type: 'button', className: 'fb-ghost', onClick: () => setRevision(value => value + 1) }, tr('retry')),
                  h('button', { type: 'button', className: 'fb-ghost', onClick: () => setTarget('') }, tr('home'))));
            }
            if (view === null) {
              return h('div', { className: 'fb-skel', 'aria-label': tr('loading'), role: 'status' },
                Array.from({ length: 7 }, (_, index) => h('span', { key: index })));
            }
            if (entries.length === 0) {
              return h('div', { className: 'fb-state' },
                h('p', null, hiddenCount > 0 ? tr('hiddenOnly') : tr('empty')),
                hiddenCount > 0
                  ? h('div', { className: 'fb-state-actions' },
                    h('button', { type: 'button', className: 'fb-ghost', onClick: toggleHidden }, tr('hidden')))
                  : null);
            }
            return h('ul', { className: 'fb-rows', 'aria-busy': phase === 'loading' }, entries.map(rowOf));
          };

          return h('section', { className: 'fb-page', 'aria-label': tr('title') },
            h('style', null, css),
            h('div', { className: 'fb-inner' },
              h('header', { className: 'fb-head' },
                h('div', { className: 'fb-title' },
                  h('span', { className: 'fb-mark', 'aria-hidden': true }, IconFolder(22)),
                  h('div', null, h('h1', null, tr('title')), h('p', null, tr('subtitle')))),
                h('button', { type: 'button', className: 'fb-ghost', onClick: () => ctx.layout.selectPanel(null) }, tr('back'))),
              h('div', { className: 'fb-bar' },
                h('button', {
                  type: 'button', className: 'fb-nav', disabled: !view?.parent,
                  title: tr('up'), 'aria-label': tr('up'),
                  onClick: () => { if (view?.parent) setTarget(view.parent); },
                }, IconUp()),
                h('button', {
                  type: 'button', className: 'fb-nav', disabled: view === null,
                  title: tr('home'), 'aria-label': tr('home'),
                  onClick: () => setTarget(''),
                }, IconHome()),
                h('nav', { className: 'fb-crumbs', 'aria-label': tr('path'), ref: crumbsRef },
                  crumbs.map((node, index) => h(React.Fragment, { key: node.path },
                    index === 0 ? null : h('span', { className: 'fb-crumb-sep', 'aria-hidden': true }, '/'),
                    index === crumbs.length - 1
                      ? h('span', { className: 'fb-crumb-current', 'aria-current': 'page', title: node.path }, node.label)
                      : h('button', { type: 'button', className: 'fb-crumb', title: node.path, onClick: () => setTarget(node.path) }, node.label)))),
                h('button', {
                  type: 'button', className: 'fb-nav fb-toggle',
                  title: tr('hidden'), 'aria-label': tr('hidden'), 'aria-pressed': hidden,
                  onClick: toggleHidden,
                }, hidden ? IconEye() : IconEyeOff()),
                h('button', {
                  type: 'button', className: 'fb-nav',
                  title: tr('refresh'), 'aria-label': tr('refresh'),
                  onClick: () => setRevision(value => value + 1),
                }, IconRefresh())),
              phase === 'loading' && view !== null ? h('div', { className: 'fb-progress' }) : null,
              notice ? h('div', { className: 'fb-notice', role: 'status' }, notice) : null,
              body(),
              h('p', { className: 'fb-foot' },
                h('span', null, view === null ? '' : `${entries.length} ${tr('count')}`),
                h('span', null, view?.truncated === true ? tr('truncated') : tr('readOnly')))));
        }

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL,
          locale: NS,
        }, Page));

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL,
          order: 20,
          label: () => '文件浏览',
        }, PanelIcon));
      },
    };
  },
});
