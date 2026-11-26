window.__ModuleLoader__.load({
  id:'@local/file-preview',
  factory(require){
    const React=require('react'),h=React.createElement;
    // 浏览器能直接解码的常见音频容器；声明为 binary 后，原生预览不再把音频归到「暂时无法预览」。
    const EXTENSIONS=['mp3','flac','m4a','m4b','aac','wav','ogg','oga','opus','weba','aif','aiff','ape','wma','wv','amr','mka','ac3','dts','dsf','dff','tta'];
    const MIME={mp3:'audio/mpeg',flac:'audio/flac',m4a:'audio/mp4',m4b:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',weba:'audio/webm',aif:'audio/aiff',aiff:'audio/aiff',ape:'audio/x-ape',wma:'audio/x-ms-wma',wv:'audio/x-wavpack',amr:'audio/amr',mka:'audio/x-matroska',ac3:'audio/ac3',dts:'audio/x-dts',dsf:'audio/x-dsf',dff:'audio/x-dff',tta:'audio/x-tta'};
    // 视频不声明 MIME：字节由 Host 的媒体路由按 Range 提供，Content-Type 在那边设置。
    // 不收录 .ts / .mts，避免把 TypeScript 源码当成视频抢走。
    const VIDEO_EXTENSIONS=['mp4','m4v','webm','ogv','mov','mkv','avi','wmv','flv','mpg','mpeg','m2ts','3gp','3g2','asf'];
    const css=`
.pk-audio{box-sizing:border-box;min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px 20px calc(24px + env(safe-area-inset-bottom));background:radial-gradient(120% 80% at 50% 0%,color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent),transparent 62%);color:var(--dsw-alias-label-primary);font:14px/1.55 system-ui,-apple-system,"PingFang SC",sans-serif}
.pk-audio *{box-sizing:border-box}
.pk-audio-card{width:min(520px,100%);padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:20px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 18px 48px #00000014;display:flex;flex-direction:column;gap:14px;min-width:0}
.pk-audio-head{display:flex;align-items:center;gap:14px;min-width:0}
.pk-audio-art{flex:none;width:52px;height:52px;border-radius:14px;display:grid;place-items:center;color:var(--dsw-alias-brand-primary);background:linear-gradient(135deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent),color-mix(in srgb,var(--dsw-alias-brand-primary) 6%,transparent));border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}
.pk-audio-art svg{width:26px;height:26px}
.pk-audio-meta{min-width:0;display:flex;flex-direction:column;gap:3px}
.pk-audio-name{font-size:16px;font-weight:650;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pk-audio-sub{font-size:12px;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}
.pk-audio-times{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;margin-bottom:-6px}
.pk-audio-times span:first-child{color:var(--dsw-alias-label-primary);font-weight:600}
.pk-audio-seek{-webkit-appearance:none;appearance:none;width:100%;height:32px;margin:0;padding:0;background:transparent;cursor:pointer;touch-action:pan-y}
.pk-audio-seek::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:linear-gradient(to right,var(--dsw-alias-brand-primary) 0 var(--pk-progress,0%),var(--dsw-alias-bg-layer-2) var(--pk-progress,0%) 100%)}
.pk-audio-seek::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-5px;border-radius:50%;background:var(--dsw-alias-brand-primary);border:2px solid var(--dsw-alias-bg-base);box-shadow:0 1px 4px #0003}
.pk-audio-seek::-moz-range-track{height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2)}
.pk-audio-seek::-moz-range-progress{height:6px;border-radius:999px;background:var(--dsw-alias-brand-primary)}
.pk-audio-seek::-moz-range-thumb{width:14px;height:14px;border:2px solid var(--dsw-alias-bg-base);border-radius:50%;background:var(--dsw-alias-brand-primary)}
.pk-audio-seek:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:999px}
.pk-audio-seek:disabled{opacity:.45;cursor:default}
.pk-audio-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pk-audio-transport{display:flex;align-items:center;gap:10px}
.pk-audio-btn{width:44px;height:44px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;font-weight:600;display:grid;place-items:center;cursor:pointer;transition:background .15s,color .15s}
.pk-audio-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pk-audio-btn:focus-visible,.pk-audio-play:focus-visible,.pk-audio-volume input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.pk-audio-play{flex:none;width:56px;height:56px;padding:0;border:0;border-radius:999px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base,#fff);display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 22px color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent);transition:transform .15s,filter .15s}
.pk-audio-play:hover{filter:brightness(1.06)}
.pk-audio-play:active{transform:scale(.96)}
.pk-audio-play svg{width:24px;height:24px}
.pk-audio-volume{display:flex;align-items:center;gap:6px;min-width:0}
.pk-audio-volume input{-webkit-appearance:none;appearance:none;width:84px;height:32px;margin:0;background:transparent;cursor:pointer}
.pk-audio-volume input::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:linear-gradient(to right,var(--dsw-alias-label-secondary) 0 var(--pk-volume,0%),var(--dsw-alias-bg-layer-2) var(--pk-volume,0%) 100%)}
.pk-audio-volume input::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;margin-top:-4px;border-radius:50%;background:var(--dsw-alias-label-primary);border:2px solid var(--dsw-alias-bg-base)}
.pk-audio-volume input::-moz-range-track{height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-2)}
.pk-audio-volume input::-moz-range-progress{height:4px;border-radius:999px;background:var(--dsw-alias-label-secondary)}
.pk-audio-volume input::-moz-range-thumb{width:10px;height:10px;border:2px solid var(--dsw-alias-bg-base);border-radius:50%;background:var(--dsw-alias-label-primary)}
.pk-audio-error{padding:13px 14px;border-radius:12px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:1.6}
.pk-audio-error strong{display:block;font-size:14px;margin-bottom:3px}
.pk-audio-hint{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.55;margin:0}
.pk-video{box-sizing:border-box;min-height:100%;display:flex;flex-direction:column;gap:10px;padding:12px 12px calc(12px + env(safe-area-inset-bottom));color:var(--dsw-alias-label-primary);font:13px/1.5 system-ui,-apple-system,"PingFang SC",sans-serif}
.pk-video *{box-sizing:border-box}
.pk-video-stage{position:relative;flex:1 1 auto;min-height:160px;display:grid;place-items:center;overflow:hidden;border-radius:14px;background:#0a0b0d;border:1px solid var(--dsw-alias-border-l2);box-shadow:0 14px 36px #0000001f}
.pk-video-player{display:block;width:100%;height:100%;min-height:0;max-height:100%;object-fit:contain;background:#000;outline:none}
.pk-video-meta{display:flex;align-items:baseline;gap:8px;min-width:0;margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.pk-video-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-weight:600}
.pk-video-detail{flex:none;white-space:nowrap}
.pk-video-wait{margin:0;color:#8f97a1;font-size:12px}
.pk-video-error{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;text-align:center;color:#f5f6f8;background:radial-gradient(120% 90% at 50% 18%,#1d2026,#08090b)}
.pk-video-error strong{font-size:14px;font-weight:650}
.pk-video-error p{max-width:300px;margin:0;color:#9aa1ab;font-size:12px;line-height:1.65}
.pk-video-retry{margin-top:2px;padding:6px 14px;border:1px solid #ffffff2b;border-radius:999px;background:#ffffff14;color:#f5f6f8;font:inherit;font-size:12px;cursor:pointer;transition:background .15s}
.pk-video-retry:hover{background:#ffffff26}
.pk-video-retry:focus-visible{outline:2px solid #ffffffa8;outline-offset:2px}
@media(max-width:420px){.pk-audio{padding:16px 12px calc(16px + env(safe-area-inset-bottom))}.pk-audio-card{padding:16px;border-radius:16px}.pk-audio-controls{gap:8px}.pk-audio-volume{margin-left:auto}.pk-audio-volume input{width:64px}}
@media(max-width:420px){.pk-video{padding:10px 10px calc(10px + env(safe-area-inset-bottom));gap:8px}.pk-video-stage{border-radius:12px;min-height:140px}.pk-video-meta{flex-wrap:wrap;gap:2px 8px}}
@media(prefers-reduced-motion:reduce){.pk-audio-play,.pk-audio-btn{transition:none}}
`;
    const extensionOf=value=>{const match=/\.([A-Za-z0-9]+)$/.exec(value||'');return match?match[1].toLowerCase():'';};
    const fileNameOf=(address,fallback)=>{
      try{const decoded=decodeURIComponent(String(address||'').split('/').pop()||'');const cut=Math.max(decoded.lastIndexOf('/'),decoded.lastIndexOf('\\'));return decoded.slice(cut+1)||fallback;}catch{return fallback;}
    };
    const clockText=value=>{const seconds=Number.isFinite(value)&&value>0?Math.floor(value):0;return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
    const durationText=value=>{
      const seconds=Number.isFinite(value)&&value>0?Math.floor(value):0;const hours=Math.floor(seconds/3600);const minutes=Math.floor(seconds%3600/60);
      return (hours?hours+':'+String(minutes).padStart(2,'0'):String(minutes))+':'+String(seconds%60).padStart(2,'0');
    };
    const sizeText=bytes=>bytes>=1073741824?(bytes/1073741824).toFixed(2)+' GB':bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.max(1,Math.round(bytes/1024))+' KB';
    // Host 的媒体路由按 Range 读文件，地址里带版本与重读序号，缓存与「重新加载」都靠它们区分。
    const mediaUrl=(path,version,revision,attempt)=>{
      try{
        const url=new URL('api/file-preview/media',document.baseURI);
        url.searchParams.set('path',path);
        if(version)url.searchParams.set('v',version);
        url.searchParams.set('r',String(revision||0));
        if(attempt)url.searchParams.set('a',String(attempt));
        return url.href;
      }catch{return undefined;}
    };
    const iconNote=h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M9 18V5l10-2v13'}),h('circle',{cx:6.5,cy:18,r:2.5}),h('circle',{cx:16.5,cy:16,r:2.5}));
    const iconPlay=h('svg',{viewBox:'0 0 24 24',fill:'currentColor','aria-hidden':true},h('path',{d:'M8 5.2v13.6a.8.8 0 0 0 1.23.67l10.4-6.8a.8.8 0 0 0 0-1.34L9.23 4.53A.8.8 0 0 0 8 5.2Z'}));
    const iconPause=h('svg',{viewBox:'0 0 24 24',fill:'currentColor','aria-hidden':true},h('rect',{x:7,y:5,width:3.6,height:14,rx:1.2}),h('rect',{x:13.4,y:5,width:3.6,height:14,rx:1.2}));
    const iconVolume=h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M4 9.5v5h3.4L12 18V6L7.4 9.5H4Z'}),h('path',{d:'M15.5 9a4.5 4.5 0 0 1 0 6'}),h('path',{d:'M18 6.5a8 8 0 0 1 0 11'}));
    const iconMuted=h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M4 9.5v5h3.4L12 18V6L7.4 9.5H4Z'}),h('path',{d:'m16 9.5 5 5'}),h('path',{d:'m21 9.5-5 5'}));

    function AudioPreview({content,resourceAddress}){
      const data=content&&content.kind==='bytes'?content.data:null;
      const extension=extensionOf(resourceAddress);
      const name=fileNameOf(resourceAddress,'音乐文件');
      const [url,setUrl]=React.useState(null);
      const [playing,setPlaying]=React.useState(false);
      const [current,setCurrent]=React.useState(0);
      const [duration,setDuration]=React.useState(0);
      const [volume,setVolume]=React.useState(1);
      const [muted,setMuted]=React.useState(false);
      const [failed,setFailed]=React.useState(false);
      const audioRef=React.useRef(null);
      React.useEffect(()=>{
        if(!data)return;
        const objectUrl=URL.createObjectURL(new Blob([data],{type:MIME[extension]||'application/octet-stream'}));
        setUrl(objectUrl);
        return()=>URL.revokeObjectURL(objectUrl);
      },[data,extension]);
      React.useEffect(()=>{setPlaying(false);setFailed(false);setCurrent(0);setDuration(0);},[url]);
      const media=()=>audioRef.current;
      function toggle(){
        const element=media();if(!element)return;
        if(element.paused)element.play().catch(()=>setFailed(true));
        else element.pause();
      }
      function seek(value){
        const element=media();if(!element||!Number.isFinite(value))return;
        const next=Math.max(0,Math.min(duration||element.duration||0,value));
        element.currentTime=next;setCurrent(next);
      }
      function step(offset){seek((media()?.currentTime||0)+offset);}
      function changeVolume(value){
        const element=media();if(!element)return;
        element.volume=value;element.muted=false;setMuted(false);setVolume(value);
      }
      function toggleMute(){
        const element=media();if(!element)return;
        element.muted=!element.muted;setMuted(element.muted);
      }
      const percent=duration>0?Math.max(0,Math.min(100,current/duration*100)):0;
      const volumePercent=(muted?0:volume)*100;
      return h('div',{className:'pk-audio','data-audio-preview':true},
        h('style',null,css),
        h('div',{className:'pk-audio-card'},
          h('div',{className:'pk-audio-head'},
            h('span',{className:'pk-audio-art'},iconNote),
            h('div',{className:'pk-audio-meta'},
              h('strong',{className:'pk-audio-name',title:name},name),
              h('span',{className:'pk-audio-sub'},[extension?extension.toUpperCase():'音频',data?sizeText(data.byteLength):''].filter(Boolean).join(' · ')))),
          failed
            ?h('div',{className:'pk-audio-error',role:'alert'},h('strong',null,'无法播放这个文件'),'浏览器不支持它的音频编码，或文件已经损坏。',h('p',{className:'pk-audio-hint'},'可以先用工具箱「音乐」页试听，或把文件转成 MP3 / FLAC 后再打开。'))
            :h(React.Fragment,null,
              h('div',{className:'pk-audio-times'},h('span',null,clockText(current)),h('span',null,duration?clockText(duration):'--:--')),
              h('input',{className:'pk-audio-seek',type:'range',min:0,max:duration||0,step:.1,value:Math.min(current,duration||0),disabled:!duration,'aria-label':'播放进度',style:{'--pk-progress':percent+'%'},onChange:event=>seek(Number(event.target.value))}),
              h('div',{className:'pk-audio-controls'},
                h('div',{className:'pk-audio-transport'},
                  h('button',{type:'button',className:'pk-audio-btn',onClick:()=>step(-10),'aria-label':'后退 10 秒',title:'后退 10 秒'},'−10'),
                  h('button',{type:'button',className:'pk-audio-play',onClick:toggle,'aria-label':playing?'暂停':'播放',title:playing?'暂停':'播放'},playing?iconPause:iconPlay),
                  h('button',{type:'button',className:'pk-audio-btn',onClick:()=>step(10),'aria-label':'前进 10 秒',title:'前进 10 秒'},'+10')),
                h('div',{className:'pk-audio-volume'},
                  h('button',{type:'button',className:'pk-audio-btn',onClick:toggleMute,'aria-label':muted?'取消静音':'静音',title:muted?'取消静音':'静音'},muted?iconMuted:iconVolume),
                  h('input',{type:'range',min:0,max:1,step:.01,value:muted?0:volume,'aria-label':'音量',style:{'--pk-volume':volumePercent+'%'},onChange:event=>changeVolume(Number(event.target.value))}))),
              h('p',{className:'pk-audio-hint'},'音频已完整载入浏览器，拖动进度可即时跳转。'))),
        h('audio',{ref:audioRef,src:url||undefined,preload:'metadata',style:{display:'none'},
          onLoadedMetadata:event=>{const value=event.currentTarget.duration;setDuration(Number.isFinite(value)?value:0);},
          onTimeUpdate:event=>setCurrent(event.currentTarget.currentTime),
          onPlay:()=>setPlaying(true),onPause:()=>setPlaying(false),onEnded:()=>setPlaying(false),
          onError:()=>setFailed(true)}));
    }

    // 视频用原生控件（进度、音量、全屏、画中画都由浏览器提供），外面只加一层舞台与信息行。
    // 字节走 Host 的 Range 路由：大文件也能边下边播，拖动进度只取需要的那一段。
    function VideoPreview({content,resourceAddress,useResource}){
      const snapshot=useResource(resourceAddress);
      const info=snapshot.value;
      const extension=extensionOf(resourceAddress);
      const name=fileNameOf(resourceAddress,'视频文件');
      const revision=content&&content.kind==='renderer'?content.revision:0;
      const [attempt,setAttempt]=React.useState(0);
      const [failed,setFailed]=React.useState(false);
      const [duration,setDuration]=React.useState(0);
      const [frame,setFrame]=React.useState(null);
      const src=info?mediaUrl(info.absolutePath,info.version,revision,attempt):undefined;
      const reportedRef=React.useRef('');
      React.useEffect(()=>{
        // 渲染器模式下由正文自己报告已展示的版本；报告的版本决定「文件已更新」提示与自动重载。
        if(!src||!info||!content||content.kind!=='renderer'||reportedRef.current===src)return;
        reportedRef.current=src;
        content.loaded(info.version);
      },[src]);
      React.useEffect(()=>{setFailed(false);setDuration(0);setFrame(null);},[src]);
      const detail=[
        extension?extension.toUpperCase():'视频',
        info&&info.bytes?sizeText(info.bytes):'',
        frame?frame.width+'×'+frame.height:'',
        duration?durationText(duration):'',
      ].filter(Boolean).join(' · ');
      return h('div',{className:'pk-video','data-video-preview':true},
        h('style',null,css),
        h('div',{className:'pk-video-stage'},
          src&&!failed
            ?h('video',{key:src,className:'pk-video-player',src,controls:true,playsInline:true,preload:'metadata',
              onLoadedMetadata:event=>{
                const element=event.currentTarget;
                setDuration(Number.isFinite(element.duration)?element.duration:0);
                setFrame(element.videoWidth>0&&element.videoHeight>0?{width:element.videoWidth,height:element.videoHeight}:null);
              },
              onError:()=>setFailed(true)})
            :null,
          failed
            ?h('div',{className:'pk-video-error',role:'alert'},
              h('strong',null,'无法播放这个视频'),
              h('p',null,'浏览器不支持它的封装或编码（例如 HEVC、AV1、AVI、MKV），也可能文件已经损坏。'),
              h('button',{type:'button',className:'pk-video-retry',onClick:()=>{setFailed(false);setAttempt(value=>value+1);}},'重新加载'))
            :null,
          !src&&!failed
            ?h('p',{className:'pk-video-wait'},snapshot.failure?'无法读取文件信息':'正在读取文件信息…')
            :null),
        h('p',{className:'pk-video-meta'},
          h('span',{className:'pk-video-name',title:name},name),
          h('span',{className:'pk-video-detail'},detail)));
    }

    return {
      apply(ctx){
        // 原生右侧栏没装或未启用时保持休眠，不阻塞客户端启动。
        ctx.inject(['documentPreviews','slots'], inner=>{
          const id='@local/file-preview';
          const videoId='@local/file-preview/video';
          inner.effect(()=>inner.documentPreviews.register({id,extensions:EXTENSIONS,binaryExtensions:EXTENSIONS,priority:'extension',title:()=> '音乐播放',loading:'bytes-complete',wrap:false}));
          inner.effect(()=>inner.slots.inject('sidebar.right.tab.document',()=>inner.slots.register({name:'sidebar.right.tab.document',key:id},AudioPreview)));
          // 视频正文在挂载后自己经 Host 路由取字节，所以用 renderer 而不是 bytes-complete。
          inner.effect(()=>inner.documentPreviews.register({id:videoId,extensions:VIDEO_EXTENSIONS,binaryExtensions:VIDEO_EXTENSIONS,priority:'extension',title:()=> '视频播放',loading:'renderer',wrap:false}));
          inner.effect(()=>inner.slots.inject('sidebar.right.tab.document',()=>inner.slots.register({name:'sidebar.right.tab.document',key:videoId},VideoPreview)));
        });
      }
    };
  }
});
