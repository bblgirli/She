/* Save the rendered conversation only after the page has had time to hydrate. */
(() => {
  const uid=()=>localStorage.getItem("currentChatUid")||new URLSearchParams(location.search).get("chat");
  const box=()=>document.getElementById("messages");
  const key=id=>`she_chat_full_v2_${id}`;
  const id=uid(); if(!id)return;
  let saveTimer=0;
  function save(){const el=box();if(!el)return;const clone=el.cloneNode(true);clone.querySelector("#typingIndicator")?.remove();const html=clone.innerHTML;if(!html.trim()||el.querySelectorAll(".message").length<1)return;try{localStorage.setItem(key(id),JSON.stringify({html,header:{name:document.querySelector(".chat-profile h3")?.textContent||"Chat"},savedAt:Date.now()}))}catch{}}
  // Give Firebase the opportunity to deliver the complete initial snapshot before caching.
  saveTimer=setTimeout(save,5000);
  window.addEventListener("pagehide",()=>{clearTimeout(saveTimer);save()},{once:true});
})();
