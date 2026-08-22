/* She stability bootstrap v5: start fast, never block first paint on Firebase. */
(() => {
  const USER_KEY="she_current_user", LAST_USER_KEY="she_last_rendered_user";
  const safe=k=>{try{return JSON.parse(localStorage.getItem(k)||"null")}catch{return null}};
  const user=()=>safe(USER_KEY), uid=()=>user()?.uid||user()?.id||"";
  const chat=()=>localStorage.getItem("currentChatUid")||new URLSearchParams(location.search).get("chat")||"";
  // Preconnect/preload Firebase without making it a prerequisite for rendering.
  const origins=["https://www.gstatic.com","https://firestore.googleapis.com","https://identitytoolkit.googleapis.com"];
  origins.forEach(h=>{if(!document.head.querySelector(`link[rel=preconnect][href="${h}"]`)){const l=document.createElement("link");l.rel="preconnect";l.href=h;l.crossOrigin="anonymous";document.head.appendChild(l)}});
  window.__SHE_STABILITY__={version:5};
  const reset=()=>{const id=uid(),old=localStorage.getItem(LAST_USER_KEY)||"";if(id&&old&&old!==id){localStorage.removeItem("currentChatUid");try{sessionStorage.removeItem("currentChatUid")}catch{}}if(id)localStorage.setItem(LAST_USER_KEY,id)};
  const listKey=()=>uid()?`she_chat_list_cache_v3_${uid()}`:"";
  const fullKey=()=>uid()&&chat()?`she_chat_full_v2_${uid()}_${chat()}`:"";
  const restoreList=()=>{const e=document.getElementById("chatList"),k=listKey(),c=k&&safe(k);if(e&&c?.html&&!e.children.length)e.innerHTML=c.html};
  const restoreFull=()=>{const e=document.getElementById("messages"),c=fullKey()&&safe(fullKey());if(e&&c?.html){e.innerHTML=c.html;const n=document.querySelector(".chat-profile h3");if(n&&c.header?.name)n.textContent=c.header.name}};
  reset();restoreList();if(document.body?.classList.contains("chat-page"))restoreFull();
  if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).catch(()=>{});
  // Cache writes happen after UI exists; nothing here waits for them.
  const boot=()=>{const e=document.getElementById("chatList");if(e){let t;const save=()=>{clearTimeout(t);t=setTimeout(()=>{const k=listKey();if(k&&e.innerHTML.trim())try{localStorage.setItem(k,JSON.stringify({html:e.innerHTML,savedAt:Date.now()}))}catch{}},500)};new MutationObserver(save).observe(e,{childList:true,subtree:true});window.addEventListener("pagehide",save,{once:true})}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
