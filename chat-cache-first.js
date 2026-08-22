/* Full conversation cache-first paint. Never restore the old partial v1 DOM cache. */
(() => {
  "use strict";
  const user=()=>{try{return JSON.parse(localStorage.getItem("she_current_user")||"null")}catch{return null}};
  const chat=()=>localStorage.getItem("currentChatUid")||new URLSearchParams(location.search).get("chat")||"";
  const candidates=()=>{const c=chat(),u=user()?.uid;return u&&c?[`she_chat_full_v2_${u}_${c}`,`she_chat_full_v2_${c}`]:c?[`she_chat_full_v2_${c}`]:[]};
  const box=document.getElementById("messages"); if(!box)return;
  try{for(const k of candidates()){const c=JSON.parse(localStorage.getItem(k)||"null");if(!c?.html?.trim())continue;box.innerHTML=c.html;const n=document.querySelector(".chat-profile h3");if(n&&c.header?.name)n.textContent=c.header.name;document.documentElement.classList.add("chat-cache-painted");break}}catch{}
})();
