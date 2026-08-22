/* Fast chat list: cache-first + instant navigation prewarm. */
(() => {
  const USER_KEY="she_current_user", CACHE_PREFIX="she_chats_dom_v2_";
  const getUser=()=>{try{return JSON.parse(localStorage.getItem(USER_KEY)||"null")}catch{return null}};
  const list=()=>document.getElementById("chatList")||document.querySelector(".chat-list");
  const key=uid=>`${CACHE_PREFIX}${uid}`;
  function prewarm(){
    if(document.getElementById("she-chat-prefetch"))return;
    const l=document.createElement("link");l.id="she-chat-prefetch";l.rel="prefetch";l.as="document";l.href="chat.html";document.head.appendChild(l);
  }
  function fastOpen(row){
    const onclick=row.getAttribute("onclick")||"";const match=onclick.match(/openChat\(['"]([^'"]+)['"]/);const uid=row.dataset.chatUid||(match&&match[1]);if(!uid)return false;
    localStorage.setItem("currentChatUid",uid);
    const name=row.querySelector(".chat-top h3")?.textContent?.trim();if(name)localStorage.setItem("currentChatName",name);
    window.location.assign(`chat.html?chat=${encodeURIComponent(uid)}`);return true;
  }
  function start(){
    prewarm();
    const uid=getUser()?.uid;if(!uid)return;
    const el=list();if(!el)return;
    const observer=new MutationObserver(()=>{prewarm();el.querySelectorAll(".chat-item").forEach(row=>{if(row.dataset.prefetch)return;row.dataset.prefetch="1";row.addEventListener("pointerdown",()=>prewarm(),{passive:true})})});
    observer.observe(el,{childList:true,subtree:true});
    el.querySelectorAll(".chat-item").forEach(row=>{row.addEventListener("pointerdown",()=>prewarm(),{passive:true})});
    document.addEventListener("click",e=>{const row=e.target.closest?.("#chatList .chat-item,.chat-list .chat-item");if(!row)return;if(fastOpen(row)){e.preventDefault();e.stopImmediatePropagation()}},true);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
