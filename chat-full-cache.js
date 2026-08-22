/* Full conversation cache writer. Stores only a complete rendered conversation, scoped to account + chat. */
(() => {
  const user=()=>{try{return JSON.parse(localStorage.getItem("she_current_user")||"null")}catch{return null}};
  const chat=()=>localStorage.getItem("currentChatUid")||new URLSearchParams(location.search).get("chat")||"";
  const key=()=>{const u=user()?.uid,c=chat();return u&&c?`she_chat_full_v2_${u}_${c}`:""};
  let timer=0,lastCount=0,stable=0;
  function save(){const el=document.getElementById("messages"),k=key();if(!el||!k)return;const nodes=[...el.querySelectorAll(".message")];if(nodes.length<1)return;const count=nodes.length;if(count<lastCount){stable=0;return}if(count===lastCount)stable++;else{lastCount=count;stable=0}if(stable<2){timer=setTimeout(save,1500);return}const clone=el.cloneNode(true);clone.querySelector("#typingIndicator")?.remove();try{localStorage.setItem(k,JSON.stringify({html:clone.innerHTML,header:{name:document.querySelector(".chat-profile h3")?.textContent||"Chat"},count,savedAt:Date.now()}))}catch{}}
  setTimeout(save,2500);window.addEventListener("pagehide",()=>{clearTimeout(timer);save()},{once:true});
})();
