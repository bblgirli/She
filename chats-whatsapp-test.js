/* Isolated WhatsApp-style chat-list test. Does not modify existing chat logic. */
(()=>{
  const CACHE='she_whatsapp_chat_test_v1';
  const css=document.createElement('style');css.textContent=`#chatList .chat-item{display:flex;align-items:center;gap:12px;min-height:72px;padding:10px 14px;border-bottom:1px solid rgba(0,0,0,.07);box-sizing:border-box}#chatList .chat-info{min-width:0;flex:1}#chatList .chat-top,#chatList .chat-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}#chatList .chat-bottom p{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#chatList .chat-item.unread .chat-top h3,#chatList .chat-item.unread .chat-bottom p{font-weight:700}#chatList .unread-badge{min-width:20px;height:20px;padding:0 6px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:#078b59;color:#fff}`;document.head.appendChild(css);
  const list=()=>document.getElementById('chatList');
  const unread=e=>e.classList.contains('unread')||!!e.querySelector('.unread-badge');
  function update(){const box=list();if(!box)return;const rows=[...box.querySelectorAll('.chat-item')];if(!rows.length)return;const u=rows.filter(unread),r=rows.filter(e=>!unread(e));const f=document.createDocumentFragment();[...u,...r].forEach(e=>f.appendChild(e));box.appendChild(f);try{localStorage.setItem(CACHE,box.innerHTML)}catch(_){} }
  function boot(){const box=list();if(!box)return;new MutationObserver(()=>requestAnimationFrame(update)).observe(box,{childList:true,subtree:true});update();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
