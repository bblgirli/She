(()=>{
  const page=(location.pathname.split('/').pop()||'').toLowerCase();
  const targets={
    'chats.html':'.phone-app',
    'chat.html':'.chat-app',
    'app.html':'.phone-app'
  };
  const selector=targets[page];
  if(!selector)return;
  const key='she_screen_snapshot_'+page;
  let restoring=false;
  const get=()=>document.querySelector(selector);
  const save=()=>{
    if(restoring)return;
    try{
      const el=get();
      if(!el)return;
      const html=el.innerHTML;
      if(html&&html.trim().length>40)localStorage.setItem(key,html);
    }catch(_){}
  };
  const restore=()=>{
    try{
      const el=get(),html=localStorage.getItem(key);
      if(!el||!html)return false;
      restoring=true;
      el.innerHTML=html;
      el.dataset.silentRestored='1';
      restoring=false;
      return true;
    }catch(_){restoring=false;return false;}
  };
  const boot=()=>{
    restore();
    setTimeout(restore,80);
    setTimeout(restore,350);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('pagehide',save);
  window.addEventListener('beforeunload',save);
  setInterval(save,2500);
})();
