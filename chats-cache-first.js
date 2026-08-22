/* TRUE cache-first paint. Runs during HTML parsing, before app.js/Firebase can paint a loading state. */
(() => {
  "use strict";
  const key = uid => `she_chats_dom_v2_${uid}`;
  const getUid = () => { try { return JSON.parse(localStorage.getItem("she_current_user") || "null")?.uid || null; } catch { return null; } };
  const list = () => document.getElementById("chatList");
  const skeleton = `<div class="chat-cache-skeleton" aria-hidden="true"><i></i><div><b></b><span></span></div></div><div class="chat-cache-skeleton" aria-hidden="true"><i></i><div><b></b><span></span></div></div><div class="chat-cache-skeleton" aria-hidden="true"><i></i><div><b></b><span></span></div></div>`;
  function install() {
    const el = list(); if (!el) return;
    const uid = getUid();
    let html = "";
    try { html = uid ? localStorage.getItem(key(uid)) || "" : ""; } catch {}
    if (html.trim()) el.innerHTML = html;
    else el.innerHTML = skeleton;
    if (!document.getElementById("chat-cache-skeleton-css")) {
      const style = document.createElement("style"); style.id = "chat-cache-skeleton-css";
      style.textContent = `.chat-cache-skeleton{height:72px;display:flex;align-items:center;gap:13px;padding:9px 15px;box-sizing:border-box;opacity:.65}.chat-cache-skeleton i{width:52px;height:52px;border-radius:50%;background:linear-gradient(90deg,#eee,#f7f7f7,#eee);background-size:200% 100%;animation:sheSk 1.2s infinite}.chat-cache-skeleton div{flex:1}.chat-cache-skeleton b,.chat-cache-skeleton span{display:block;height:11px;border-radius:6px;background:linear-gradient(90deg,#eee,#f7f7f7,#eee);background-size:200% 100%;animation:sheSk 1.2s infinite}.chat-cache-skeleton b{width:55%;margin-bottom:9px}.chat-cache-skeleton span{width:78%}@keyframes sheSk{to{background-position:-200% 0}}`;
      document.head.appendChild(style);
    }
  }
  // chatList already exists before this script in chats.html. Do NOT wait for DOMContentLoaded.
  install();
})();
