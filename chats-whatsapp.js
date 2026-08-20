/* WhatsApp-style chat list + stable instant restore.
   Keeps the existing Firebase/app renderer intact and only improves the
   presentation, cached first paint, ordering stability, and scroll position. */
(() => {
  const USER_KEY = "she_current_user";
  const CACHE_PREFIX = "she_chats_dom_v2_";
  const SCROLL_PREFIX = "she_chats_scroll_v1_";
  let restoring = false;
  let observer = null;
  let saveTimer = 0;
  let lastHTML = "";

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  };
  const list = () => document.getElementById("chatList") || document.querySelector(".chat-list");
  const key = uid => `${CACHE_PREFIX}${uid}`;
  const scrollKey = uid => `${SCROLL_PREFIX}${uid}`;

  function installCSS() {
    if (document.getElementById("sheWhatsAppChatCSS")) return;
    const style = document.createElement("style");
    style.id = "sheWhatsAppChatCSS";
    style.textContent = `
      .chat-list{width:100%!important;box-sizing:border-box!important;overflow-x:hidden!important;overflow-y:auto!important;padding:0 0 92px!important;margin:0!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important;scroll-behavior:auto!important}
      .chat-list .chat-item{width:100%!important;box-sizing:border-box!important;min-height:72px!important;margin:0!important;padding:9px 15px!important;display:flex!important;align-items:center!important;gap:0!important;border:0!important;border-bottom:1px solid #edf0ee!important;background:#fff!important;cursor:pointer!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important;transition:background-color .12s ease!important}
      .chat-list .chat-item:active{background:#f1f3f2!important}
      .chat-list .chat-avatar{width:52px!important;height:52px!important;min-width:52px!important;max-width:52px!important;margin:0 13px 0 0!important;border-radius:50%!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:23px!important;background:#ddd!important}
      .chat-list .chat-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
      .chat-list .chat-info{min-width:0!important;flex:1 1 auto!important;width:0!important}
      .chat-list .chat-top{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;min-width:0!important}
      .chat-list .chat-top h3{margin:0!important;min-width:0!important;flex:1 1 auto!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:16px!important;font-weight:500!important;line-height:21px!important}
      .chat-list .message-time{flex:0 0 auto!important;font-size:11px!important;white-space:nowrap!important;opacity:.7!important}
      .chat-list .chat-bottom{display:flex!important;align-items:center!important;min-width:0!important;margin-top:3px!important}
      .chat-list .chat-bottom p{margin:0!important;min-width:0!important;flex:1 1 auto!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:13.5px!important;line-height:19px!important;color:#66706c!important}
      .chat-list .chat-item.unread .chat-top h3{font-weight:700!important}
      .chat-list .chat-item.unread .chat-bottom p{font-weight:600!important;color:#202925!important}
      .chat-list .unread-badge{flex:0 0 auto!important;min-width:20px!important;height:20px!important;padding:0 5px!important;margin-left:8px!important;border-radius:10px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:11px!important;font-weight:700!important;background:#078b59!important;color:#fff!important}
      @media (prefers-color-scheme: dark){
        .chat-list .chat-item{background:#1c1c1c!important;border-bottom-color:#333!important;color:#f3f3f3!important}
        .chat-list .chat-item:active{background:#252525!important}
        .chat-list .chat-top h3{color:#f3f3f3!important}
        .chat-list .message-time{color:#bdbdbd!important}
        .chat-list .chat-bottom p{color:#bdbdbd!important}
        .chat-list .chat-item.unread .chat-bottom p{color:#e4ebe8!important}
        .chat-list .chat-item.unread .chat-top h3{color:#fff!important}
      }
      html[data-theme="dark"] .chat-list .chat-item{background:#1c1c1c!important;border-bottom-color:#333!important;color:#f3f3f3!important}
      html[data-theme="dark"] .chat-list .chat-item:active{background:#252525!important}
      html[data-theme="dark"] .chat-list .chat-top h3{color:#f3f3f3!important}
      html[data-theme="dark"] .chat-list .message-time,html[data-theme="dark"] .chat-list .chat-bottom p{color:#bdbdbd!important}
      html[data-theme="dark"] .chat-list .chat-item.unread .chat-bottom p{color:#e4ebe8!important}
      html[data-theme="dark"] .chat-list .chat-item.unread .chat-top h3{color:#fff!important}
    `;
    document.head.appendChild(style);
  }

  function restore(uid) {
    const el = list();
    if (!el || !uid) return;
    try {
      const html = localStorage.getItem(key(uid));
      if (!html) return;
      restoring = true;
      el.innerHTML = html;
      lastHTML = html;
      restoring = false;
      requestAnimationFrame(() => {
        try { el.scrollTop = Number(localStorage.getItem(scrollKey(uid)) || 0); } catch {}
      });
    } catch { restoring = false; }
  }

  function save(uid) {
    if (!uid || restoring) return;
    const el = list();
    if (!el || !el.children.length) return;
    const html = el.innerHTML;
    if (html === lastHTML) return;
    lastHTML = html;
    try { localStorage.setItem(key(uid), html); } catch {}
  }

  function scheduleSave(uid) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(uid), 120);
  }

  function saveScroll(uid) {
    const el = list();
    if (!el || !uid) return;
    try { localStorage.setItem(scrollKey(uid), String(el.scrollTop)); } catch {}
  }

  function fastOpen(row) {
    const onclick = row.getAttribute("onclick") || "";
    const match = onclick.match(/openChat\(['"]([^'"]+)['"]/);
    const uid = row.dataset.chatUid || (match && match[1]);
    if (!uid) return false;
    localStorage.setItem("currentChatUid", uid);
    window.location.replace(`chat.html?chat=${encodeURIComponent(uid)}`);
    return true;
  }

  function onClick(event) {
    const row = event.target.closest?.("#chatList .chat-item, .chat-list .chat-item");
    if (!row || !fastOpen(row)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function start() {
    installCSS();
    const uid = getUser()?.uid;
    if (!uid) return;
    restore(uid);
    document.addEventListener("click", onClick, true);
    const el = list();
    if (!el) return;

    let scrollTimer = 0;
    el.addEventListener("scroll", () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => saveScroll(uid), 180);
    }, {passive:true});

    observer = new MutationObserver(() => {
      if (!restoring) scheduleSave(uid);
    });
    observer.observe(el, { childList:true, subtree:true });
    if (el.children.length) save(uid);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();