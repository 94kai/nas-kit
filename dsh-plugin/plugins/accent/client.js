window.__ModuleLoader__.load({
  id: '@local/dsh-accent',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /*
     * 与 index.js 的 ACCENTS 保持一致（Host 注入的 CSS 用那份做默认），
     * 这里只用于在设置里即时切换：选中后覆盖为浏览器内的本地选择。
     */
    const ACCENTS = {
      rose: { label: '玫瑰粉', accent: ['#82354f', '#db94ac'], hover: ['#702e44', '#d47d9a'], sidebar: ['#f0d8e0', '#321b23'], base: ['#f9f0f3', '#1e1015'], input: ['#f4e3e9', '#362329'] },
      moss: { label: '苔绿', accent: ['#347960', '#93c0af'], hover: ['#2c6852', '#80b4a1'], sidebar: ['#e7f1ed', '#1a2d26'], base: ['#f6fbf9', '#101d18'], input: ['#e3f4ee', '#23362f'] },
      sea: { label: '雾青', accent: ['#316e7d', '#93b7c0'], hover: ['#295d6a', '#80aab4'], sidebar: ['#e7eff1', '#1a292d'], base: ['#f6fafb', '#101a1d'], input: ['#e3f1f4', '#233336'] },
      slate: { label: '青灰', accent: ['#373a7b', '#989ac0'], hover: ['#2f316a', '#8587b4'], sidebar: ['#e7e7f1', '#1a1b2d'], base: ['#f6f6fb', '#10111d'], input: ['#e3e4f4', '#232336'] },
      clay: { label: '陶土', accent: ['#864e32', '#c7a797'], hover: ['#73432b', '#bc9683'], sidebar: ['#f1eae7', '#2d211a'], base: ['#fbf8f6', '#1d1410'], input: ['#f4e9e3', '#362923'] },
      plum: { label: '灰紫', accent: ['#7b3d76', '#c398bf'], hover: ['#6a3465', '#b785b3'], sidebar: ['#f1e7f0', '#2d1a2b'], base: ['#fbf6fa', '#1d101c'], input: ['#f4e3f3', '#362335'] },
    };
    const NAMES = Object.keys(ACCENTS);
    const STORAGE_KEY = 'dsh-accent.choice';

    /** 一个配色对应的六个 token。 */
    const tokensFor = (p) => ({
      '--dsw-alias-bg-base': { light: p.base[0], dark: p.base[1] },
      '--dsw-specific-input-major': { light: p.input[0], dark: p.input[1] },
      '--dsw-specific-sidebar-fill': { light: p.sidebar[0], dark: p.sidebar[1] },
      '--dsw-alias-state-business-primary': { light: p.accent[0], dark: p.accent[1] },
      '--dsw-alias-button-info-fill': { light: p.accent[0], dark: p.accent[1] },
      '--dsw-alias-button-info-hover': { light: p.hover[0], dark: p.hover[1] },
    });

    const readChoice = () => {
      try {
        const value = localStorage.getItem(STORAGE_KEY) || '';
        return value === 'none' || ACCENTS[value] !== undefined ? value : '';
      } catch {
        return '';
      }
    };

    /** Host 注入的配色样式表；「原版」直接把它整条禁用，胶囊那段不受影响。 */
    const paletteSheet = () => {
      for (const tag of document.querySelectorAll('style')) {
        if (tag.textContent.trim().startsWith('/*dsh-accent:palette*/')) return tag.sheet;
      }
      return null;
    };
    const saveChoice = (name) => {
      try {
        if (name === '') localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, name);
      } catch {
        /* 隐私模式下写不了就只在本次会话里生效 */
      }
    };

    const CSS = `.ac-row{display:flex;flex-direction:column;gap:12px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.ac-copy{display:flex;flex-direction:column;gap:2px}
.ac-title{font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.ac-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.ac-swatches{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.ac-swatch{width:28px;height:28px;padding:0;border:0;border-radius:999px;corner-shape:round;cursor:pointer}
.ac-swatch[aria-pressed=true]{box-shadow:0 0 0 2px var(--dsw-alias-bg-base),0 0 0 3.5px var(--dsw-alias-label-primary)}
.ac-swatch:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:4px}
.ac-auto{font:inherit;font-size:12px;line-height:1;padding:8px 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;corner-shape:round;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer}
.ac-auto[aria-pressed=true]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary)}
.ac-auto:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.ac-field{display:flex;align-items:center;gap:8px}
.ac-input{flex:1;min-width:0;height:32px;box-sizing:border-box;padding:0 10px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.ac-input::placeholder{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}
.ac-input:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.ac-note{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);min-height:18px}
body[data-accent-device=off] [data-composer-card]::after{display:none}
/* 侧栏品牌：把自带的 deepseek wordmark 换成设备名胶囊（logo 仍在 brand.mark 里） */
[class*=brandName]>svg{display:none}
[class*=brandName]::after{content:var(--dsh-device-mark);display:flex;align-items:center;height:18px;padding:0 9px;border-radius:999px;font-size:10.5px;font-weight:600;letter-spacing:.06em;line-height:1;white-space:nowrap;color:var(--dsh-device-tone,var(--dsw-alias-label-primary));background:color-mix(in srgb,var(--dsh-device-tone,var(--dsw-alias-label-primary)) 6%,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)));border:.5px solid color-mix(in srgb,var(--dsh-device-tone,var(--dsw-alias-label-primary)) 20%,transparent)}`;

    /** 把设备名立刻刷到胶囊上（不动 head 里那段 CSS，刷新后由 Host 注入同一个值）。 */
    function paintDevice(name) {
      const body = document.body;
      if (name) {
        body.style.setProperty('--dsh-device-mark', JSON.stringify(name));
        delete body.dataset.accentDevice;
      } else {
        body.dataset.accentDevice = 'off';
        body.style.removeProperty('--dsh-device-mark');
      }
    }

    function DeviceRow() {
      const [name, setName] = React.useState(null);
      const [note, setNote] = React.useState('');
      const url = () => new URL('api/dsh-accent', document.baseURI);

      React.useEffect(() => {
        let alive = true;
        fetch(url(), { credentials: 'same-origin', cache: 'no-store' })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
          .then((data) => {
            if (alive) setName(typeof data?.name === 'string' ? data.name : '');
          })
          .catch(() => {
            if (alive) {
              setName('');
              setNote('读不出现有名字，可以先在 profile 配置里写 device.name');
            }
          });
        return () => {
          alive = false;
        };
      }, []);

      const save = async () => {
        if (name === null) return;
        setNote('保存中…');
        try {
          const response = await fetch(url(), {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          if (!response.ok) throw new Error(String(response.status));
          const data = await response.json();
          paintDevice(data.name ?? '');
          setNote(data.name ? '已保存，这台实例的其它浏览器刷新后也是这个名字' : '已清空，胶囊已隐藏');
        } catch {
          setNote('保存失败，稍后再试');
        }
      };

      return h('div', { className: 'ac-row' },
        h('div', { className: 'ac-copy' },
          h('div', { className: 'ac-title' }, '设备名'),
          h('div', { className: 'ac-desc' }, '显示在输入框左上角的胶囊里；存在本实例，换浏览器、换设备访问都一样。')),
        h('div', { className: 'ac-field' },
          h('input', {
            className: 'ac-input',
            value: name === null ? '' : name,
            placeholder: '例如 开发机 / NAS / 主力机',
            maxLength: 16,
            disabled: name === null,
            onChange: (event) => setName(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') save();
            },
          }),
          h('button', {
            type: 'button',
            className: 'ac-auto',
            disabled: name === null,
            onClick: save,
          }, '保存')),
        note === '' ? null : h('div', { className: 'ac-note' }, note));
    }

    return {
      inject: ['slots', 'theme'],
      apply(ctx) {
        let layer = null;
        const paint = (name) => {
          if (layer !== null) {
            layer();
            layer = null;
          }
          const sheet = paletteSheet();
          if (sheet !== null) sheet.disabled = name === 'none';
          // 原版配色下胶囊改用正文色（中性灰）；选了具体颜色就跟着那套强调色走。
          if (name === 'none') document.body.style.setProperty('--dsh-device-tone', 'var(--dsw-alias-label-primary)');
          else if (name === '') document.body.style.removeProperty('--dsh-device-tone');
          else document.body.style.setProperty('--dsh-device-tone', 'var(--dsw-alias-state-business-primary)');
          if (name === '' || name === 'none') return;
          layer = ctx.theme.overrideTokens('@local/dsh-accent', tokensFor(ACCENTS[name]));
        };

        // 页面一打开就套用本浏览器的选择；没有选择就沿用 Host 注入的配置。
        let current = readChoice();
        if (current !== '') paint(current);
        ctx.effect(() => () => {
          if (layer !== null) layer();
          layer = null;
        }, 'dsh-accent: 本地配色层');

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = '@local/dsh-accent';
          tag.textContent = CSS;
          document.head.append(tag);
          return () => tag.remove();
        }, 'dsh-accent: 设置行样式');

        function Row() {
          const [choice, setChoice] = React.useState(current);
          const pick = (name) => {
            if (name === choice) return;
            current = name;
            saveChoice(name);
            setChoice(name);
            paint(name);
          };
          return h('div', { className: 'ac-row' },
            h('div', { className: 'ac-copy' },
              h('div', { className: 'ac-title' }, '实例配色'),
              h('div', { className: 'ac-desc' }, choice === ''
                ? '当前跟随实例配置；在这里选一种只改本浏览器。'
                : choice === 'none'
                  ? '当前：DSH 原版配色（不套识别色，胶囊用中性灰）'
                  : `当前：${ACCENTS[choice].label}（仅本浏览器，不改实例配置）`)),
            h('div', { className: 'ac-swatches' },
              NAMES.map((name) => h('button', {
                key: name,
                type: 'button',
                className: 'ac-swatch',
                title: ACCENTS[name].label,
                'aria-label': ACCENTS[name].label,
                'aria-pressed': choice === name,
                style: { background: ACCENTS[name].accent[0] },
                onClick: () => pick(name),
              })),
              h('button', {
                type: 'button',
                className: 'ac-auto',
                'aria-pressed': choice === '',
                onClick: () => pick(''),
              }, '跟随配置'),
              h('button', {
                type: 'button',
                className: 'ac-auto',
                'aria-pressed': choice === 'none',
                onClick: () => pick('none'),
              }, '原版')));
        }

        ctx.slots.inject('settings.general.item', () => ctx.slots.register({
          name: 'settings.general.item',
          id: 'instance-accent',
          order: 12,
        }, Row));

        ctx.slots.inject('settings.general.item', () => ctx.slots.register({
          name: 'settings.general.item',
          id: 'instance-device',
          order: 13,
        }, DeviceRow));
      },
    };
  },
});
