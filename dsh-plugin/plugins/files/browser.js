const FAV = 'local.files.folders.v1', HIDDEN = 'local.files.showHidden';
const base = p => p.split('/').pop() || '/', parent = p => p.slice(0, p.lastIndexOf('/')) || '/';
const join = (p, n) => !n ? p : `${p === '/' ? '' : p}/${n}`;
const inside = (p, root) => Boolean(root && (p === root || p.startsWith(root === '/' ? '/' : `${root}/`)));
const canonicalFavorites = (items, home) => [...new Set(items.map(p => p.startsWith('/') ? p : join(home, p)))];
const types = { dir: '文件夹', file: '文件', link: '符号链接', other: '特殊文件' };
const order = new Intl.Collator('zh-CN', { numeric: true });
const dates = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
const message = e => e?.message || '请求未完成，请稍后重试。';
function stored(key, initial) { try { return JSON.parse(localStorage.getItem(key)) ?? initial; } catch { return initial; } }
function folders() { const v = stored(FAV, []); return Array.isArray(v) ? v.filter(p => typeof p === 'string') : []; }
function bytes(n) {
  if (!Number.isFinite(n)) return '大小未知';
  const units = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
  while (n >= 1024 && i < 4) { n /= 1024; i++; }
  return `${Number(n.toFixed(i && n < 10 ? 1 : 0))} ${units[i]}`;
}
const glyph = {
  dir: 'M3 6a2 2 0 0 1 2-2h5l2.5 3H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  file: 'M6 3.5h8l4.5 4.7V20H6z M14 3.5V9h4.5 M9 13h6 M9 16.5h4',
  link: 'M9 15l6-6 M13 7l2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0 M11 17l-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0',
  other: 'M4 7l8-4 8 4v10l-8 4-8-4z M4 7l8 4 8-4 M12 11v10',
  star: 'M12 3.5l2.7 5.4 6 .9-4.4 4.2 1.1 6-5.4-2.8L6.6 20l1-6-4.3-4.2 6-.9z',
  home: 'M3 11l9-8 9 8 M5.5 9v11h13V9 M10 20v-6h4v6', next: 'M9 5l7 7-7 7', close: 'M6 6l12 12 M18 6L6 18',
  back: 'M20 12H4 M10.5 5.5L4 12l6.5 6.5', refresh: 'M20 5v5h-5 M19.5 10a8 8 0 1 0 .2 5', more: 'M5 12h.1 M12 12h.1 M19 12h.1',
  rename: 'M4 20l4-.8L19 8l-3-3L5 16z M13.5 7.5l3 3', move: 'M3 6h6l2 2h8v3 M3 6v13h7 M12 16h9 M17 12l4 4-4 4',
  delete: 'M4 7h16 M9 7V4h6v3 M6.5 7l1 13h9l1-13 M10 11v5 M14 11v5'
};
export function createFileBrowser(React, { request, Preview }) {
  const { createElement: h, useState, useRef, useEffect } = React;
  const group = (...children) => h(React.Fragment, null, ...children);
  const icon = (n, fill = false) => h('svg', { className: 'lfiles-icon', viewBox: '0 0 24 24', 'aria-hidden': true, fill: fill ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: n === 'more' ? 3.8 : 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: glyph[n] }));
  const badge = t => h('span', { className: `lfiles-badge lfiles-kind-${t}` }, icon(t));
  const button = (text, click, style, content, props) => h('button', { type: 'button', onClick: click, className: `lfiles-${style}`, title: text, 'aria-label': text, ...props }, content ?? text);
  function useDirectory(path, showHidden) {
    const [rev, setRev] = useState(0), [result, setResult] = useState(null), [authorized, setAuthorized] = useState(false);
    useEffect(() => {
      if (path === null) return;
      let active = true;
      (async () => {
        let data;
        try { const { entries, path: directory, home } = await request('list', { path, showHidden }); data = { directory, home, entries: entries.slice().sort((a, b) => (b.type === 'dir') - (a.type === 'dir') || order.compare(a.name, b.name)) }; }
        catch (e) { data = { error: message(e), status: e?.status }; }
        if (active) {
          if (data.entries) setAuthorized(true);
          else if (data.status === 401 || data.status === 403) setAuthorized(false);
          setResult({ path, showHidden, rev, ...data });
        }
      })();
      return () => { active = false; };
    }, [path, showHidden, rev]);
    return [result && result.path === path && result.showHidden === showHidden && result.rev === rev ? result : {}, () => setRev(r => r + 1), authorized];
  }
  function Crumbs({ path, go, disabled, root = '/' }) {
    const rail = useRef(null);
    React.useLayoutEffect(() => { if (rail.current) rail.current.scrollLeft = rail.current.scrollWidth; }, [path]);
    const nodes = [{ path:root, title:root === '/' ? '/' : '主目录' }];
    for (const part of path.slice(root.length).split('/').filter(Boolean)) nodes.push({path:join(nodes.at(-1).path, part), title:part});
    return h('nav', { ref:rail, className:'lfiles-crumbs', 'aria-label':'目录路径' }, nodes.map((n,i) =>
      h('span', {key:n.path}, i > 0 && icon('next'), button(n.path, () => go(n.path), 'crumb', n.title, {disabled:disabled || n.path === path, 'aria-current':n.path === path ? 'location' : undefined}))));
  }
  function Empty({ title, detail, retry, symbol = 'dir' }) { return h('div', { className: 'lfiles-empty', role: retry ? 'alert' : 'status' }, badge(symbol), h('strong', null, title), detail && h('small', null, detail), retry && button('重新加载', retry, 'secondary')); }

  function HiddenToggle({ value, change, disabled }) {
    return h('label', { className: 'lfiles-hidden' }, h('input', { type: 'checkbox', checked: value, disabled, onChange: e => change(e.target.checked) }), '显示隐藏文件');
  }
  function Actions({ entry, onClose, favorites, onFavorite, showHidden, changeHidden, onMutated }) {
    const [mode, setMode] = useState('menu'), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [name, setName] = useState(entry.name), [dest, setDest] = useState(parent(entry.path));
    const ref = useRef(null), closeRef = useRef(null), lock = useRef(false);
    const [data, reload, pickerAuthorized] = useDirectory(mode === 'move' ? dest : null, showHidden);
    useEffect(() => {
      const before = document.activeElement, d = ref.current;
      d.showModal(); closeRef.current.focus();
      return () => { d.close(); if (before?.isConnected) before.focus(); };
    }, []);
    useEffect(() => {
      if (mode === 'rename') { const input = ref.current.querySelector('input'); input.focus(); input.select(); }
      else if (mode !== 'menu') closeRef.current.focus();
    }, [mode]);
    const writable = entry.protected === false;
    const blocked = p => /^\/(proc|sys|dev)(?:\/|$)/.test(p) || (entry.type === 'dir' && inside(p, entry.path));
    const same = dest === parent(entry.path);
    const badName = !name.trim() || ['.', '..'].includes(name) || /[\/\0]/.test(name);
    const invalid = mode === 'rename' ? badName || name === entry.name : mode === 'move' ? same || !data.entries || blocked(dest) : false;
    const title = { menu: '项目操作', rename: '重命名', move: '移到文件夹', delete: '确认删除' }[mode];
    async function submit(e) {
      e.preventDefault(); if (!writable || invalid || lock.current || mode === 'menu') return;
      lock.current = true; setBusy(true); setError('');
      try {
        const path = entry.path;
        await request(mode, mode === 'rename' ? { path, name } : mode === 'move' ? { path, destination: dest } : { path });
        onMutated(mode, path, mode === 'rename' ? join(parent(path), name) : mode === 'move' ? join(dest, entry.name) : null);
      } catch (e) { setError(message(e)); } finally { lock.current = false; setBusy(false); }
    }
    const action = (key, text, click) => button(text, click, key === 'delete' ? 'action lfiles-danger' : 'action', group(icon(key), text));
    const go = p => { if (!blocked(p)) { setError(''); setDest(p); } };
    const dirs = data.entries?.filter(d => d.type === 'dir'), shortcuts = favorites.filter(p => !blocked(p) && p);
    return h('dialog', { ref, className: 'lfiles-dialog', 'aria-label': title, onCancel: e => { e.preventDefault(); if (!lock.current) onClose(); }, onClick: e => { if (!lock.current && e.target === ref.current) onClose(); } },
      h('form', { className: 'lfiles-card', onSubmit: submit },
        h('header', { className: 'lfiles-dialog-head' }, h('h2', null, title), button('关闭', onClose, 'icon-btn', icon('close'), { ref: closeRef, disabled: busy })),
        h('div', { className: 'lfiles-dialog-body' },
          h('div', { className: 'lfiles-summary' }, badge(entry.type), h('div', null, h('strong', null, entry.name), h('small', null, parent(entry.path)))),
          mode === 'menu' && h('div', { className: 'lfiles-actions' }, entry.type === 'dir' && action('star', favorites.includes(entry.path) ? '取消收藏' : '收藏文件夹', onFavorite), !writable && h('p', {className:'lfiles-note'}, '不能修改这个受保护的目录本身。'), writable && group(action('rename', '重命名', () => setMode('rename')), action('move', '移动到…', () => setMode('move')), action('delete', '删除…', () => setMode('delete')))),
          mode === 'rename' && h('label', { className: 'lfiles-field' }, '新名称', h('input', { value: name, autoComplete: 'off', disabled: busy, onChange: e => { setName(e.target.value); setError(''); } }), badName && h('small', null, '请输入有效名称，不能包含 / 或使用 .、..。')),
          mode === 'delete' && h('p', { className: 'lfiles-warning' }, entry.type === 'dir' ? '将永久删除此文件夹及其内容，无法撤销。' : '将永久删除此项目，无法撤销。'),
          mode === 'move' && group(h('p', { className: 'lfiles-label' }, '选择目标目录'), h(Crumbs, { path: dest, go, disabled: busy }),
            h(HiddenToggle, { value: showHidden, change: changeHidden, disabled: busy }),
            pickerAuthorized && shortcuts.length > 0 && h('label', { className: 'lfiles-field' }, '从收藏跳转', h('select', { value: '', disabled: busy, onChange: e => { if (e.target.value) go(e.target.value); } }, h('option', { value: '' }, '选择收藏的目录…'), shortcuts.map(p => h('option', { key: p, value: p }, p)))),
            data.error ? h(Empty, { title: '目录读取失败', detail: data.error, retry: reload }) : !dirs ? h(Empty, { title: '正在读取目录…' }) : !dirs.length ? h('p', { className: 'lfiles-note' }, '没有可见的子文件夹。') : h('div', { className: 'lfiles-picker' }, dirs.map(d => button(d.name, () => go(d.path), 'pick', group(icon('dir'), h('span', null, d.name), h('small', null, blocked(d.path) ? '不可选' : icon('next'))), { key: d.path, disabled: busy || blocked(d.path) })))),
          error && h('p', { role: 'alert', className: 'lfiles-warning' }, error, ' 请检查后重试。')),
        mode !== 'menu' && h('footer', { className: 'lfiles-footer' }, mode === 'move' && h('p', null, same ? '当前位置是原目录，请选择其他目录。' : `目标：${dest}`), button('取消', onClose, 'secondary', null, { disabled: busy }), h('button', { className: `lfiles-primary${mode === 'delete' ? ' lfiles-destructive' : ''}`, type: 'submit', disabled: invalid || busy }, busy ? '处理中…' : { move: '移动到这里', delete: '永久删除', rename: '保存名称' }[mode]))));
  }

  function FavoriteMenu({ favorites, current, home, toggle, go, onClose }) {
    const ref = useRef(null), close = useRef(null);
    useEffect(() => {
      const el = ref.current, before = document.activeElement; el.showModal(); close.current.focus();
      return () => { el.close(); if (before?.isConnected) before.focus(); };
    }, []);
    return h('dialog', {ref, className:'lfiles-dialog', 'aria-label':'收藏目录', onCancel:e=>{e.preventDefault();onClose();}, onClick:e=>{if(e.target===ref.current)onClose();}},
      h('div', {className:'lfiles-card'}, h('header', {className:'lfiles-dialog-head'}, h('h2',null,'收藏目录'), button('关闭',onClose,'icon-btn',icon('close'),{ref:close})),
        h('div',{className:'lfiles-dialog-body'},
          button(favorites.includes(current)?'取消收藏当前目录':'收藏当前目录',()=>toggle(current),'action',group(icon('star',favorites.includes(current)),favorites.includes(current)?'取消收藏当前目录':'收藏当前目录'),{disabled:!current}),
          button('返回主目录',()=>go(home),'action',group(icon('home'),'返回主目录')),
          favorites.length ? h('ul',{className:'lfiles-list','aria-label':'收藏目录'},favorites.map(p=>h('li',{className:'lfiles-row',key:p},
            button(p,()=>go(p),'item',group(badge('dir'),h('span',{className:'lfiles-item-text'},h('strong',null,p==='/'?'根目录':base(p)),h('small',null,p)))),
            button(`取消收藏 ${p}`,()=>toggle(p),'icon-btn',icon('star',true))))):h('p',{className:'lfiles-note'},'还没有收藏，可先收藏当前目录。'))));
  }
  return function FileBrowser() {
    const [path,setPath]=useState(''), [home,setHome]=useState(''), [saved,setFavorites]=useState(folders), [favoriteMenu,setFavoriteMenu]=useState(false);
    const [showHidden,setHidden]=useState(()=>stored(HIDDEN,false)===true);
    const [data,reload,authorized]=useDirectory(path,showHidden);
    const knownHome=data.home || home, current=data.directory || path || knownHome;
    const favorites=knownHome ? canonicalFavorites(saved,knownHome) : [];
    const [menu,setMenu]=useState(null), [preview,setPreview]=useState(null), [notice,setNotice]=useState('');
    const scroll=useRef(null), opener=useRef(null);
    useEffect(()=>{ if(data.home) setHome(data.home); },[data.home]);
    useEffect(()=>{ if(authorized && knownHome && saved.some(p=>!p.startsWith('/'))) save(canonicalFavorites(saved,knownHome)); },[knownHome,saved,authorized]);
    useEffect(()=>{ if(!authorized) { setFavoriteMenu(false);setMenu(null); } },[authorized]);
    useEffect(()=>{ if(scroll.current)scroll.current.scrollTop=0; },[path]);
    useEffect(()=>{
      const sync=e=>{ if(!e.key||e.key===FAV)setFavorites(folders()); if(!e.key||e.key===HIDDEN)setHidden(stored(HIDDEN,false)===true); };
      window.addEventListener('storage',sync);return ()=>window.removeEventListener('storage',sync);
    },[]);
    function persist(key,value) { try {localStorage.setItem(key,JSON.stringify(value));} catch {setNotice('当前浏览器无法保存设置，修改仅在此页面有效。');} }
    function changeHidden(value) {setHidden(value);persist(HIDDEN,value);}
    function save(next) {setFavorites(next);persist(FAV,next);}
    function toggle(p) {const was=favorites.includes(p);setNotice(was?'已取消收藏。':'已收藏文件夹。');save(was?favorites.filter(x=>x!==p):[...favorites,p]);}
    function go(p) {setFavoriteMenu(false);setPath(p);setNotice('');}
    function mutated(mode,from,dest) {
      setNotice({move:'已移到目标目录。',rename:'名称已更新。',delete:'已永久删除。'}[mode]);
      if(favorites.some(p=>inside(p,from)))save([...new Set(favorites.flatMap(p=>!inside(p,from)?[p]:dest===null?[]:[dest+p.slice(from.length)]))]);
      setMenu(null);reload();
    }
    function row(e) {
      const mutable=e.protected === false;
      function open(event) { if(e.type==='dir')go(e.path);else if(e.type==='file'){opener.current=event.currentTarget;setPreview(e);}else setMenu(e); }
      const meta=[e.type==='file'?bytes(e.size):types[e.type],Number.isFinite(e.mtime)&&dates.format(e.mtime)].filter(Boolean).join(' · ');
      return h('li',{className:'lfiles-row',key:e.path},button(e.name,open,'item',group(badge(e.type),h('span',{className:'lfiles-item-text'},h('strong',null,e.name),h('small',null,meta)),favorites.includes(e.path)&&h('span',{className:'lfiles-mark',title:'已收藏'},icon('star',true)))),(mutable||e.type==='dir')&&button(`${e.name}：更多操作`,()=>setMenu(e),'icon-btn',icon('more')));
    }
    return h('div',{className:'lfiles-browser'},
      h('div',{className:'lfiles-scroll',hidden:Boolean(preview),ref:scroll},h('div',{className:'lfiles-content'},
        current && authorized ? h(Crumbs,{path:current,go}) : path ? button('返回主目录',()=>go(''),'secondary') : h('nav',{className:'lfiles-crumbs lfiles-initial','aria-label':'目录路径'},'主目录'),
        h('div',{className:'lfiles-tools'},h(HiddenToggle,{value:showHidden,change:changeHidden}), h('div',{className:'lfiles-tool-actions'},button('收藏目录',()=>setFavoriteMenu(true),'icon-btn',icon('star',favorites.includes(current)),{disabled:!authorized,'aria-haspopup':'dialog'}),button('刷新目录',reload,'icon-btn',icon('refresh')))),
        notice&&h('p',{className:'lfiles-notice',role:'status'},notice),
        data.error?h(Empty,{title:'无法读取这个目录',detail:data.error,retry:reload}):!data.entries?h(Empty,{title:'正在读取目录…'}):!data.entries.length?h(Empty,{title:'没有可见项目',detail:showHidden?'这个文件夹是空的。':'可打开「显示隐藏文件」查看点号开头的项目。'}):h('ul',{className:'lfiles-list','aria-label':'目录内容'},data.entries.map(row)))),
      favoriteMenu&&authorized&&h(FavoriteMenu,{favorites,current:data.directory,home:knownHome,toggle,go,onClose:()=>setFavoriteMenu(false)}),
      menu&&authorized&&h(Actions,{key:menu.path,entry:menu,showHidden,changeHidden,favorites,onClose:()=>setMenu(null),onFavorite:()=>{toggle(menu.path);setMenu(null);},onMutated:mutated}),
      preview&&h(Preview,{entry:preview,onClose:()=>{setPreview(null);requestAnimationFrame(()=>opener.current?.focus());}}));
  };
}
