/* Prevent duplicate sends when the network is slow/offline. One user action = one send attempt. */
(() => {
  "use strict";
  let sending = false;
  let lastSignature = "";
  let lastAt = 0;
  const button = () => document.getElementById("sendMessageButton");
  const input = () => document.getElementById("messageInput");
  const text = () => (input()?.innerText || "").replace(/\u00a0/g, " ").trim();
  const sig = () => `${localStorage.getItem("currentChatUid") || ""}|${text()}`;

  async function run(e) {
    const b = button();
    if (!b || b.disabled || b.dataset.sheSending === "1") {
      e?.preventDefault(); e?.stopImmediatePropagation(); return;
    }
    const value = text();
    if (!value) return;
    const signature = sig();
    // Protect against rapid repeated taps even after the first handler has returned.
    if (sending || (signature === lastSignature && Date.now() - lastAt < 5000)) {
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    sending = true;
    lastSignature = signature;
    lastAt = Date.now();
    b.dataset.sheSending = "1";
    b.disabled = true;
    b.setAttribute("aria-busy", "true");
    b.style.pointerEvents = "none";

    // Let the existing send implementation handle Firebase/offline behavior.
    // We intentionally keep the button locked until the message input changes/clears,
    // which prevents 2-3 taps from creating 2-3 Firestore documents on a slow connection.
    try {
      await Promise.resolve(window.sendMessage?.());
    } finally {
      const waitForClear = () => {
        const stillSame = text() === value;
        if (stillSame && Date.now() - lastAt < 15000) {
          setTimeout(waitForClear, 250);
          return;
        }
        sending = false;
        delete b.dataset.sheSending;
        b.disabled = false;
        b.removeAttribute("aria-busy");
        b.style.pointerEvents = "";
      };
      setTimeout(waitForClear, 250);
    }
  }

  document.addEventListener("click", e => {
    if (!e.target.closest?.("#sendMessageButton")) return;
    // Only install this guard; the existing application send handler remains the source of truth.
    if (sending || button()?.dataset.sheSending === "1") {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);

  // If the app's normal handler is available, wrap it once so every caller gets the same lock.
  const install = () => {
    if (window.__sheSendDedupeInstalled || typeof window.sendMessage !== "function") return;
    const original = window.sendMessage;
    window.sendMessage = async function (...args) {
      const b = button(), value = text(), signature = sig();
      if (!value || sending || b?.dataset.sheSending === "1") return false;
      if (signature === lastSignature && Date.now() - lastAt < 5000) return false;
      sending = true; lastSignature = signature; lastAt = Date.now();
      if (b) { b.dataset.sheSending="1"; b.disabled=true; b.setAttribute("aria-busy","true"); b.style.pointerEvents="none"; }
      try { return await original.apply(this,args); }
      finally {
        const unlock = () => {
          if (text() === value && Date.now()-lastAt < 15000) return setTimeout(unlock,250);
          sending=false; if(b){delete b.dataset.sheSending;b.disabled=false;b.removeAttribute("aria-busy");b.style.pointerEvents="";}
        }; setTimeout(unlock,250);
      }
    };
    window.__sheSendDedupeInstalled = true;
  };
  install();
  window.addEventListener("she:firebase-ready", install);
  setTimeout(install, 0);
  setTimeout(install, 1000);
})();
