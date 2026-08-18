(()=>{
  if(!/\/chat\.html$/i.test(location.pathname))return;
  const uid=localStorage.getItem('currentChatUid');
  if(!uid)return;
  const key='she_chat_snapshot_'+uid;
  document.addEventListener('DOMContentLoaded',()=>{
    const box=document.getElementById('messages');
    if(!box)return;
    let saveTimer;
    const save=()=>{
      clearTimeout(saveTimer);
      saveTimer=setTimeout(()=>{
        try{
          const html=box.innerHTML;
          if(html&&html.replace(/<div id="typingIndicator"[^>]*>[\s\S]*?<\/div>/,'').trim())localStorage.setItem(key,html);
        }catch(_){}
      },150);
    };
    new MutationObserver(save).observe(box,{childList:true,subtree:true});
  },{once:true});
})();