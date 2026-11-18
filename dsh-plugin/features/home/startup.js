// 显式入口参数决定本次是否展示首页：?toolbox=1 固定展示，?toolbox=0 固定不展示。
// 不带参数时沿用上次状态，保持原有无参数入口的行为。
function forcedHomeStartup() {
  try {
    const value = new URL(window.location.href).searchParams.get('toolbox');
    return value === '1' ? 'open' : value === '0' ? 'closed' : null;
  } catch { return null; }
}

// ?toolbox=1 的独立入口只展示工具页面：隐藏宿主三栏框架的左右两列，中间列自动占满，
// 浮层（连接测速等）保持可见。只在面板打开期间生效，关闭后恢复。
// 面板状态取自 layout 的 panelInfo，只用 CSS 改当前 document，不改宿主文件、不监听 DOM。
function mountImmersiveChrome(ctx) {
  const noop = () => {};
  if (typeof window === 'undefined' || typeof document === 'undefined') return noop;
  let immersive = false;
  try { immersive = new URL(window.location.href).searchParams.get('toolbox') === '1'; } catch { return noop; }
  if (!immersive) return noop;
  const store = ctx?.layout?.panelInfo;
  if (typeof store?.subscribe !== 'function' || typeof store?.getSnapshot !== 'function') return noop;
  const style = document.createElement('style');
  style.dataset.pocketKitChrome = '';
  // sidebarCol / rightbarCol 是宿主框架的左右两列；:has(>[data-shell-overlay]) 命中框架本身，
  // 把网格收成单列。分栏拖动条（handle）隐藏后留着会挡住中间列的点击，一并去掉。
  style.textContent = 'html.pk-immersive [class*="sidebarCol"],html.pk-immersive [data-rightbar-col],html.pk-immersive [data-shell-leading]{display:none!important}'
    + 'html.pk-immersive :has(>[data-shell-overlay]){grid-template-columns:0 minmax(0,1fr) 0!important}'
    + 'html.pk-immersive :has(>[data-shell-overlay])>[class*="handle"]{display:none!important}'
    + 'html.pk-immersive [data-global-panel]{padding-top:0!important}';
  document.head.append(style);
  const sync = () => document.documentElement.classList.toggle('pk-immersive', store.getSnapshot()?.activePanelId != null);
  sync();
  const stop = store.subscribe(sync);
  return () => {
    if (typeof stop === 'function') stop();
    style.remove();
    document.documentElement.classList.remove('pk-immersive');
  };
}

function trackHomeOpen(ctx, panel = 'pocket-kit.home') {
  // 固定入口只决定本次导航，不覆盖“上次是否开启”，两个 URL 互不影响。
  if (forcedHomeStartup() !== null) return;
  const store = ctx.layout?.panelInfo;
  if (typeof store?.subscribe !== 'function') return;
  // 不同步初始快照：宿主启动时的Conversation不是用户主动关闭，不能覆盖旧记录。
  return store.subscribe(() => {
    const id = store.getSnapshot()?.activePanelId;
    const open = id === panel || (typeof KIT_PANELS !== 'undefined' && KIT_PANELS.has(id));
    try { window.localStorage?.setItem('pocket-kit.home.open.v1', String(open)); } catch {}
  });
}

// 裸入口按上次工具箱开关状态展示首页，不改变或释放当前Session。
function mountHomeStartup(ctx, panel = 'pocket-kit.home') {
  const noop = () => {};
  if (typeof window === 'undefined' || typeof document === 'undefined') return noop;
  const key = Symbol.for('pocket-kit.home.startup.v1');
  const previous = window[key];
  if (previous?.document === document) return noop;
  // 即使本次跳过也消费机会；卸载绝不删除，避免热更新反复抢页。
  const state = { document, reason: 'pending' };
  try { window[key] = state; } catch { return noop; }
  const forced = forcedHomeStartup();
  const attempt = () => {
    try {
      const layout = ctx.layout;
      if (!layout?.panelInfo?.getSnapshot || typeof layout.selectPanel !== 'function') {
        state.reason = 'layout-unavailable'; return noop;
      }
      if (forced === 'open') {
        // 参数入口无条件进入首页，覆盖上次状态和已恢复的面板。
        layout.selectPanel(panel);
        state.reason = 'forced-open'; return noop;
      }
      if (forced === 'closed') { state.reason = 'forced-closed'; return noop; }
      const current = new URL(window.location.href);
      const explicitBase = typeof document.querySelector === 'function' ? document.querySelector('base[href]') : undefined;
      const base = new URL(explicitBase || typeof document.querySelector !== 'function' ? document.baseURI : '/', current);
      // 不读取查询参数值；任何查询/fragment/非入口路径都保守视为显式导航。
      if (current.origin !== base.origin || current.pathname !== base.pathname || current.search || current.hash) {
        state.reason = 'explicit-location'; return noop;
      }
      try {
        if (window.localStorage?.getItem('pocket-kit.home.open.v1') === 'false') {
          state.reason = 'remembered-closed'; return noop;
        }
      } catch {}
      if (layout.panelInfo.getSnapshot().activePanelId != null) {
        state.reason = 'existing-panel'; return noop;
      }
      // 未记录或上次开启时展示首页；不触碰Session引用。
      layout.selectPanel(panel);
      state.reason = 'selected';
    } catch {
      // Slot注册/布局生命周期竞态时不重试，更不能在用户稍后操作后抢页。
      state.reason = 'unavailable';
    }
    return noop;
  };
  if (typeof ctx.effect === 'function') ctx.effect(attempt);
  else attempt();
  return noop;
}
