export function createPreview(React, { request, contentUrl }) {
  const h = React.createElement;
  // 只生成 React 文本节点与排版标签；不解释 HTML、外链或远程图片。
  function inline(text) {
    return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((s,i) => s.startsWith('`') && s.endsWith('`') ? h('code',{key:i},s.slice(1,-1)) : s.startsWith('**') && s.endsWith('**') ? h('strong',{key:i},s.slice(2,-2)) : s);
  }
  function markdown(text) {
    const out = [], lines = text.split(/\r?\n/); let i=0;
    while(i<lines.length) {
      const line=lines[i++], key=i;
      if(!line.trim()) continue;
      if(/^\s*```/.test(line)) { const body=[]; while(i<lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]); if(i<lines.length)i++; out.push(h('pre',{key},h('code',null,body.join('\n')))); continue; }
      const heading=/^(#{1,6})\s+(.+)$/.exec(line);
      if(heading) { out.push(h('h'+heading[1].length,{key},inline(heading[2]))); continue; }
      const list=/^\s*([-*+]\s+|\d+\.\s+)/.exec(line);
      if(list) { const ordered=/\d/.test(list[1]), re=ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/; const items=[line]; while(i<lines.length && re.test(lines[i]))items.push(lines[i++]); out.push(h(ordered?'ol':'ul',{key},items.map((s,n)=>h('li',{key:n},inline(s.replace(re,'')))))); continue; }
      if(/^>\s?/.test(line)) { out.push(h('blockquote',{key},inline(line.replace(/^>\s?/,'')))); continue; }
      const paragraph=[line]; while(i<lines.length && lines[i].trim() && !/^\s*(```|#{1,6}\s|>|[-*+]\s|\d+\.\s)/.test(lines[i]))paragraph.push(lines[i++]);
      out.push(h('p',{key},inline(paragraph.join('\n'))));
    }
    return out;
  }
  return function Preview({entry,onClose}) {
    const ext=(entry.name.match(/\.([^.]+)$/)?.[1]||'').toLowerCase();
    const md=['md','markdown','mdown'].includes(ext);
    const kind = /^(png|jpe?g|gif|webp|avif|bmp|ico)$/.test(ext)?'img':/^(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/.test(ext)?'audio':/^(mp4|m4v|webm|ogv|mov)$/.test(ext)?'video':md||/^(txt|json|jsonl|csv|log|xml|html?|css|js|mjs|cjs|ts|tsx|jsx|py|sh|yml|yaml|toml|ini|conf|sql|c|cpp|h|java|rs|go|svg|gitignore)$/.test(ext)||/^(readme|license|dockerfile|makefile)$/i.test(entry.name)?'text':'other';
    const [data,setData]=React.useState(null), [raw,setRaw]=React.useState(false), [failed,setFailed]=React.useState(false), [attempt,retry]=React.useState(0);
    const back=React.useRef(null);
    React.useEffect(()=>{back.current?.focus();},[]);
    React.useEffect(()=>{ if(kind!=='text')return; const c=new AbortController(); setData(null); request('text',{path:entry.path},c.signal).then(result=>{if(!c.signal.aborted)setData(result);},e=>{if(!c.signal.aborted)setData({error:e.message});}); return ()=>c.abort(); },[entry.path,kind,attempt]);
    const largeMarkdown=md && data?.text?.length>150000;
    const source=contentUrl(entry.path), download=h('a',{className:'lfiles-pv-button',href:contentUrl(entry.path,true),download:entry.name},'下载原文件');
    let body;
    if(kind==='text') body=!data?h('p',{role:'status'},'正在读取…'):data.error?h('div',{role:'alert'},data.error,h('button',{onClick:()=>retry(a=>a+1)},'重试')):!data.text?h('p',null,'这个文件是空的。'):md&&!raw&&!largeMarkdown?h('article',{className:'lfiles-md'},markdown(data.text)):h('pre',{className:'lfiles-source'},data.text);
    else if(kind==='other') body=h('p',null,'暂不支持预览此格式，可下载后用其他应用打开。');
    else if(failed) body=h('p',{role:'alert'},'无法显示此文件：浏览器可能不支持其编码，或文件已移动。可下载原文件查看。');
    else if(kind==='img') body=h('img',{src:source,alt:entry.name,onError:()=>setFailed(true)});
    else body=h(kind,{src:source,controls:true,playsInline:true,preload:'metadata','aria-label':entry.name,onError:()=>setFailed(true)});
    return h('section',{className:'lfiles-pv','aria-label':'文件预览',onKeyDown:e=>{if(e.key==='Escape'&&!document.fullscreenElement)onClose();}},
      h('div',{className:'lfiles-pv-head'},h('button',{ref:back,onClick:onClose},'‹ 返回目录'),download),
      h('div',{className:'lfiles-pv-content'},h('div',{className:'lfiles-pv-meta'},ext?ext.toUpperCase()+' · 文件预览':'文件预览'),h('h1',null,entry.name),
        md&&data?.text&&!largeMarkdown?h('button',{onClick:()=>setRaw(x=>!x)},raw?'查看排版':'查看原文'):largeMarkdown?h('p',null,'文档较长，已切换为原文。'):null,
        h('div',{className:'lfiles-pv-body'},body)));
  };
}
