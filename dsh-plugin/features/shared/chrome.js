// Shared toolbox chrome, inlined into every client factory by scripts/build.mjs.
// Keep panel keys in sync with the registrations in features/*/client.js.
const KIT_HOME = 'pocket-kit.home';
const KIT_LAST_KEY = 'pocket-kit.last-panel.v1';
const KIT_PANELS = new Set([
  'pocket-kit.home',
  'pocket-kit.music',
  'pocket-kit.xiaoai',
  'pocket-kit.xiaoai-control',
  'pocket-kit.health',
  'pocket-kit.beijing-pass',
  'pocket-kit.bill-manager',
  'shortcuts',
  'local.outing-checklist',
  // The native terminal entry is intentionally excluded: returning to it would
  // auto-open a terminal instead of restoring a normal toolbox page.
]);

function kitStorage() {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

function kitLastPanel() {
  try {
    const value = kitStorage()?.getItem(KIT_LAST_KEY);
    return typeof value === 'string' && KIT_PANELS.has(value) ? value : KIT_HOME;
  } catch { return KIT_HOME; }
}

function kitRememberPanel(id) {
  if (typeof id !== 'string' || !KIT_PANELS.has(id)) return;
  try { kitStorage()?.setItem(KIT_LAST_KEY, id); } catch {}
}

// The launcher opens the last normal toolbox page. A stale panel key (for
// example after unloading a feature) falls back to the toolbox home.
function kitOpenLast(ctx) {
  const target = kitLastPanel();
  try { ctx.layout.selectPanel(target); } catch { ctx.layout.selectPanel(KIT_HOME); }
}

const KIT_HISTORY_KEY = Symbol.for('pocket-kit.history.v1');

function kitPanelDepth(id) {
  if (id === null || id === undefined) return 0;
  if (id === KIT_HOME) return 1;
  return KIT_PANELS.has(id) ? 2 : 0;
}

// Browser/Android back has no history entry to move through while the toolbox
// swaps panels, so it leaves the whole app. Bookmark one entry whenever we go
// one level deeper, then treat back as "up one kit level".
function kitTrackHistory(ctx) {
  const store = ctx.layout?.panelInfo;
  const history = typeof window !== 'undefined' ? window.history : null;
  if (!store?.getSnapshot || !history?.pushState || typeof window.addEventListener !== 'function') return;
  window[KIT_HISTORY_KEY]?.stop?.();
  let last = store.getSnapshot()?.activePanelId ?? null;
  const push = () => { try { history.pushState({'pocket-kit': true}, ''); } catch {} };
  if (kitPanelDepth(last) > 1) push();
  const sync = () => {
    const id = store.getSnapshot()?.activePanelId ?? null;
    const before = kitPanelDepth(last), after = kitPanelDepth(id);
    last = id;
    if (after > before && after > 1) push();
  };
  const unsubscribe = typeof store.subscribe === 'function' ? store.subscribe(sync) : undefined;
  const onPop = () => {
    const depth = kitPanelDepth(store.getSnapshot()?.activePanelId ?? null);
    try {
      if (depth > 1) ctx.layout.selectPanel(KIT_HOME);
    } catch {}
  };
  window.addEventListener('popstate', onPop);
  const entry = {
    document: typeof document !== 'undefined' ? document : undefined,
    stop() { unsubscribe?.(); window.removeEventListener('popstate', onPop); },
  };
  try { window[KIT_HISTORY_KEY] = entry; } catch {}
  return () => {
    if (window[KIT_HISTORY_KEY] === entry) { try { delete window[KIT_HISTORY_KEY]; } catch {} }
    entry.stop();
  };
}

function kitTrackLastPanel(ctx) {
  const store = ctx.layout?.panelInfo;
  if (!store?.getSnapshot) return;
  const sync = () => {
    const id = store.getSnapshot()?.activePanelId;
    if (typeof id === 'string') kitRememberPanel(id);
  };
  sync();
  const unsubscribe = typeof store.subscribe === 'function' ? store.subscribe(sync) : undefined;
  const stopHistory = kitTrackHistory(ctx);
  return () => { unsubscribe?.(); stopHistory?.(); };
}

const KIT_NAV_CSS = `.kit-nav{display:inline-flex;align-items:center;min-width:0;margin-left:auto;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);border-radius:11px;background:var(--dsw-alias-bg-base)}.kit-nav .kit-nav-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 13px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;transition:background-color .15s}.kit-nav .kit-nav-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent)}.kit-nav .kit-nav-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.kit-nav .kit-nav-btn svg{width:15px;height:15px;flex:none;opacity:.82}.kit-nav-compact{justify-content:flex-end}@media(max-width:640px){.kit-nav{width:auto;justify-content:flex-end}.kit-nav .kit-nav-btn{min-height:38px;padding:0 12px}}@media(prefers-reduced-motion:reduce){.kit-nav .kit-nav-btn{transition:none}}`;

function KitChatIcon() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('path', { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H9l-5 4V5.5z' }),
    h('path', { d: 'M8 8h8M8 11h5' }));
}

function KitNavActions({ chat, compact = false }) {
  return h(React.Fragment, null,
    h('style', null, KIT_NAV_CSS),
    h('div', { className: 'kit-nav' + (compact ? ' kit-nav-compact' : ''), role: 'group', 'aria-label': '页面导航' },
      h('button', { type: 'button', className: 'kit-nav-btn', onClick: chat, 'aria-label': '返回会话' }, h(KitChatIcon), h('span', null, '返回会话'))));
}
