/* Immediate chat cache: restore the previous conversation during HTML parsing, before Firebase. */
(() => {
  const uid = () => localStorage.getItem("currentChatUid") || new URLSearchParams(location.search).get("chat");
  const box = () => document.getElementById("messages");
  const key = id => `she_chat_dom_v1_${id}`;
  let saveTimer = null;
  let restoring = false;
  function restore(id) {
    const el = box(); if (!el || !id) return;
    try {
      const cached = JSON.parse(localStorage.getItem(key(id)) || "null");
      if (!cached?.html?.trim()) return;
      restoring = true;
      const name = document.querySelector(".chat-profile h3");
      if (name && cached.header?.name) name.textContent = cached.header.name;
      el.innerHTML = cached.html;
      restoring = false;
    } catch { restoring = false; }
  }
  function saveNow(id) {
    if (!id || restoring) return;
    const el = box(); if (!el) return;
    try {
      const clone = el.cloneNode(true); clone.querySelector("#typingIndicator")?.remove();
      const html = clone.innerHTML; if (!html.trim()) return;
      localStorage.setItem(key(id), JSON.stringify({html,header:{name:document.querySelector(".chat-profile h3")?.textContent||"Chat"},savedAt:Date.now()}));
    } catch {}
  }
  function start() {
    const id = uid(); if (!id) return;
    restore(id);
    const el = box(); if (!el) return;
    const observer = new MutationObserver(() => {
      // Never save a temporary Firebase/loading state over good cached messages.
      const text = el.textContent || "";
      if (!el.children.length || /^(loading|checking firebase|loading messages)/i.test(text.trim())) return;
      clearTimeout(saveTimer); saveTimer = setTimeout(() => saveNow(id), 1200);
    });
    observer.observe(el, {childList:true,subtree:true});
    window.addEventListener("pagehide", () => { clearTimeout(saveTimer); saveNow(id); observer.disconnect(); }, {once:true});
  }
  // #messages already exists before this script. Do not wait for DOMContentLoaded.
  start();
})();
