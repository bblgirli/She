/* Lightweight mobile chat cache: restore immediately, save only after quiet periods. */
(() => {
  const uid = () => localStorage.getItem("currentChatUid") || new URLSearchParams(location.search).get("chat");
  const box = () => document.getElementById("messages");
  const key = id => `she_chat_dom_v1_${id}`;
  let saveTimer = null;
  let restoring = false;

  function restore(id) {
    const el = box();
    if (!el || !id) return;
    try {
      const cached = JSON.parse(localStorage.getItem(key(id)) || "null");
      if (!cached) return;
      restoring = true;
      const name = document.querySelector(".chat-profile h3");
      if (name && cached.header?.name) name.textContent = cached.header.name;
      if (cached.html) el.innerHTML = cached.html;
      const typing = document.getElementById("typingIndicator");
      if (typing) el.appendChild(typing);
    } catch {}
    restoring = false;
  }

  function saveNow(id) {
    if (!id || restoring) return;
    const el = box();
    if (!el) return;
    try {
      const clone = el.cloneNode(true);
      clone.querySelector("#typingIndicator")?.remove();
      const html = clone.innerHTML;
      if (!html.trim()) return;
      localStorage.setItem(key(id), JSON.stringify({
        html,
        header: { name: document.querySelector(".chat-profile h3")?.textContent || "Chat" },
        savedAt: Date.now()
      }));
    } catch {}
  }

  function scheduleSave(id) {
    if (restoring) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(id), 1200);
  }

  function start() {
    const id = uid();
    if (!id) return;
    restore(id);
    const el = box();
    if (!el) return;

    const observer = new MutationObserver(() => scheduleSave(id));
    observer.observe(el, { childList: true });

    window.addEventListener("pagehide", () => {
      clearTimeout(saveTimer);
      saveNow(id);
      observer.disconnect();
    }, { once: true });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        clearTimeout(saveTimer);
        saveNow(id);
      }
    });

    setTimeout(() => saveNow(id), 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();