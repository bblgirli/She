/* Fast WhatsApp-style chat list bridge.
   Keeps the existing app renderer as the source of truth; this only restores the
   last rendered list immediately, styles it, and makes taps navigate immediately. */
(() => {
  const USER_KEY = "she_current_user";
  const CACHE_PREFIX = "she_chats_dom_v1_";
  const $ = (s) => document.querySelector(s);
  let restoring = false;
  let observer = null;

  const readUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  };
  const cacheKey = (uid) => CACHE_PREFIX + uid;

  function installCSS() {
    if ($("#sheWhatsAppChatCSS")) return;
    const s = document.createElement("style");
    s.id = "sheWhatsAppChatCSS";
    s.textContent = `
      .phone-app .chat-list{padding:0 0 92px!important;overflow-x:hidden!important;overflow-y:auto!important}
      .phone-app .chat-list .chat-item{box-sizing:border-box!important;width:100%!important;min-height:74px!important;margin:0!important;padding:10px 15px!important;display:flex!important;align-items:center!important;border:0!important;border-bottom:1px solid #edf0ee!important;background:#fff!important;cursor:pointer!important}
      .phone-app .chat-list .chat-item:active{background:#f1f3f2!important}
      .phone-app .chat-list .chat-avatar{width:52px!important;height:52px!important;min-width:52px!important;margin-right:13px!important;border-radius:50%!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:23px!important}
      .phone-app .chat-list .chat-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
      .phone-app .chat-list .chat-info{min-width:0!important;flex:1!important}
      .phone-app .chat-list .chat-top{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;min-width:0!important}
      .phone-app .chat-list .chat-top h3{margin:0!important;min-width:0!important;flex:1!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:16px!important;font-weight:600!important}
      .phone-app .chat-list .message-time{flex:none!important;font-size:11px!important;white-space:nowrap!important;opacity:.7!important}
      .phone-app .chat-list .chat-bottom{display:flex!important;align-items:center!important;min-width:0!important;margin-top:4px!important}
      .phone-app .chat-list .chat-bottom p{margin:0!important;min-width:0!important;flex:1!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:13.5px!important;color:#66706c!important}
      .phone-app .chat-list .chat-item.unread .chat-top h3{font-weight:700!important}
      .phone-app .chat-list .chat-item.unread .chat-bottom p{font-weight:600!important;color:#202925!important}
      .phone-app .chat-list .unread-badge{flex:none!important;min-width:20px!important;height:20px!important;padding:0 5px!important;margin-left:8px!important;border-radius:10px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:11px!important;font-weight:700!important;background:#078b59!important;color:#fff!important}
    `;
    document.head.appendChild(s);
  }

  function getList() { return $("#chatList") || $(".chat-list"); }

  function restore(uid) {
    const list = getList();
    if (!list || !uid) return false;
    try {
      const html = localStorage.getItem(cacheKey(uid));
      if (!html) return false;
      restoring = true;
      list.innerHTML = html;
      restoring = false;
      return !!list.children.length;
    } catch { restoring = false; return false; }
  }

  function save(uid) {
    if (!uid || restoring) return;
    const list = getList();
    if (!list || !list.children.length) return;
    try { localStorage.setItem(cacheKey(uid), list.innerHTML); } catch {}
  }

  function fastOpen(row) {
    const onclick = row.getAttribute("onclick") || "";
    const m = onclick.match(/openChat\(['"]([^'"]+)['"]/);
    const uid = row.dataset.chatUid || (m && m[1]);
    if (!uid) return false;
    localStorage.setItem("currentChatUid", uid);
    window.location.replace("chat.html");
    return true;
  }

  function handleClick(e) {
    const row = e.target.closest?.("#chatList .chat-item, .chat-list .chat-item");
    if (!row) return;
    if (fastOpen(row)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function watch(uid) {
    const list = getList();
    if (!list || observer) return;
    observer = new MutationObserver(() => {
      if (restoring) return;
      requestAnimationFrame(() => save(uid));
    });
    observer.observe(list, { childList: true, subtree: true });
    save(uid);
  }

  function start() {
    installCSS();
    const user = readUser();
    const uid = user?.uid;
    if (!uid) return;
    restore(uid);
    document.addEventListener("click", handleClick, true);
    watch(uid);
    requestAnimationFrame(() => { installCSS(); save(uid); });
    setTimeout(() => { installCSS(); save(uid); }, 0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();