(() => {
  const STYLE = `
    /* Keep text bubbles only as wide as their content. .messages is a flex
       column, so explicitly disable the default stretch behavior. */
    #messages .message {
      width: fit-content !important;
      max-width: min(78%, 520px) !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }
    #messages .message.received { align-self: flex-start !important; margin-right: auto !important; margin-left: 0 !important; }
    #messages .message.sent { align-self: flex-end !important; margin-left: auto !important; margin-right: 0 !important; }
    #messages .message-body,
    #messages .message-body p { width: auto !important; max-width: 100% !important; }
    #messages .message-body p { white-space: normal !important; overflow-wrap: anywhere !important; word-break: break-word !important; }

    #messages .message-bubble, #messages .bubble, #messages [class*="message-bubble"] {
      width: fit-content !important;
      max-width: 100% !important;
      min-width: 0 !important;
    }

    #messages img.chat-image,#messages img.message-image,#messages img[class*="image"] {
      width:auto; max-width:min(220px,58vw); max-height:220px; height:auto;
      object-fit:cover; border-radius:14px; display:block; cursor:zoom-in;
    }

    /* WhatsApp-style voice note */
    .vn-modern { display:flex; align-items:center; gap:9px; width:min(260px,72vw); min-width:190px; padding:7px 9px; border-radius:18px; box-sizing:border-box; }
    .vn-modern-btn { width:38px;height:38px;border:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;flex:0 0 auto;background:rgba(0,0,0,.08);color:inherit;padding:0; }
    .vn-modern-btn svg { width:18px;height:18px;fill:currentColor;stroke:currentColor; }
    .vn-modern-wave { flex:1; min-width:85px; height:31px; display:flex; align-items:center; gap:2px; overflow:hidden; }
    .vn-modern-wave i { width:2px; min-height:4px; max-height:26px; border-radius:3px; opacity:.48; transition:height .06s linear,opacity .06s linear; }
    .vn-modern-wave i.playing { opacity:1; }
    .vn-modern-time { font-size:11px; opacity:.72; white-space:nowrap; min-width:31px; text-align:right; align-self:flex-end; margin-bottom:2px; }

    .image-lightbox { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,.88); display:none; align-items:center; justify-content:center; padding:18px; }
    .image-lightbox.open { display:flex; }
    .image-lightbox img { max-width:96vw; max-height:82vh; object-fit:contain; border-radius:10px; }
    .image-lightbox .ilb-close,.image-lightbox .ilb-save { position:absolute; border:0; color:#fff; background:rgba(255,255,255,.14); backdrop-filter:blur(8px); border-radius:22px; padding:10px 15px; font-size:15px; cursor:pointer; }
    .image-lightbox .ilb-close { top:18px; right:18px; font-size:22px; }
    .image-lightbox .ilb-save { bottom:22px; left:50%; transform:translateX(-50%); }
    @media(max-width:480px){.vn-modern{width:min(250px,72vw);min-width:185px}#messages img.chat-image,#messages img.message-image,#messages img[class*="image"]{max-width:180px;max-height:180px}}
  `;

  function installStyle(){
    if(document.getElementById('chatBubbleModernStyle')) return;
    const s=document.createElement('style');
    s.id='chatBubbleModernStyle';
    s.textContent=STYLE;
    document.head.appendChild(s);
  }

  const fmt=sec=>{
    sec=Math.max(0,Math.floor(sec||0));
    return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
  };

  const playSvg='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const pauseSvg='<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

  function imageViewer(img){
    const old=document.getElementById('imageLightbox');
    if(old) old.remove();
    const box=document.createElement('div');
    box.id='imageLightbox';
    box.className='image-lightbox open';
    box.innerHTML='<button class="ilb-close" aria-label="Close">×</button><img alt="Shared image"><button class="ilb-save">Save image</button>';
    const preview=box.querySelector('img');
    preview.src=img.currentSrc||img.src;
    preview.alt=img.alt||'Shared image';
    box.querySelector('.ilb-close').onclick=()=>box.remove();
    box.onclick=e=>{if(e.target===box)box.remove()};
    box.querySelector('.ilb-save').onclick=async()=>{
      try{
        const r=await fetch(preview.src);
        const b=await r.blob();
        const u=URL.createObjectURL(b);
        const a=document.createElement('a');
        a.href=u;
        a.download='she-image';
        a.click();
        setTimeout(()=>URL.revokeObjectURL(u),1500);
      }catch(_){window.open(preview.src,'_blank')}
    };
    document.body.appendChild(box);
  }

  function enhanceImages(root){
    root.querySelectorAll('img').forEach(img=>{
      if(img.closest('.image-lightbox')||img.dataset.chatImageEnhanced)return;
      img.dataset.chatImageEnhanced='1';
      if(img.closest('#messages')){
        img.classList.add('chat-image');
        img.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          imageViewer(img);
        });
      }
    });
  }

  function enhanceAudio(root){
    root.querySelectorAll('audio').forEach(old=>{
      if(old.dataset.vnModern||(!old.src&&!old.querySelector('source')))return;
      old.dataset.vnModern='1';
      const wrap=document.createElement('div');
      wrap.className='vn-modern';
      const btn=document.createElement('button');
      btn.className='vn-modern-btn';
      btn.type='button';
      btn.innerHTML=playSvg;
      btn.setAttribute('aria-label','Play voice note');
      const wave=document.createElement('div');
      wave.className='vn-modern-wave';
      for(let i=0;i<42;i++){
        const b=document.createElement('i');
        b.style.height=(5+Math.round(Math.abs(Math.sin(i*1.35))*16))+'px';
        wave.appendChild(b);
      }
      const time=document.createElement('span');
      time.className='vn-modern-time';
      time.textContent='0:00';
      wrap.append(btn,wave,time);
      old.parentNode.insertBefore(wrap,old);
      old.style.display='none';
      let ctx=null,analyser=null,data=null,source=null,raf=0;
      function setup(){
        if(analyser)return;
        try{
          ctx=new(window.AudioContext||window.webkitAudioContext)();
          analyser=ctx.createAnalyser();
          analyser.fftSize=64;
          data=new Uint8Array(analyser.frequencyBinCount);
          source=ctx.createMediaElementSource(old);
          source.connect(analyser);
          analyser.connect(ctx.destination);
        }catch(_){analyser=null}
      }
      function draw(){
        if(old.paused)return;
        if(analyser){
          analyser.getByteFrequencyData(data);
          [...wave.children].forEach((b,i)=>{
            b.style.height=(5+Math.round((data[i%data.length]||0)/255*21))+'px';
            b.classList.add('playing');
          });
        }else{
          [...wave.children].forEach((b,i)=>b.style.height=(5+Math.round(Math.abs(Math.sin(old.currentTime*8+i*.55))*20))+'px');
        }
        raf=requestAnimationFrame(draw);
      }
      btn.onclick=async()=>{
        try{
          setup();
          if(ctx?.state==='suspended')await ctx.resume();
          if(old.paused)await old.play();else old.pause();
        }catch(e){console.warn('voice playback',e)}
      };
      old.addEventListener('play',()=>{btn.innerHTML=pauseSvg;draw()});
      old.addEventListener('pause',()=>{btn.innerHTML=playSvg;cancelAnimationFrame(raf)});
      old.addEventListener('ended',()=>{btn.innerHTML=playSvg;cancelAnimationFrame(raf);time.textContent=fmt(old.duration)});
      old.addEventListener('timeupdate',()=>{time.textContent=fmt(old.currentTime)});
      old.addEventListener('loadedmetadata',()=>{if(Number.isFinite(old.duration))time.textContent=fmt(old.duration)});
    });
  }

  function enhance(root=document.getElementById('messages')){
    if(!root)return;
    enhanceImages(root);
    enhanceAudio(root);
  }

  function init(){
    installStyle();
    const root=document.getElementById('messages');
    if(!root)return;
    enhance(root);
    new MutationObserver(()=>enhance(root)).observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
