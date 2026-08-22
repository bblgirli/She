/* Fast chat list: zero-delay navigation prewarm. */
(() => {
  const USER_KEY="she_current_user";
  const getUser=()=>{try{return JSON.parse(localStorage.getItem(USER_KEY)||"null")}catch{return null}};
  const list=()=>document.getElementById("chatList")||document.querySelector(".chat-list");
  let prefetched=false;
  function prewarm(){if(prefetched)return;prefetched=true;const l=document.createElement("link");l.rel="prefetch";l.as="document";l.href="/chat.html";document.head.appendChild(l)}
  function fastOpen(row){
    const onclick=row.getAttribute("onclick")||"";const match=onclick.match(/openChat\(['"]([^'"]+)['"]/);const uid=row.dataset.chatUid||(match&&match[1]);if(!uid)return false;
    localStorage.setItem("currentChatUid",uid);const name=row.querySelector(".chat-top h3")?.textContent?.trim();if(name)localStorage.setItem("currentChatName",name);
    // Let the browser navigate normally; prefetch makes chat.html an app-shell hit.
    window.location.href=`/chat.html?chat=${encodeURIComponent(uid)}`;return true;
  }
  function start(){const uid=getUser()?.uid;if(!uid)return;const el=list();if(!el)return;prewarm();
    el.querySelectorAll(".chat-item").forEach(row=>row.addEventListener("pointerdown",prewarm,{passive:true,once:true}));
    document.addEventListener("click",e=>{const row=e.target.closest?.("#chatList .chat-item,.chat-list .chat-item");if(!row)return;if(fastOpen(row)){e.preventDefault();e.stopImmediatePropagation()}},true);
    new MutationObserver(()=>el.querySelectorAll(".chat-item:not([data-nav-ready])").forEach(row=>{row.dataset.navReady="1";row.addEventListener("pointerdown",prewarm,{passive:true,once:true})})).observe(el,{childList:true,subtree:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
