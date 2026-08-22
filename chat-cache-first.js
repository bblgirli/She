/* TRUE cache-first chat paint. Runs during HTML parsing, before app.js/Firebase. */
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
  // #messages already exists before this script in chat.html. Paint NOW, not after DOMContentLoaded.
  paint();
})();
