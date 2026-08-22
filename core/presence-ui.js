/* Presence UI: never trusts an old online flag forever. */
(function () {
  "use strict";
  let unsubscribe = null;
  let interval = null;
  let lastData = null;

  function stamp(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (value.seconds) return value.seconds * 1000;
    const n = new Date(value).getTime();
    return Number.isFinite(n) ? n : 0;
  }

  function render() {
    const el = document.querySelector(".chat-profile p");
    if (!el || !lastData) return;
    const active = stamp(lastData.lastActiveAt);
    const fresh = active && (Date.now() - active < 75000);
    if (lastData.online === true && fresh) {
      el.textContent = "Online";
      return;
    }
    if (lastData.lastSeen) {
      const d = new Date(stamp(lastData.lastSeen));
      el.textContent = `Last seen ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    } else {
      el.textContent = "Offline";
    }
  }

  function attach() {
    const runtime = window.SheFirebase;
    const uid = localStorage.getItem("currentChatUid");
    if (!runtime?.db || !runtime?.firestore || !uid) return false;
    if (unsubscribe) unsubscribe();
    unsubscribe = runtime.firestore.onSnapshot(
      runtime.firestore.doc(runtime.db, "users", uid),
      snap => { lastData = snap.data() || {}; render(); },
      () => { lastData = null; render(); }
    );
    if (interval) clearInterval(interval);
    interval = setInterval(render, 15000);
    return true;
  }

  function retry() {
    if (window.location.pathname.endsWith("chat.html")) attach();
  }
  if (!attach()) window.addEventListener("she:firebase-ready", retry, { once: true });
  window.addEventListener("storage", e => { if (e.key === "currentChatUid") retry(); });
  window.addEventListener("pagehide", () => { if (unsubscribe) unsubscribe(); if (interval) clearInterval(interval); });
})();
