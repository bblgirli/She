(()=>{
  const p=(location.pathname.split('/').pop()||'').toLowerCase();
  if(!/^(chat|chats|app)\.html$/.test(p))return;
  const K='she_last_screen_html_'+p;
  const isChat=p==='chat.html';
  const getRoot=()=>p==='chats.html'?document.getElementById('chatList'):document.getElementById('messages');
  const save=()=>{try{const root=getRoot();if(root&&root.innerHTML.trim())localStorage.setItem(K,root.innerHTML)}catch(_){}};
  // chat.html is a live, bottom-anchored conversation. Never restore cached
  // message HTML into it and never let the cache observer manipulate scroll.
  const restore=()=>{
    if(isChat)return;
    try{const root=getRoot(),cached=localStorage.getItem(K);if(root&&cached){root.innerHTML=cached;root.dataset.restored='1'}}catch(_){}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore,{once:true});else restore();
  if(isChat){
    const root=getRoot();
    const scrollBottom=()=>{if(root)root.scrollTop=root.scrollHeight-root.clientHeight};
    const isNearBottom=()=>root?(root.scrollHeight-root.scrollTop-root.clientHeight)<80:true;
    let initialDone=false,lastHeight=0;
    const initialBottom=()=>{
      if(!root||initialDone)return;
      root.scrollTop=root.scrollHeight-root.clientHeight;
      lastHeight=root.scrollHeight;
      initialDone=true;
    };
    const keepBottomIfNeeded=()=>{
      if(!root)return;
      const wasNear=isNearBottom();
      const height=root.scrollHeight;
      if(!initialDone){initialBottom();return}
      if(wasNear && height!==lastHeight)scrollBottom();
      lastHeight=height;
    };
    requestAnimationFrame(initialBottom);
    setTimeout(initialBottom,150);
    setTimeout(initialBottom,500);
    root?.addEventListener('scroll',()=>{if(!root)return;lastHeight=root.scrollHeight},{passive:true});
    const obs=root?new MutationObserver(keepBottomIfNeeded):null;
    if(obs)obs.observe(root,{childList:true,subtree:true});
    window.addEventListener('load',()=>{setTimeout(initialBottom,100);setTimeout(initialBottom,400)});
  }else{
    window.addEventListener('load',()=>setTimeout(save,700));
    window.addEventListener('pagehide',save);
    window.addEventListener('beforeunload',save);
    const root=getRoot();
    if(root){const obs=new MutationObserver(()=>{clearTimeout(window.__sheSaveTimer);window.__sheSaveTimer=setTimeout(save,250)});window.addEventListener('load',()=>obs.observe(root,{childList:true,subtree:true}))}
  }
})();
