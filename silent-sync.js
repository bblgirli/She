(()=>{
  const page=(location.pathname.split('/').pop()||'').toLowerCase();
  const targets={'chats.html':'.phone-app','chat.html':'.chat-app','app.html':'.phone-app'};
  const selector=targets[page];
  if(!selector)return;
  const key='she_screen_snapshot_'+page;
  let restoring=false;
  const get=()=>document.querySelector(selector);
  const normalizeChats=()=>{
    if(page!=='chats.html')return;
    const root=get();
    if(!root)return;
    root.style.width='100%';
    root.style.maxWidth='none';
    root.style.minWidth='0';
    root.style.marginLeft='0';
    root.style.marginRight='0';
    const list=root.querySelector('#chatList');
    if(list){
      list.style.width='100%';
      list.style.maxWidth='none';
      list.style.minWidth='0';
      list.style.marginLeft='0';
      list.style.marginRight='0';
    }
  };
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
      if(page==='chat.html')return false;
      restoring=true;
      el.innerHTML=html;
      el.dataset.silentRestored='1';
      restoring=false;
      normalizeChats();
      window.dispatchEvent(new CustomEvent('sheScreenRestored'));
      return true;
    }catch(_){restoring=false;return false;}
  };
  const boot=()=>{
    restore();
    normalizeChats();
    if(page!=='chat.html'){
      setTimeout(()=>{restore();normalizeChats()},80);
      setTimeout(()=>{restore();normalizeChats()},350);
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('pagehide',save);
  window.addEventListener('beforeunload',save);
  setInterval(save,2500);
})();
