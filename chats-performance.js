/* Chats performance layer — keeps existing chat logic intact. */
(()=>{
  const CACHE_KEY='she_chat_list_cache_v1';
  const style=document.createElement('style');
  style.textContent=`
    #chatList{overflow-x:hidden;-webkit-overflow-scrolling:touch}
    #chatList .chat-item{display:flex;align-items:center;gap:12px;min-height:72px;padding:10px 14px;margin:0;border:0;border-bottom:1px solid rgba(0,0,0,.07);background:transparent;cursor:pointer;contain:content;}
    #chatList .chat-item:active{background:rgba(0,0,0,.05)}
    #chatList .chat-avatar{width:52px;height:52px;min-width:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:24px}
    #chatList .chat-avatar img{width:100%;height:100%;object-fit:cover;display:block}
    #chatList .chat-info{min-width:0;flex:1}
    #chatList .chat-top,#chatList .chat-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
    #chatList .chat-top h3{margin:0;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;font-weight:600}
    #chatList .message-time{flex:none;font-size:12px;white-space:nowrap;opacity:.65}
    #chatList .chat-bottom p{margin:4px 0 0;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;opacity:.7}
    #chatList .chat-bottom .unread-badge{flex:none;min-width:20px;height:20px;padding:0 6px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:#078b59;color:#fff}
    #chatList .chat-item.unread .chat-top h3{font-weight:700}
    #chatList .chat-item.unread .chat-bottom p{font-weight:600;opacity:1}
  `;
  document.head.appendChild(style);

  function saveVisibleList(){
    const list=document.getElementById('chatList');
    if(!list||!list.children.length)return;
    try{localStorage.setItem(CACHE_KEY,list.innerHTML)}catch(_){ }
  }
  function restoreVisibleList(){
    const list=document.getElementById('chatList');
    if(!list||list.children.length)return;
    try{const html=localStorage.getItem(CACHE_KEY);if(html)list.innerHTML=html}catch(_){ }
  }
  function watchList(){
    const list=document.getElementById('chatList');
    if(!list)return false;
    restoreVisibleList();
    let timer=0;
    new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(saveVisibleList,60)}).observe(list,{childList:true,subtree:true});
    saveVisibleList();
    return true;
  }
  function installFastOpen(){
    const original=window.openChat;
    window.openChat=(uid)=>{
      if(!uid)return;
      localStorage.setItem('currentChatUid',uid);
      window.location.href='chat.html';
      void original;
    };
  }
  function boot(){
    watchList();
    installFastOpen();
    setTimeout(()=>{watchList();installFastOpen()},300);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
