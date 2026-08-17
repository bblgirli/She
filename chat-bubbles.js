(() => {
  const STYLE = `
    #messages .message, #messages .message-bubble, #messages .bubble, #messages [class*="message-bubble"] { width: fit-content; max-width: min(78vw, 520px); min-width: 0; }
    #messages .message { overflow: visible; }
    #messages img.chat-image, #messages img.message-image, #messages img[class*="image"] { width: auto; max-width: min(220px, 58vw); max-height: 220px; height: auto; object-fit: cover; border-radius: 14px; display: block; cursor: zoom-in; }
    .vn-modern { display:flex; align-items:center; gap:9px; min-width:210px; max-width:280px; padding:9px 10px; border-radius:18px; }
    .vn-modern-btn { width:34px;height:34px;border:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;flex:0 0 auto;background:rgba(0,0,0,.08); }
    .vn-modern-btn svg { width:16px;height:16px;fill:currentColor;stroke:currentColor; }
    .vn-modern-wave { flex:1; min-width:90px; height:30px; display:flex; align-items:center; gap:2px; overflow:hidden; }
    .vn-modern-wave i { width:2px; height:5px; border-radius:3px; opacity:.45; transition:height .07s linear,opacity .07s linear; }
    .vn-modern-wave i.playing { opacity:1; }
    .vn-modern-time { font-size:11px; opacity:.7; white-space:nowrap; min-width:31px; text-align:right; }
    .image-lightbox { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,.88); display:none; align-items:center; justify-content:center; padding:18px; }
    .image-lightbox.open { display:flex; }
    .image-lightbox img { max-width:96vw; max-height:82vh; object-fit:contain; border-radius:10px; }
    .image-lightbox .ilb-close,.image-lightbox .ilb-save { position:absolute; border:0; color:#fff; background:rgba(255,255,255,.14); backdrop-filter:blur(8px); border-radius:22px; padding:10px 15px; font-size:15px; cursor:pointer; }
    .image-lightbox .ilb-close { top:18px; right:18px; font-size:22px; }
    .image-lightbox .ilb-save { bottom:22px; left:50%; transform:translateX(-50%); }
    @media (max-width:480px){ .vn-modern{min-width:190px;max-width:74vw;} #messages img.chat-image,#messages img.message-image,#messages img[class*="image"]{max-width:180px;max-height:180px;} }
  `;

  function installStyle(){ if(document.getElementById('chatBubbleModernStyle')) return; const s=document.createElement('style'); s.id='chatBubbleModernStyle'; s.textContent=STYLE; document.head.appendChild(s); }
  const esc = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = sec => { sec=Math.max(0,Math.floor(sec||0)); return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); };
  const playSvg='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const pauseSvg='<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

  function imageViewer(img){
    if(document.getElementById('imageLightbox')) document.getElementById('imageLightbox').remove();
    const box=document.createElement('div'); box.id='imageLightbox'; box.className='image-lightbox open';
    box.innerHTML=`<button class="ilb-close" aria-label="Close">×</button><img alt="Shared image"><button class="ilb-save">Save image</button>`;
    const preview=box.querySelector('img'); preview.src=img.currentSrc||img.src; preview.alt=img.alt||'Shared image';
    box.querySelector('.ilb-close').onclick=()=>box.remove();
    box.addEventListener('click',e=>{if(e.target===box)box.remove();});
    box.querySelector('.ilb-save').onclick=async()=>{
      try{ const r=await fetch(preview.src); const b=await r.blob(); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download='she-image'; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1500); }
      catch(_){ const a=document.createElement('a'); a.href=preview.src; a.target='_blank'; a.rel='noopener'; a.click(); }
    };
    document.body.appendChild(box);
  }

  function enhanceImages(root){
    root.querySelectorAll('img').forEach(img=>{
      if(img.closest('.image-lightbox') || img.dataset.chatImageEnhanced) return;
      img.dataset.chatImageEnhanced='1';
      const parent=img.closest('.message,.message-bubble,.bubble,[class*="message"]');
      if(parent || img.closest('#messages')){
        img.classList.add('chat-image');
        img.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();imageViewer(img);});
      }
    });
  }

  function enhanceAudio(root){
    root.querySelectorAll('audio').forEach(audio=>{
      if(audio.dataset.vnModern) return;
      if(!audio.src && !audio.querySelector('source')) return;
      audio.dataset.vnModern='1';
      const old=audio;
      const wrap=document.createElement('div'); wrap.className='vn-modern';
      const btn=document.createElement('button'); btn.className='vn-modern-btn'; btn.type='button'; btn.innerHTML=playSvg; btn.setAttribute('aria-label','Play voice note');
      const wave=document.createElement('div'); wave.className='vn-modern-wave';
      for(let i=0;i<34;i++){const bar=document.createElement('i'); bar.style.height=(5+Math.round(Math.abs(Math.sin(i*1.7))*16))+'px'; wave.appendChild(bar);}
      const time=document.createElement('span'); time.className='vn-modern-time'; time.textContent='0:00';
      wrap.append(btn,wave,time); old.parentNode.insertBefore(wrap,old); old.style.display='none';
      let ctx=null, analyser=null, data=null, source=null, raf=0;
      function setupAnalyser(){
        if(analyser) return;
        try{ctx=new (window.AudioContext||window.webkitAudioContext)(); analyser=ctx.createAnalyser(); analyser.fftSize=64; data=new Uint8Array(analyser.frequencyBinCount); source=ctx.createMediaElementSource(old); source.connect(analyser); analyser.connect(ctx.destination);}catch(_){analyser=null;}
      }
      function draw(){
        if(!old.paused){
          if(analyser){analyser.getByteFrequencyData(data); [...wave.children].forEach((b,i)=>{const v=data[i%data.length]||0;b.style.height=(5+Math.max(0,Math.round(v/255*23)))+'px';b.classList.add('playing');});}
          else [...wave.children].forEach((b,i)=>b.style.height=(6+Math.round(Math.abs(Math.sin(old.currentTime*7+i*.8))*20))+'px');
          raf=requestAnimationFrame(draw);
        }
      }
      btn.onclick=async()=>{ try{setupAnalyser();if(ctx?.state==='suspended')await ctx.resume(); if(old.paused){await old.play();}else old.pause();}catch(e){console.warn('voice playback',e);} };
      old.addEventListener('play',()=>{btn.innerHTML=pauseSvg;draw();});
      old.addEventListener('pause',()=>{btn.innerHTML=playSvg;cancelAnimationFrame(raf);});
      old.addEventListener('ended',()=>{btn.innerHTML=playSvg;cancelAnimationFrame(raf);});
      old.addEventListener('timeupdate',()=>{time.textContent=fmt(old.currentTime);});
      old.addEventListener('loadedmetadata',()=>{if(Number.isFinite(old.duration))time.textContent=fmt(old.duration);});
    });
  }

  function enhance(root=document.getElementById('messages')){ if(!root)return; enhanceImages(root); enhanceAudio(root); }
  function init(){ installStyle(); const root=document.getElementById('messages'); if(!root)return; enhance(root); new MutationObserver(()=>enhance(root)).observe(root,{childList:true,subtree:true}); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();