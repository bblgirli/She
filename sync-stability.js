(()=>{
  const p=(location.pathname.split('/').pop()||'').toLowerCase();
  if(!/^(chat|chats|app)\.html$/.test(p))return;
  const K='she_last_screen_html_'+p;
  const isChat=p==='chat.html';
  const getRoot=()=>p==='chats.html'?document.getElementById('chatList'):document.getElementById('messages');
  const save=()=>{try{const root=getRoot();if(root&&root.innerHTML.trim())localStorage.setItem(K,root.innerHTML)}catch(_) {}};

  // chat.html is live. Never restore cached message HTML into it.
  const restore=()=>{
    if(isChat)return;
    try{const root=getRoot(),cached=localStorage.getItem(K);if(root&&cached){root.innerHTML=cached;root.dataset.restored='1'}}catch(_){}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore,{once:true});else restore();

  if(isChat){
    const start=()=>{
      const root=getRoot();
      if(!root)return;

      let userScrolledUp=false;
      let savedScrollTop=0;
      let firstLayout=true;
      let restoreTimer=0;

      const atBottom=()=>root.scrollHeight-root.scrollTop-root.clientHeight<=24;
      const rememberPosition=()=>{
        const bottom=atBottom();
        userScrolledUp=!bottom;
        savedScrollTop=root.scrollTop;
      };

      root.addEventListener('scroll',rememberPosition,{passive:true});

      const forceInitialBottom=()=>{
        root.scrollTop=root.scrollHeight-root.clientHeight;
        savedScrollTop=root.scrollTop;
        userScrolledUp=false;
        firstLayout=false;
      };

      requestAnimationFrame(forceInitialBottom);
      setTimeout(forceInitialBottom,150);
      setTimeout(forceInitialBottom,500);

      // app.js rebuilds the message list on every Firestore snapshot and then
      // calls scrollTop=scrollHeight. After that happens, restore the user's
      // previous position if they had deliberately scrolled up. If they were
      // already at the bottom, keep them at the bottom for new/changed messages.
      const repairPosition=()=>{
        cancelAnimationFrame(restoreTimer);
        restoreTimer=requestAnimationFrame(()=>{
          if(firstLayout)return;
          if(userScrolledUp){
            root.scrollTop=Math.min(savedScrollTop,root.scrollHeight-root.clientHeight);
          }else{
            root.scrollTop=root.scrollHeight-root.clientHeight;
          }
        });
      };

      const obs=new MutationObserver(repairPosition);
      obs.observe(root,{childList:true,subtree:true});
    };

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
    return;
  }

  window.addEventListener('load',()=>setTimeout(save,700));
  window.addEventListener('pagehide',save);
  window.addEventListener('beforeunload',save);
  const root=getRoot();
  if(root){
    const obs=new MutationObserver(()=>{clearTimeout(window.__sheSaveTimer);window.__sheSaveTimer=setTimeout(save,250)});
    window.addEventListener('load',()=>obs.observe(root,{childList:true,subtree:true}));
  }
})();
