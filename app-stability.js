/* She stability bootstrap v2
 * Keeps the existing UI/business logic intact while making page startup resilient.
 * Cache is scoped to the locally remembered user so one account can never paint
 * another account's chat list before Firebase finishes initializing.
 */
(() => {
  "use strict";

  const FIREBASE_VERSION = "10.12.2";
  const FIREBASE_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const USER_KEY = "she_current_user";

  const firebasePreload = Promise.all([
    import(`${FIREBASE_BASE}/firebase-app.js`),
    import(`${FIREBASE_BASE}/firebase-auth.js`),
    import(`${FIREBASE_BASE}/firebase-firestore.js`)
  ]).catch((error) => {
    console.warn("[She stability] Firebase preload failed; app.js will retry normally.", error);
    return null;
  });

  window.__SHE_STABILITY__ = {
    firebasePreload,
    version: 2
  };

  function safeJsonGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
  }

  function currentUser() {
    const user = safeJsonGet(USER_KEY);
    return user && (user.uid || user.id) ? user : null;
  }

  function userId() {
    return currentUser()?.uid || currentUser()?.id || "";
  }

  function currentChatId() {
    return localStorage.getItem("currentChatUid") || new URLSearchParams(location.search).get("chat") || "";
  }

  function chatListKey() {
    const uid = userId();
    return uid ? `she_chat_list_cache_v3_${uid}` : "";
  }

  function chatShellKey(chatId) {
    const uid = userId();
    return uid && chatId ? `she_chat_dom_v2_${uid}_${chatId}` : "";
  }

  function restoreChatList() {
    const container = document.getElementById("chatList");
    const key = chatListKey();
    if (!container || !key) return;

    const cached = safeJsonGet(key);
    if (!cached?.html) return;
    if (Date.now() - Number(cached.savedAt || 0) > 24 * 60 * 60 * 1000) return;
    if (container.children.length > 0) return;

    container.innerHTML = cached.html;
  }

  function saveChatList() {
    const container = document.getElementById("chatList");
    const key = chatListKey();
    if (!container || !key || !container.innerHTML.trim()) return;

    try {
      localStorage.setItem(key, JSON.stringify({ html: container.innerHTML, savedAt: Date.now() }));
    } catch (error) {
      console.warn("[She stability] Could not cache chat list.", error);
    }
  }

  function restoreChatShell() {
    const messages = document.getElementById("messages");
    const key = chatShellKey(currentChatId());
    if (!messages || !key) return;

    const cached = safeJsonGet(key);
    if (!cached?.html) return;

    try {
      messages.innerHTML = cached.html;
      const typing = document.getElementById("typingIndicator");
      if (typing) messages.appendChild(typing);
      const name = document.querySelector(".chat-profile h3");
      if (name && cached.header?.name) name.textContent = cached.header.name;
    } catch (error) {
      console.warn("[She stability] Could not restore chat shell.", error);
    }
  }

  function bootCacheLayer() {
    restoreChatList();
    restoreChatShell();

    const chatList = document.getElementById("chatList");
    if (chatList) {
      const observer = new MutationObserver(() => {
        clearTimeout(window.__sheChatCacheTimer);
        window.__sheChatCacheTimer = setTimeout(saveChatList, 700);
      });
      observer.observe(chatList, { childList: true, subtree: true });
      window.addEventListener("pagehide", () => {
        clearTimeout(window.__sheChatCacheTimer);
        saveChatList();
        observer.disconnect();
      }, { once: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootCacheLayer, { once: true });
  } else {
    bootCacheLayer();
  }
})();
