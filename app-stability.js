/* She stability bootstrap
 * Keeps the existing UI/business logic intact while making page startup resilient.
 * It preloads Firebase modules, restores cached chat shells immediately, and caches
 * rendered chat lists so navigation never has to start from a blank screen.
 */
(() => {
  "use strict";

  const FIREBASE_VERSION = "10.12.2";
  const FIREBASE_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

  // Start downloading Firebase modules as early as possible. app.js will reuse the
  // browser's module cache when it performs its normal dynamic imports.
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
    version: 1
  };

  function currentChatId() {
    return localStorage.getItem("currentChatUid") || new URLSearchParams(location.search).get("chat") || "";
  }

  function safeJsonGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
  }

  function restoreChatList() {
    const container = document.getElementById("chatList");
    if (!container) return;

    const cached = safeJsonGet("she_chat_list_cache_v2");
    if (!cached?.html) return;

    // Only use a cache that is reasonably recent. Firebase will replace it with
    // the authoritative list as soon as the listener is ready.
    if (Date.now() - Number(cached.savedAt || 0) > 24 * 60 * 60 * 1000) return;
    if (container.children.length > 0) return;

    container.innerHTML = cached.html;
  }

  function saveChatList() {
    const container = document.getElementById("chatList");
    if (!container || !container.innerHTML.trim()) return;

    try {
      localStorage.setItem("she_chat_list_cache_v2", JSON.stringify({
        html: container.innerHTML,
        savedAt: Date.now()
      }));
    } catch (error) {
      // Storage can be unavailable or full; stability must never depend on it.
      console.warn("[She stability] Could not cache chat list.", error);
    }
  }

  function restoreChatShell() {
    const messages = document.getElementById("messages");
    const chatId = currentChatId();
    if (!messages || !chatId) return;

    const cached = safeJsonGet(`she_chat_dom_v1_${chatId}`);
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
