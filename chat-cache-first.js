/* TRUE cache-first chat paint. Uses only the full-conversation cache (v2). */
(() => {
  const key=id=>`she_chat_full_v2_${id}`;
  const uid=()=>localStorage.getItem("currentChatUid")||new URLSearchParams(location.search).get("chat");
  const box=()=>document.getElementById("messages");
  const id=uid(),el=box();
  if(!id||!el)return;
  try{const c=JSON.parse(localStorage.getItem(key(id))||"null");if(c?.html?.trim()){el.innerHTML=c.html;const n=document.querySelector(".chat-profile h3");if(n&&c.header?.name)n.textContent=c.header.name;document.documentElement.classList.add("chat-cache-painted")}}catch{}
})();
