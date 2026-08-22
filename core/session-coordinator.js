/* She session coordinator: makes account changes a hard boundary. */
(function () {
  "use strict";
  let activeUid = null;
  let generation = 0;

  function clearAccountScopedState() {
    ["currentChatUid", "currentChatName", "callSessionId"].forEach(k => localStorage.removeItem(k));
    try { sessionStorage.removeItem("she_active_chat"); } catch (_) {}
  }

  function attach() {
    const session = window.SheAuthSession;
    if (!session || typeof session.subscribe !== "function") return false;
    session.subscribe(user => {
      const uid = user?.uid || null;
      if (uid !== activeUid) {
        generation += 1;
        if (activeUid && activeUid !== uid) clearAccountScopedState();
        activeUid = uid;
        window.SheAccountGeneration = generation;
      }
    });
    return true;
  }

  if (!attach()) window.addEventListener("she:firebase-ready", attach, { once: true });
})();
