window.__ModuleLoader__.load({
  id: '@local/photo-lab',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback } = React;

    const ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10.5" r="1.6"/><path d="M4 17.5 9.5 12l3.5 3 2.5-2 5 4.5"/></svg>';

    const STYLE_LABEL = {
      natural: '自然通透', film: '暖调胶片', cinema: '冷调电影', fresh: '日系清淡',
      golden: '金色黄昏', teal: '青橙电影', moody: '暗调氛围', vivid: '鲜艳通透',
      soft: '柔和人像', mono: '中性黑白', noir: '高反差黑白'
    };
    const STYLE_DESC = {
      natural: '亮、干净、颜色准；适合大多数动物和风景',
      film: '高光偏黄、黑位发灰、有颗粒；适合秋冬、树林、毛皮',
      cinema: '暗部偏青、高光偏暖、对比强；适合雾、逆光、白虎',
      fresh: '亮、低饱和、低对比；适合草地、留白多的画面',
      golden: '暖橙、高光发金；适合夕阳、逆光毛边',
      teal: '暗部偏冷、高光偏暖；适合城市、水面、动物特写',
      moody: '压暗、降饱和、重暗角；适合氛围照、雨天',
      vivid: '高饱和、通透；适合花、天空、色彩丰富的场景',
      soft: '低对比、肤色柔和；适合人像、孩子、家庭照',
      mono: '中性黑白，结构清楚；适合斑马、纹理',
      noir: '高反差黑白；适合剪影、硬光、粗糙纹理'
    };

    const CSS = `
.pl-hbtn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;min-width:28px;padding:0 7px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.pl-hbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pl-hbtn[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pl-hbtn .pl-count{font-size:11px;font-variant-numeric:tabular-nums}
.pl-panel{position:fixed;z-index:40;top:var(--dsh-frame-chrome-top,0px);right:0;bottom:0;width:min(520px,100vw);display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l1);box-shadow:-18px 0 48px rgba(0,0,0,.16);font-size:13px;color:var(--dsw-alias-label-primary)}
.pl-panel[data-full="true"]{width:100vw;left:0;border-left:0}
.pl-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.pl-title{font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px}
.pl-dir{margin-left:auto;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px;direction:rtl}
.pl-ico{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.pl-ico:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pl-body{flex:1;min-height:0;display:flex;flex-direction:column}
.pl-empty{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;padding:28px}
.pl-empty input{width:min(320px,90%);height:36px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:inherit;font-size:13px}
.pl-empty .pl-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:center;line-height:1.6;max-width:320px}
.pl-btn{height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:inherit;cursor:pointer;font-size:12.5px;white-space:nowrap}
.pl-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.pl-btn:disabled{opacity:.45;cursor:default}
.pl-btn[data-primary="true"]{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-on-color,#fff);border-color:transparent}
.pl-btn[data-on="true"]{border-color:var(--dsw-alias-border-selected);background:var(--dsw-alias-bg-layer-2);font-weight:600}
.pl-decision{gap:6px}
.pl-decision .pl-btn{flex:1;height:36px}
.pl-toolbar{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.pl-toolbar-main{display:flex;align-items:center;gap:8px}
.pl-toolbar-sub{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pl-styleHint{font-size:11.5px;line-height:1.4;color:var(--dsw-alias-label-tertiary);padding:0 2px}
.pl-meta{color:var(--dsw-alias-label-tertiary);font-size:12px;margin-right:auto}
.pl-tabs{display:flex;gap:4px;padding:6px 10px;overflow-x:auto;scrollbar-width:none}
.pl-tabs::-webkit-scrollbar{display:none}
.pl-tab{height:26px;padding:0 9px;border-radius:6px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:12px;cursor:pointer}
.pl-tab[data-on="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pl-list{flex:1;min-height:0;overflow:auto;padding:6px 10px 14px;display:flex;flex-direction:column;gap:6px}
.pl-row{display:flex;align-items:center;gap:10px;width:100%;padding:6px;border:0;border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:inherit;text-align:left;cursor:pointer;font:inherit}
.pl-row:hover{background:var(--dsw-alias-bg-layer-2)}
.pl-row[data-skip="true"] .pl-thumb{opacity:.5}
.pl-check{width:22px;height:22px;flex:none;margin:0 0 0 2px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.pl-thumb{width:96px;height:66px;flex:none;border-radius:7px;object-fit:cover;background:#1a1a1a}
.pl-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.pl-rowHead{display:flex;align-items:center;gap:6px;min-width:0}
.pl-tag{padding:1px 6px;border-radius:5px;font-size:11px;line-height:16px;color:#fff;background:#777;flex:none}
.pl-tag[data-tier="keep"]{background:#2f9e64}
.pl-tag[data-tier="maybe"]{background:#c9922f}
.pl-tag[data-tier="skip"]{background:#7a7a7a}
.pl-tag[data-tier="delete"]{background:#b4483f}
.pl-btn[data-danger="true"]{background:#b4483f;color:#fff;border-color:transparent}
.pl-id{font-size:11.5px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-done{margin-left:auto;font-size:11px;color:#2f9e64;flex:none}
.pl-desc{font-size:12.5px;line-height:1.35;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pl-chev{color:var(--dsw-alias-label-tertiary);font-size:18px;padding-right:2px}
.pl-missing{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(0,0,0,.5);font-size:12px}
.pl-detail{flex:1;min-height:0;display:flex;flex-direction:column}
.pl-stageWrap{position:relative;flex:1;min-height:0;background:#0d0d0d;overflow:hidden}
.pl-stage{position:absolute;inset:0;overflow:auto;touch-action:none;scrollbar-width:none}
.pl-stage::-webkit-scrollbar{display:none}
.pl-canvas{position:relative;width:100%;height:100%}
.pl-canvas img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none}
.pl-compareBtn{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);height:40px;padding:0 16px;border-radius:20px;border:0;background:rgba(255,255,255,.92);color:#1a1a1a;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.35);cursor:pointer;touch-action:none;user-select:none;z-index:3}
.pl-compareBtn[data-on="true"]{background:#1a1a1a;color:#fff}
.pl-zoom{position:absolute;right:8px;bottom:8px;display:flex;gap:4px;z-index:2}
.pl-zoom button{width:32px;height:32px;border-radius:8px;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:15px;cursor:pointer}
.pl-detailBar{padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:8px;overflow:auto;max-height:60%}
.pl-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.pl-reasons{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
.pl-reasons b{color:var(--dsw-alias-label-primary);font-weight:600}
.pl-noteArea{width:100%;min-height:58px;max-height:160px;resize:vertical;padding:7px 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:12.5px;line-height:1.45;box-sizing:border-box}
.pl-versions{overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.pl-versions::-webkit-scrollbar{display:none}
.pl-versionsLabel{font-size:11.5px;color:var(--dsw-alias-label-tertiary);flex:none}
.pl-finalTag{margin-left:4px;padding:0 4px;border-radius:4px;background:#2f9e64;color:#fff;font-size:10px;line-height:15px;flex:none}
.pl-setFinal{margin-left:auto;height:26px;font-size:11.5px;flex:none}
.pl-verBtn{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:11.5px;cursor:pointer;flex:none}
.pl-verBtn[data-on="true"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-selected);color:var(--dsw-alias-label-primary)}
.pl-verStyle{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.pl-noteState{font-size:11.5px;color:var(--dsw-alias-label-tertiary);margin-left:auto}
.pl-foot{padding:6px 12px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11.5px;display:flex;gap:8px;align-items:center;min-height:30px}
.pl-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:60;padding:7px 14px;border-radius:8px;background:rgba(20,20,20,.9);color:#fff;font-size:12.5px;pointer-events:none}
`;

    /* ---------- api ---------- */
    async function call(body) {
      const res = await fetch(new URL('api/photo-lab', document.baseURI), {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Photo-Lab': '1' },
        body: JSON.stringify(body)
      });
      let data = null;
      try { data = await res.json(); } catch { /* ignore */ }
      if (!res.ok) { const e = new Error((data && data.error) || '请求失败'); e.status = res.status; throw e; }
      return data;
    }

    async function fetchState({ projectId, sessionId }) {
      const url = new URL('api/photo-lab/state', document.baseURI);
      if (projectId) url.searchParams.set('p', projectId);
      if (sessionId) url.searchParams.set('s', sessionId);
      const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || '读取失败');
      return data;
    }

    /* ---------- shared session runtime ---------- */
    const shared = { sessionId: null, inputActions: null, input: null, open: false, listeners: new Set() };
    function publish(patch) { Object.assign(shared, patch); for (const fn of shared.listeners) fn(); }
    function useShared() {
      const [, force] = useState(0);
      useEffect(() => { const fn = () => force(v => v + 1); shared.listeners.add(fn); return () => shared.listeners.delete(fn); }, []);
      return shared;
    }

    /* ---------- message sending ---------- */
    function sendToSession(text, toast) {
      const { inputActions, input } = shared;
      if (!inputActions) { toast('还没连上输入框，点一下聊天框再试'); return false; }
      const busy = input && input.phase && !['plain', 'claimed'].includes(input.phase);
      if (busy) { toast('会话正在忙，稍后再发'); return false; }
      try {
        const current = (input && typeof input.text === 'string') ? input.text : '';
        if (current.trim()) {
          const span = { start: current.length, end: current.length, draftRev: input.draftRev };
          inputActions.insertText(`\n${text}`, span);
        } else if (typeof inputActions.setDraft === 'function') {
          inputActions.setDraft(text);
        } else {
          inputActions.insertText(text, { start: 0, end: 0, draftRev: input && input.draftRev });
        }
        inputActions.persistDraft && inputActions.persistDraft();
        inputActions.submit && inputActions.submit();
        toast('已发给会话');
        return true;
      } catch (error) {
        toast('发送失败：' + error.message);
        return false;
      }
    }

    /* ---------- components ---------- */
    function Toast({ text }) {
      if (!text) return null;
      return h('div', { className: 'pl-toast' }, text);
    }

    function HeaderButton(props) {
      const open = useShared().open;
      useEffect(() => {
        publish({ sessionId: props.sessionId, inputActions: props.inputActions, input: props.input });
      }, [props.sessionId, props.inputActions, props.input]);
      return h(React.Fragment, null, h('style', null, CSS), h('button', {
        type: 'button', className: 'pl-hbtn', title: '修图工作台', 'aria-label': '修图工作台',
        'data-active': open ? 'true' : 'false',
        onPointerDown: event => event.stopPropagation(),
        onClick: () => publish({ open: !shared.open })
      }, h('span', { style: { display: 'inline-flex' }, dangerouslySetInnerHTML: { __html: ICON } }), h('span', { className: 'pl-count' }, '修图')));
    }

    function Row({ photo, onOpen, picked, onPick }) {
      const tier = photo.triage ? photo.triage.tier : null;
      const deleted = photo.effective === 'delete';
      const userDecided = photo.decision && photo.decision.by === 'user';
      const tone = photo.missing ? 'skip' : deleted ? 'delete' : photo.effective === 'keep' ? 'keep' : (tier === 'maybe' && !userDecided ? 'maybe' : 'skip');
      const removed = !!photo.deletedAt;
      const badge = photo.missing ? (removed ? '已删' : '缺失')
        : deleted ? '标删'
        : photo.effective === 'keep' ? (userDecided ? '保留' : '建议修')
        : photo.effective === 'skip' ? (userDecided ? '已跳过' : (tier === 'maybe' ? '待定' : '跳过'))
        : '未初筛';
      const reason = photo.missing ? (photo.deletedAt ? '原图已按标删清理' : '文件已不在目录')
        : photo.triage
          ? (photo.triage.reasons && photo.triage.reasons[0]) || (photo.triage.problems && photo.triage.problems[0]) || photo.triage.direction || '已初筛'
          : '还没初筛';
      return h('div', {
        className: 'pl-row', 'data-skip': photo.effective === 'skip' ? 'true' : 'false',
        role: 'button', tabIndex: 0,
        onClick: () => onOpen(photo.id),
        onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') onOpen(photo.id); }
      },
        h('input', {
          className: 'pl-check', type: 'checkbox', checked: !!picked, 'aria-label': '选择这张',
          onClick: event => event.stopPropagation(),
          onChange: event => onPick(photo.id, event.target.checked)
        }),
        h('img', { className: 'pl-thumb', src: photo.thumb, loading: 'lazy', alt: '' }),
        h('div', { className: 'pl-info' },
          h('div', { className: 'pl-rowHead' },
            h('span', { className: 'pl-tag', 'data-tier': tone }, badge),
            h('span', { className: 'pl-id' }, photo.id),
            photo.final ? h('span', { className: 'pl-finalTag' }, `导出 v${photo.final}`) : (photo.after ? h('span', { className: 'pl-done' }, '已修') : null)
          ),
          h('div', { className: 'pl-desc' }, reason)
        ),
        h('span', { className: 'pl-chev' }, '›')
      );
    }

    function CompareStage({ photo, zoom, setZoom, base }) {
      const [pressed, setPressed] = useState(false);
      const stageRef = useRef(null);
      const drag = useRef(null);
      const hasAfter = !!photo.after;

      const down = event => {
        const stage = stageRef.current;
        if (!stage || zoom <= 1) return;
        drag.current = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
        if (stage.setPointerCapture) stage.setPointerCapture(event.pointerId);
      };

      const move = event => {
        const state = drag.current;
        const stage = stageRef.current;
        if (!state || !stage) return;
        stage.scrollLeft = state.left - (event.clientX - state.x);
        stage.scrollTop = state.top - (event.clientY - state.y);
      };

      const up = () => { drag.current = null; };

      const holdStart = event => {
        event.stopPropagation();
        event.preventDefault();
        setPressed(true);
        if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
      };
      const holdEnd = () => setPressed(false);

      useEffect(() => { const stage = stageRef.current; if (stage && zoom === 1) { stage.scrollLeft = 0; stage.scrollTop = 0; } }, [zoom]);

      return h('div', { className: 'pl-stageWrap' },
        h('div', {
          className: 'pl-stage', ref: stageRef,
          onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up
        },
          h('div', { className: 'pl-canvas', style: { width: `${zoom * 100}%`, height: `${zoom * 100}%` } },
            h('img', { src: photo.after || photo.before, alt: '修后', draggable: false, style: { display: pressed ? 'none' : 'block' } }),
            h('img', { src: base === 'original' ? photo.original : photo.before, alt: '原图', draggable: false, style: { display: pressed ? 'block' : 'none' } })
          )
        ),
        hasAfter ? h('button', {
          type: 'button', className: 'pl-compareBtn', 'data-on': pressed ? 'true' : 'false',
          'aria-pressed': pressed,
          onPointerDown: holdStart, onPointerUp: holdEnd, onPointerCancel: holdEnd, onPointerLeave: holdEnd,
          onContextMenu: event => event.preventDefault()
        }, pressed ? '松手看修后' : (base === 'original' ? '按住看原图' : '按住看修前')) : null,
        h('div', { className: 'pl-zoom' },
          h('button', { type: 'button', onClick: () => setZoom(z => Math.min(4, +(z + 0.5).toFixed(1))), title: '放大' }, '+'),
          h('button', { type: 'button', onClick: () => setZoom(z => Math.max(1, +(z - 0.5).toFixed(1))), title: '缩小' }, '−'),
          h('button', { type: 'button', onClick: () => setZoom(1), title: '复位' }, '1:1')
        )
      );
    }

    const PanelBoundary = React.Component ? (class PanelBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) { return { error }; }
      componentDidCatch(error, info) {
        try { console.error('[photo-lab] panel crashed', error, info); } catch { /* ignore */ }
      }
      render() {
        if (this.state.error) {
          return h('div', { className: 'pl-panel', style: { padding: 16, gap: 8 } },
            h('div', { style: { fontWeight: 600 } }, '修图工作台出错了'),
            h('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-error)', whiteSpace: 'pre-wrap' } }, String((this.state.error && this.state.error.message) || this.state.error)),
            h('button', { className: 'pl-btn', onClick: () => this.setState({ error: null }) }, '重试')
          );
        }
        return this.props.children;
      }
    }) : (props => props.children);

    function Panel() {
      const state = useShared();
      const [full, setFull] = useState(false);
      const [dirInput, setDirInput] = useState('');
      const [data, setData] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [tab, setTab] = useState('keep');
      const [current, setCurrent] = useState(null);
      const [zoom, setZoom] = useState(1);
      const [roundPick, setRoundPick] = useState(null);
      const [compareBase, setCompareBase] = useState('aligned');
      const [picked, setPicked] = useState([]);
      const pickedFor = useRef(null);
      const [note, setNote] = useState('');
      const [toast, setToast] = useState('');
      const [confirmPurge, setConfirmPurge] = useState(false);
      const listRef = useRef(null);
      const scrollRef = useRef(0);
      const exportSeen = useRef(null);
      const [style, setStyle] = useState('natural');
      const [customStyle, setCustomStyle] = useState('');
      const toastTimer = useRef(null);
      const styleFor = useRef(null);

      const styleText = () => style === '__custom__'
        ? (customStyle.trim() ? `自定义「${customStyle.trim()}」` : '自定义风格')
        : (STYLE_LABEL[style] || (customStyles.find(item => item.id === style) || {}).name || style);

      const say = text => {
        setToast(text);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 2200);
      };

      const projectId = data && data.project && data.project.id;

      const load = useCallback(async () => {
        if (!state.open) return;
        try {
          const result = await fetchState({ projectId: data && data.project && data.project.id, sessionId: state.sessionId });
          if (result && result.bound === false) { setData(null); return; }
          setData(result);
          const ex = result.exportStatus;
          if (ex && ex.status === 'done' && ex.zip !== exportSeen.current) { exportSeen.current = ex.zip; say(`导出完成：${ex.zip}`); }
          if (styleFor.current !== result.project.id) { styleFor.current = result.project.id; setStyle(result.style || 'natural'); }
          setError('');
        } catch (e) { setError(e.message); }
      }, [state.open, state.sessionId, data && data.project && data.project.id]);

      useEffect(() => { if (!state.open) return; let timer = null; load(); timer = setInterval(load, 3000); return () => clearInterval(timer); }, [state.open, load]);

      useEffect(() => {
        if (!projectId || pickedFor.current === projectId) return;
        pickedFor.current = projectId;
        try { const raw = localStorage.getItem('photo-lab.picked.' + projectId); setPicked(raw ? JSON.parse(raw) : []); }
        catch { setPicked([]); }
      }, [projectId]);

      const updatePicked = next => {
        setPicked(next);
        if (projectId) { try { localStorage.setItem('photo-lab.picked.' + projectId, JSON.stringify(next)); } catch { /* 本地选择不持久化也能用 */ } }
      };
      const pickOne = (id, on) => updatePicked(on ? [...new Set([...picked, id])] : picked.filter(item => item !== id));

      const openDir = async () => {
        const dir = dirInput.trim();
        if (!dir) { say('先填目录路径'); return; }
        setBusy(true);
        try {
          const result = await call({ action: 'open', sessionId: state.sessionId, dir });
          setData({ project: result.project, photos: [] });
          setDirInput('');
          await load();
          say(`已扫描 ${result.scan.total} 张，新增 ${result.scan.added}`);
        } catch (e) { say(e.message); } finally { setBusy(false); }
      };

      const rescan = async () => {
        if (!projectId) return;
        setBusy(true);
        try { const r = await call({ action: 'rescan', projectId }); say(`新增 ${r.scan.added} 张`); await load(); }
        catch (e) { say(e.message); } finally { setBusy(false); }
      };

      const setDecision = async (id, value) => {
        const label = value === 'keep' ? '已标记为修' : value === 'skip' ? '已跳过' : '已标记删除';
        setData(prev => prev ? {
          ...prev,
          photos: prev.photos.map(p => p.id === id ? {
            ...p, effective: value,
            decision: { ...(p.decision || {}), state: value, by: 'user' }
          } : p)
        } : prev);
        say(label);
        try { await call({ action: 'decide', projectId, id, state: value }); await load(); }
        catch (e) { say(e.message); await load(); }
      };

      const bulk = async (value, ids) => {
        const target = ids && ids.length ? ids : visible.map(p => p.id);
        if (!target.length) { say('没有可操作的照片'); return; }
        try { await call({ action: 'bulk', projectId, ids: target, state: value }); await load(); say(`${target.length} 张已${value === 'keep' ? '保留' : '跳过'}`); }
        catch (e) { say(e.message); }
      };
      const pickAll = on => updatePicked(on ? visible.map(p => p.id) : []);

      const askTriage = () => {
        sendToSession(`【工作台】给项目 ${data.project.dir} 做初筛。先调 photo_lab 的 status 确认进度，再用 sheet 生成联系表逐格看，判断完用 update 一次写回清单。

初筛的目的是淘汰：把不值得修的找出来并说明原因，值得留的留下，不要为了凑数留片。

汇报要求：
1. 总张数、留下几张、淘汰几张；
2. 淘汰的按原因归类（主体太小、明显失焦、遮挡、重复机位、光比救不回来、隔着脏玻璃等），各点出文件名；
3. 留下的每张一句话：主体是什么、为什么值得修、打算怎么修；
4. 你实际看到的画面问题。不要只挑三张最值得的说。`, say);
      };

      const askGrade = () => {
        const keepAll = (data.photos || []).filter(p => p.effective === 'keep');
        const chosen = picked.length ? keepAll.filter(p => picked.includes(p.id)) : keepAll;
        if (!chosen.length) { say(picked.length ? '勾选的这些不在“建议修”里' : '还没有选中的照片'); return; }
        const idList = chosen.map(p => p.id).join('、');
        const noted = chosen.filter(p => p.noteState === 'saved' && p.note);
        const noteBlock = noted.length
          ? `\n其中这些照片有批注，优先按批注来：\n${noted.map(p => `- ${p.id}：${p.note}`).join('\n')}\n批注里如果是提问，就直接回答那张、不要修它；是修改要求就按批注调整参数。`
          : '';
        const styleNote = style === '__custom__'
          ? `风格：自定义——「${customStyle.trim() || '你来定'}」。先选一个最接近的基础风格，再用 grade 的 adjust 参数实现这个描述（brightness/saturation/contrast 是倍数，tint 是 [r,g,b] 增益，vignette 是增量），回复里说明你用了哪些参数。`
          : `风格：${styleText()}。`;
        const ok = sendToSession(`【工作台】把这 ${chosen.length} 张修一版：${idList}。${styleNote}用 grade 时带上这些 id，只修这些，先出 1280 预览，不要导出。${noteBlock}\n出完打开一两张预览自检有没有过曝或发灰，再汇报哪几张修了、哪几张没修和原因。`, say);
        if (ok && noted.length) { call({ action: 'notesSent', projectId, ids: noted.map(p => p.id) }).then(load).catch(() => {}); }
      };

      useEffect(() => { if (!confirmPurge) return; const timer = setTimeout(() => setConfirmPurge(false), 4000); return () => clearTimeout(timer); }, [confirmPurge]);

      const doExport = async () => {
        setBusy(true);
        try {
          const r = await call({ action: 'export', projectId });
          say(r.started ? '开始导出，完成后会提示' : '已经在导出了');
          await load();
        } catch (e) { say(e.message); } finally { setBusy(false); }
      };

      const doPurge = async () => {
        if (!confirmPurge) { setConfirmPurge(true); return; }
        setConfirmPurge(false);
        setBusy(true);
        try {
          const r = await call({ action: 'purge', projectId });
          say(`已删除 ${r.deleted.length} 张原图`);
          await load();
        } catch (e) { say(e.message); } finally { setBusy(false); }
      };

      const saveNoteOnly = async () => {
        if (!current) return;
        try { await call({ action: 'note', projectId, id: current.id, note }); await load(); say('批注已保存'); }
        catch (e) { say(e.message); }
      };

      const runNote = async () => {
        if (!current) return;
        const text = note.trim();
        if (!text) { say('先写批注'); return; }
        try { await call({ action: 'note', projectId, id: current.id, note: text }); }
        catch (e) { say(e.message); return; }
        const ok = sendToSession(`【工作台】我在 review 时给 ${current.id} 写了批注：「${text}」。先判断这是提问还是改图要求：提问就直接回答、不要修图；要求改的按批注调整参数并出预览，风格用${styleText()}（批注里明确要别的风格时以批注为准；自定义风格用 adjust 参数实现）；拿不准先问我。`, say);
        if (ok) {
          await call({ action: 'notesSent', projectId, ids: [current.id] });
          await load();
        }
      };

      const setFinalRound = async () => {
        if (!currentPhoto || activeRound == null) return;
        const round = currentPhoto.final === activeRound ? null : activeRound;
        try {
          await call({ action: 'final', projectId, id: currentPhoto.id, round });
          await load();
          say(round ? `导出用 v${round}` : '已取消定稿');
        } catch (e) { say(e.message); }
      };

      const runAllNotes = async () => {
        const pending = photos.filter(p => p.noteState === 'saved' && p.note);
        if (!pending.length) { say('没有待执行的批注'); return; }
        const lines = pending.map(p => `- ${p.id}：${p.note}`).join('\n');
        const ok = sendToSession(`【工作台】我在 review 时给这些照片写了批注，请逐条处理：\n${lines}\n\n先判断每条是提问还是改图要求：提问直接回答、不要修图；要求改的按批注调整参数出预览，风格用${styleText()}（批注里明确要别的风格时以批注为准；自定义风格用 adjust 参数实现）；拿不准先问我。处理完逐条告诉我结果。`, say);
        if (ok) { await call({ action: 'notesSent', projectId, ids: pending.map(p => p.id) }); await load(); }
      };

      const photos = (data && data.photos) || [];
      const customStyles = (data && data.styles) || [];
      const tabs = [
        ['keep', '建议修'],
        ['maybe', '待定'],
        ['skip', '跳过'],
        ['delete', '标删'],
        ['pending', '未初筛'],
        ['done', '已修'],
        ['all', '全部']
      ];
      const pendingMaybe = p => !!p.triage && p.triage.tier === 'maybe' && !(p.decision && p.decision.by === 'user');
      const visible = photos.filter(p => {
        if (tab === 'keep') return p.effective === 'keep';
        if (tab === 'maybe') return pendingMaybe(p);
        if (tab === 'skip') return p.effective === 'skip' && !pendingMaybe(p);
        if (tab === 'delete') return p.effective === 'delete';
        if (tab === 'pending') return !p.triage;
        if (tab === 'done') return p.after;
        return true;
      });
      const currentPhoto = current ? photos.find(p => p.id === current.id) : null;
      const currentIndex = currentPhoto ? visible.findIndex(p => p.id === currentPhoto.id) : -1;
      const goSibling = delta => {
        if (!currentPhoto) return;
        const next = visible[currentIndex + delta];
        if (!next) return;
        setCurrent({ id: next.id });
        setZoom(1); setRoundPick(null); setNote(next.note || '');
      };
      useEffect(() => {
        if (currentPhoto) return undefined;
        const restore = () => { if (listRef.current) listRef.current.scrollTop = scrollRef.current; };
        restore();
        const timer = setTimeout(restore, 60);
        return () => clearTimeout(timer);
      }, [currentPhoto]);

      useEffect(() => {
        if (!currentPhoto) return undefined;
        const onKey = event => {
          if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
          if (event.key === 'ArrowLeft') goSibling(-1);
          else if (event.key === 'ArrowRight') goSibling(1);
          else if (event.key === 'Escape') setCurrent(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [currentPhoto, currentIndex, visible.length]);
      const rounds = (currentPhoto && currentPhoto.rounds) || [];
      const activeRound = roundPick != null && rounds.some(r => r.n === roundPick)
        ? roundPick
        : (rounds.length ? rounds[rounds.length - 1].n : null);
      const roundInfo = rounds.find(r => r.n === activeRound) || null;
      const displayPhoto = currentPhoto && roundInfo
        ? { ...currentPhoto, after: roundInfo.after, before: roundInfo.before }
        : currentPhoto;

      if (!state.open) return null;

      return h(React.Fragment, null,
        h('style', null, CSS),
        h('div', { className: 'pl-panel', 'data-full': full ? 'true' : 'false' },
          h('div', { className: 'pl-head' },
            h('div', { className: 'pl-title' }, '修图工作台'),
            h('div', { className: 'pl-dir', title: data && data.project ? data.project.dir : '' }, data && data.project ? data.project.dir : '未绑定项目'),
            h('button', { type: 'button', className: 'pl-ico', title: full ? '退出全屏' : '全屏', onClick: () => setFull(v => !v) }, full ? '⤡' : '⤢'),
            h('button', { type: 'button', className: 'pl-ico', title: '关闭', onClick: () => publish({ open: false }) }, '✕')
          ),
          !data ? h('div', { className: 'pl-empty' },
            h('div', { style: { fontSize: 14, fontWeight: 600 } }, '选一个照片目录'),
            h('input', { value: dirInput, placeholder: '/home/xuekai/chat', onChange: e => setDirInput(e.target.value), onKeyDown: e => { if (e.key === 'Enter') openDir(); } }),
            h('button', { className: 'pl-btn', 'data-primary': 'true', disabled: busy, onClick: openDir }, busy ? '扫描中…' : '打开'),
            h('div', { className: 'pl-hint' }, '工作台跟这个会话绑定；之后新拍的照片放进同一目录，点「扫描新增」即可。'),
            error ? h('div', { className: 'pl-hint', style: { color: 'var(--dsw-alias-label-error)' } }, error) : null
          ) : currentPhoto ? h('div', { className: 'pl-detail' },
            h(CompareStage, { photo: displayPhoto, zoom, setZoom, base: compareBase, key: `${currentPhoto.id}:${activeRound || 'none'}:${compareBase}` }),
            h('div', { className: 'pl-detailBar' },
              h('div', { className: 'pl-row' },
                h('button', { className: 'pl-btn', onClick: () => setCurrent(null) }, '← 返回'),
                h('button', { className: 'pl-btn', disabled: currentIndex <= 0, onClick: () => goSibling(-1), title: '上一张' }, '‹'),
                h('button', { className: 'pl-btn', disabled: currentIndex < 0 || currentIndex >= visible.length - 1, onClick: () => goSibling(1), title: '下一张' }, '›'),
                h('div', { style: { marginLeft: 'auto', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } },
                  `${currentIndex + 1}/${visible.length} · ${currentPhoto.width}×${currentPhoto.height}`)
              ),
              rounds.length ? h('div', { className: 'pl-row pl-versions' },
                h('span', { className: 'pl-versionsLabel' }, '版本'),
                rounds.map(r => h('button', {
                  key: r.n,
                  className: 'pl-verBtn',
                  'data-on': r.n === activeRound ? 'true' : 'false',
                  onClick: () => setRoundPick(r.n),
                  title: `${STYLE_LABEL[r.style] || r.style} · ${String(r.at || '').slice(0, 16).replace('T', ' ')}`
                }, `v${r.n}`, h('span', { className: 'pl-verStyle' }, r.styleLabel || STYLE_LABEL[r.style] || r.style),
                  r.n === currentPhoto.final ? h('span', { className: 'pl-finalTag' }, '导出') : null)),
                h('button', {
                  className: 'pl-btn pl-setFinal',
                  'data-on': currentPhoto.final === activeRound ? 'true' : 'false',
                  disabled: activeRound == null,
                  onClick: setFinalRound
                }, currentPhoto.final === activeRound ? '取消导出定稿' : '设为导出')
              ) : null,
              currentPhoto.triage ? h('div', { className: 'pl-reasons' },
                h('b', null, currentPhoto.triage.tier === 'keep' ? '值得修' : currentPhoto.triage.tier === 'maybe' ? '可修可不修' : '不值得修'),
                currentPhoto.triage.reasons && currentPhoto.triage.reasons.length ? ' · ' + currentPhoto.triage.reasons.join('；') : '',
                currentPhoto.triage.direction ? h('div', null, '方向：' + currentPhoto.triage.direction) : null
              ) : h('div', { className: 'pl-reasons' }, '还没初筛'),
              h('div', { className: 'pl-row pl-decision' },
                h('button', { className: 'pl-btn', 'data-on': currentPhoto.effective === 'keep' ? 'true' : 'false', onClick: () => setDecision(currentPhoto.id, 'keep') }, '修这张'),
                h('button', { className: 'pl-btn', 'data-on': currentPhoto.effective === 'skip' ? 'true' : 'false', onClick: () => setDecision(currentPhoto.id, 'skip') }, '跳过'),
                h('button', { className: 'pl-btn', 'data-danger': currentPhoto.effective === 'delete' ? 'true' : 'false', onClick: () => setDecision(currentPhoto.id, 'delete') }, '标记删除')
              ),
              h('div', { className: 'pl-row pl-baseRow' },
                h('span', { className: 'pl-versionsLabel' }, '对比基准'),
                h('button', { className: 'pl-verBtn', 'data-on': compareBase === 'aligned' ? 'true' : 'false', onClick: () => setCompareBase('aligned') }, '同构图'),
                h('button', { className: 'pl-verBtn', 'data-on': compareBase === 'original' ? 'true' : 'false', onClick: () => setCompareBase('original') }, '整张原图'),
                h('span', { className: 'pl-noteState' }, compareBase === 'aligned' ? '与修后同构图，只差颜色' : '完整原图，可能比例不同')
              ),
              h('textarea', {
                className: 'pl-noteArea', rows: 2, value: note,
                placeholder: '批注：可以写修改要求（裁成 4:5、背景压暗），也可以写疑问（为什么建议修这张？）',
                onChange: e => setNote(e.target.value)
              }),
              h('div', { className: 'pl-row' },
                h('button', { className: 'pl-btn', onClick: saveNoteOnly }, '保存'),
                h('button', { className: 'pl-btn', 'data-primary': 'true', onClick: runNote }, '执行'),
                h('span', { className: 'pl-noteState' },
                  currentPhoto.noteState === 'sent' ? '已执行' : currentPhoto.noteState === 'saved' ? '已保存，待执行' : '未保存')
              )
            )
          ) : h('div', { className: 'pl-body' },
            h('div', { className: 'pl-toolbar' },
              h('div', { className: 'pl-toolbar-main' },
                h('div', { className: 'pl-meta' }, `${data.project.counts.total} 张 · 建议修 ${data.project.counts.keep} · 已修 ${data.project.counts.graded}`),
                h('button', { className: 'pl-btn', 'data-primary': 'true', disabled: busy, onClick: askGrade },
                  picked.length ? `修勾选的 ${picked.length} 张` : `修全部建议修`)
              ),
              h('div', { className: 'pl-toolbar-sub' },
                h('button', { className: 'pl-btn', disabled: busy, onClick: rescan }, '扫描新增'),
                h('button', { className: 'pl-btn', disabled: busy || !data.photos.length, onClick: askTriage }, '初筛'),
                h('button', { className: 'pl-btn', disabled: busy || !visible.length, onClick: () => pickAll(true) }, '全选'),
                h('button', { className: 'pl-btn', disabled: busy || !picked.length, onClick: () => pickAll(false) }, '全不选'),
                picked.length ? h('button', { className: 'pl-btn', onClick: () => bulk('keep', picked) }, `保留 ${picked.length}`) : null,
                picked.length ? h('button', { className: 'pl-btn', onClick: () => bulk('skip', picked) }, `跳过 ${picked.length}`) : null,
                h('button', {
                  className: 'pl-btn', disabled: busy || (data.exportStatus && data.exportStatus.status === 'running'),
                  onClick: doExport
                }, data.exportStatus && data.exportStatus.status === 'running'
                  ? `导出中 ${data.exportStatus.done}/${data.exportStatus.total || '?'}`
                  : '导出'),
                data.project.counts.marked ? h('button', { className: 'pl-btn', 'data-danger': confirmPurge ? 'true' : 'false', disabled: busy, onClick: doPurge }, confirmPurge ? `确认删除 ${data.project.counts.marked} 张` : `清理标删 ${data.project.counts.marked}`) : null,
                h('select', {
                  className: 'pl-btn', value: style,
                  onChange: e => {
                    const next = e.target.value;
                    setStyle(next);
                    if (projectId && next !== '__custom__') call({ action: 'style', projectId, style: next }).catch(() => {});
                  }
                },
                  Object.keys(STYLE_LABEL).map(key => h('option', { key, value: key }, STYLE_LABEL[key])),
                  customStyles.length ? h('optgroup', { label: '学到的风格' },
                    customStyles.map(item => h('option', { key: item.id, value: item.id }, item.name))) : null,
                  h('option', { value: '__custom__' }, '自定义…')
                ),
                style === '__custom__' ? h('input', {
                  className: 'pl-noteArea', rows: 1, value: customStyle,
                  placeholder: '描述一下：偏青、暗一点、像老电影……',
                  style: { minHeight: 32, height: 32, flex: '1 1 160px' },
                  onChange: e => setCustomStyle(e.target.value)
                }) : null
              ),
              h('div', { className: 'pl-styleHint' },
                style === '__custom__'
                  ? '自定义风格：用一句话描述想要的感觉，AI 会挑最接近的基础风格再微调参数。'
                  : (() => {
                    const custom = customStyles.find(item => item.id === style);
                    if (custom) return `学到的风格 · ${custom.description || custom.name}`;
                    return `当前风格 · ${STYLE_DESC[style] || ''}`;
                  })())
            ),
            h('div', { className: 'pl-tabs' }, tabs.map(([key, label]) => h('button', { key, className: 'pl-tab', 'data-on': tab === key ? 'true' : 'false', onClick: () => setTab(key) }, label))),
            h('div', { className: 'pl-list', ref: listRef },
              visible.length ? visible.map(photo => h(Row, {
                key: photo.id, photo, picked: picked.includes(photo.id), onPick: pickOne,
                onOpen: id => {
                  scrollRef.current = listRef.current ? listRef.current.scrollTop : 0;
                  const picked = photos.find(item => item.id === id);
                  setCurrent({ id });
                  setZoom(1);
                  setRoundPick(null);
                  setNote((picked && picked.note) || '');
                }
              }))
                : h('div', { style: { padding: '40px 12px', textAlign: 'center', color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 } }, '这个分类里还没有照片')
            ),
            h('div', { className: 'pl-foot' },
              error ? h('span', { style: { color: 'var(--dsw-alias-label-error)' } }, error) : h('span', null, state.sessionId ? '已绑定本会话' : '没有会话'),
              h('span', { style: { marginLeft: 'auto' } }, data.project.manifest)
            )
          ),
          toast ? h(Toast, { text: toast }) : null
        )
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
          { name: 'conversation.session.header.utilities', id: 'photo-lab', order: 40 },
          props => h(HeaderButton, props)
        )));
        ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register(
          { name: 'shell.overlay', id: 'photo-lab.panel', order: 72 },
          () => h(PanelBoundary, null, h(Panel))
        )));
      }
    };
  }
});
