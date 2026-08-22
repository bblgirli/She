/* Single runtime coordinator: cache-first UI, account-safe async work, and stable presence. */
(function () {
  "use strict";
  const CACHE_VERSION = "v3";
  const account = () => window.SheFirebase?.auth?.currentUser?.uid || localStorage.getItem("she_current_user_uid") || "guest";
  const key = (kind, id = "") => `she:${CACHE_VERSION}:${account()}:${kind}:${id}`;

  function read(kind, id) { try { const raw = localStorage.getItem(key(kind,id)); return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
  function write(kind, id, value) { try { localStorage.setItem(key(kind,id), JSON.stringify(value)); } catch (_) {} }

  window.SheRuntime = Object.freeze({ cache: { read, write }, account, key });

  // Prevent stale account data from becoming visible after a switch.
  window.addEventListener("she:account-changed", () => {
    try { sessionStorage.removeItem("she_active_chat"); } catch (_) {}
  });

  // Keep the current chat visible while Firebase connects; never replace it with a blank/loading state.
  window.addEventListener("she:chat-open", (event) => {
    const id = event.detail?.uid;
    if (!id) return;
    const cached = read("messages", id);
    if (cached?.messages?.length) {
      const target = document.getElementById("messages");
      if (target && target.children.length === 0 && typeof window.renderMessages === "function") {
        window.renderMessages(cached.messages, { preserveScroll: true, fromCache: true });
      }
    }
  });
})();
