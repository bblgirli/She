/* Paint the last open conversation immediately, then let app.js/Firebase refresh it. */
(() => {
  const CHAT_KEY = "currentChatUid";
  const PREFIX = "she_chat_dom_v1_";
  let restoring = false;
  let observer = null;

  const uid = () => localStorage.getItem(CHAT_KEY) || new URLSearchParams(location.search).get("chat");
  const messages = () => document.getElementById("messages");
  const key = id => `${PREFIX}${id}`;

  function restore(id) {
    const box = messages();
    if (!box || !id) return;
    try {
      const cached = JSON.parse(localStorage.getItem(key(id)) || "null");
      if (!cached) return;
      restoring = true;
      if (cached.header) {
        const name = document.querySelector(".chat-profile h3");
        if (name && cached.header.name) name.textContent = cached.header.name;
      }
      if (cached.html) {
        const typing = document.getElementById("typingIndicator");
        box.innerHTML = cached.html;
        if (typing) box.appendChild(typing);
      }
      restoring = false;
    } catch { restoring = false; }
  }

  function save(id) {
    if (!id || restoring) return;
    const box = messages();
    if (!box) return;
    try {
      const clone = box.cloneNode(true);
      clone.querySelector("#typingIndicator")?.remove();
      localStorage.setItem(key(id), JSON.stringify({
        html: clone.innerHTML,
        header: { name: document.querySelector(".chat-profile h3")?.textContent || "Chat" },
        savedAt: Date.now()
      }));
    } catch {}
  }

  function start() {
    const id = uid();
    if (!id) return;
    restore(id);
    const box = messages();
    if (!box) return;
    observer = new MutationObserver(() => {
      if (!restoring) requestAnimationFrame(() => save(id));
    });
    observer.observe(box, { childList:true, subtree:true });
    requestAnimationFrame(() => save(id));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
