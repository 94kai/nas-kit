window.__ModuleLoader__.load({
  id: '@local/file-parent',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const ACTION_ID = '@local/file-parent:up';

    const arrowUp = size => h('svg', {
      viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
      strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
    }, h('path', { d: 'M12 19V5M5 12l7-7 7 7' }));

    const trim = value => String(value || '').replace(/[\\/]+$/, '');

    /** 当前树根的上一层；到根（`/`、`C:\`、UNC 共享根）或无法判断时返回 null。 */
    function parentOf(value) {
      if (typeof value !== 'string') return null;
      // UNC 共享根本身就是起点（\\server\share），不把 server 当父目录。
      if (/^[\\/]{2}[^\\/]+[\\/][^\\/]+[\\/]*$/.test(value)) return null;
      const path = trim(value);
      if (path === '' || /^[A-Za-z]:$/.test(path)) return null;
      const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      if (at < 0) return null;
      if (at === 0) return '/';
      const parent = path.slice(0, at);
      if (/^[A-Za-z]:$/.test(parent)) return parent + path[at];
      return parent;
    }

    function nameOf(value) {
      const path = trim(value);
      const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      if (at < 0) return path;
      return path.slice(at + 1) || path;
    }

    return {
      apply(ctx) {
        ctx.inject(['betterSidebar'], inner => {
          const service = inner.betterSidebar;
          if (!service || typeof service.registerFileAction !== 'function') return;
          inner.effect(() => service.registerFileAction({
            id: ACTION_ID,
            label: () => '打开上一级目录',
            icon: size => arrowUp(size),
            order: 90,
            // 文件与目录行都显示：这个动作作用于“当前树的根”，不是某一行。
            dirs: true,
            when: row => parentOf(row.root) !== null,
            run: row => {
              const root = trim(row.root);
              const parent = parentOf(row.root);
              if (!parent) return;
              const title = nameOf(parent);
              const patch = { path: parent, title, meta: { dir: true } };
              // 已经在文件夹窗口里：原地往上走，不新开页签。
              let current = null;
              try {
                const tabs = service.nativePathTabs?.() || [];
                current = tabs.find(tab => tab.sessionId === row.sessionId && trim(tab.path) === root) || null;
              } catch { current = null; }
              if (current && typeof service.updateTab === 'function') {
                service.updateTab(current.id, patch, row.sessionId);
                return;
              }
              // “文件”页本身不是文件夹窗口：先把它上面的父目录作为一个新窗口打开，
              // 之后在该窗口里再点菜单就是原地向上。
              service.openTab({
                type: 'editor',
                path: parent,
                title,
                meta: { dir: true },
                id: `editor:${parent}`,
              }, { sessionId: row.sessionId, cwd: root });
            },
          }));
        });
      },
    };
  },
});
