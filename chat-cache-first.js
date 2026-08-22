/* Cache-first chat paint: keep the previous conversation visible until fresh data is ready. */
(() => {
  "use strict";
  const cacheKey = uid => `she_chat_dom_v1_${uid}`;
  const uid = () => localStorage.getItem("currentChatUid") || new URLSearchParams(location.search).get("chat");
  const box = () => document.getElementById("messages");
  function paint() {
    const id = uid(), el = box();
    if (!id || !el) return;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey(id)) || "null");
      if (!cached?.html?.trim()) return;
      el.innerHTML = cached.html;
      const typing = document.getElementById("typingIndicator");
      if (typing) typing.style.display = "none";
      document.documentElement.classList.add("chat-cache-painted");
    } catch {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint, { once:true });
  else paint();
})();
