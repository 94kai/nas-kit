window.__ModuleLoader__.load({
  id: '@local/files',
  factory(require) {
    const React = require('react'), h = React.createElement;
    const browserFactory = /* BROWSER */ null;
    const previewFactory = /* PREVIEW */ null;
    const styles = /* STYLES */ "";
    const panel = 'local-files';
    const url = action => new URL(`api/local-files/${action}`, document.baseURI);
    async function request(action, body, signal) {
      const response = await fetch(url(action), {method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
        headers: {'Content-Type': 'application/json', 'X-Local-Files': '1'}, body: JSON.stringify(body)});
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw Object.assign(new Error(data?.error || (response.status === 401 || response.status === 403 ? '没有访问权限，请使用所有者账号重新登录。' : '无法访问文件服务，请刷新后重试。')), {status:response.status});
      return data;
    }
    function contentUrl(path, download = false) {
      const target = url('content'); target.searchParams.set('path', path);
      if (download) target.searchParams.set('download', '1');
      return target.href;
    }
    const Preview = previewFactory(React, {request, contentUrl});
    const Browser = browserFactory(React, {request, Preview});
    function FolderIcon({size = 18}) {
      return h('svg', {width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.65, strokeLinejoin:'round', 'aria-hidden':true},
        h('path', {d:'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'}), h('path', {d:'M3.5 10.5h17'}));
    }
    return {inject:['slots','layout'], apply(ctx) {
      ctx.slots.inject('main', () => ctx.slots.register({name:'main', key:panel}, () => h(React.Fragment, null,
        h('style', null, styles), h(Browser))));
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({name:'sidebar.panellist', id:panel, order:15, label:'文件'}, FolderIcon));
      ctx.effect(() => () => { if (ctx.layout.panelInfo.getSnapshot().activePanelId === panel) ctx.layout.selectPanel(null); });
    }};
  }
});
