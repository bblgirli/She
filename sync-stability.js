(()=>{
  const p=(location.pathname.split('/').pop()||'').toLowerCase();
  if(!/^(chat|chats|app)\.html$/.test(p))return;
  const K='she_last_screen_html_'+p;
  const isChat=p==='chat.html';
  const getRoot=()=>p==='chats.html'?document.getElementById('chatList'):document.getElementById('messages');
  const save=()=>{
    try{
      const root=getRoot();
      if(root&&root.innerHTML.trim()) localStorage.setItem(K,root.innerHTML);
    }catch(_){}
  };
  // IMPORTANT: chat.html must never restore cached message HTML into the live
  // messages container. Replacing it resets scroll position and destroys the
  // live message nodes while Firebase/reaction/delete updates are running.
  // Keep the cache for other pages, but let chat.html remain fully live.
  const restore=()=>{
    if(isChat)return;
    try{
      const root=getRoot(),cached=localStorage.getItem(K);
      if(root&&cached){
        root.innerHTML=cached;
        root.dataset.restored='1';
      }
    }catch(_){}
  };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',restore,{once:true});
  }else restore();
  window.addEventListener('load',()=>setTimeout(save,700));
  window.addEventListener('pagehide',save);
  window.addEventListener('beforeunload',save);
  const root=getRoot();
  if(root){
    const obs=new MutationObserver(()=>{
      clearTimeout(window.__sheSaveTimer);
      window.__sheSaveTimer=setTimeout(save,250);
    });
    window.addEventListener('load',()=>obs.observe(root,{childList:true,subtree:true}));
  }
})();
