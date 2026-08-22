/* She stability bootstrap v4 */
(() => {
  const FIREBASE_VERSION="10.12.2";
  const FIREBASE_BASE=`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const USER_KEY="she_current_user", LAST_USER_KEY="she_last_rendered_user";
  const safe=k=>{try{return JSON.parse(localStorage.getItem(k)||"null")}catch{return null}};
  const user=()=>safe(USER_KEY), uid=()=>user()?.uid||user()?.id||"";
  const chat=()=>localStorage.getItem("currentChatUid")||new URLSearchParams(location.search).get("chat")||"";
  const firebasePreload=Promise.all([import(`${FIREBASE_BASE}/firebase-app.js`),import(`${FIREBASE_BASE}/firebase-auth.js`),import(`${FIREBASE_BASE}/firebase-firestore.js`)]).catch(()=>null);
  window.__SHE_STABILITY__={firebasePreload,version:4};
  const reset=()=>{const id=uid(),old=localStorage.getItem(LAST_USER_KEY)||"";if(id&&old&&old!==id){localStorage.removeItem("currentChatUid");try{sessionStorage.removeItem("currentChatUid")}catch{}}if(id)localStorage.setItem(LAST_USER_KEY,id)};
  const listKey=()=>uid()?`she_chat_list_cache_v3_${uid()}`:"";
  const fullKey=()=>uid()&&chat()?`she_chat_full_v2_${uid()}_${chat()}`:"";
  const restoreList=()=>{const e=document.getElementById("chatList"),k=listKey(),c=k&&safe(k);if(e&&c?.html&&!e.children.length)e.innerHTML=c.html};
  const saveList=()=>{const e=document.getElementById("chatList"),k=listKey();if(e&&k&&e.innerHTML.trim())try{localStorage.setItem(k,JSON.stringify({html:e.innerHTML,savedAt:Date.now()}))}catch{}};
  const restoreFull=()=>{const e=document.getElementById("messages"),c=fullKey()&&safe(fullKey());if(e&&c?.html){e.innerHTML=c.html;const n=document.querySelector(".chat-profile h3");if(n&&c.header?.name)n.textContent=c.header.name}};
  reset();restoreList();if(document.body?.classList.contains("chat-page")){restoreFull();const e=document.getElementById("messages"),c=fullKey()&&safe(fullKey()),count=c?.count||c?.html?.match(/class=["']message\b/g)?.length||0;if(e&&count)new MutationObserver(()=>{if(e.querySelectorAll(".message").length<count)e.innerHTML=c.html}).observe(e,{childList:true,subtree:true});}
  if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{});
  const boot=()=>{if(document.body?.classList.contains("chat-page"))import("./read-receipts.js").catch(()=>{});const e=document.getElementById("chatList");if(e){const o=new MutationObserver(()=>{clearTimeout(window.__sheChatCacheTimer);window.__sheChatCacheTimer=setTimeout(saveList,700)});o.observe(e,{childList:true,subtree:true});window.addEventListener("pagehide",()=>{clearTimeout(window.__sheChatCacheTimer);saveList();o.disconnect()},{once:true})}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
