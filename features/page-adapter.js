/* Active page adapter: prefer the new feature services without breaking legacy globals. */
(function () {
  "use strict";
  function ready(fn) {
    const p = window.SheFeatureBootstrap?.ready;
    if (p && typeof p.then === "function") return p.then(fn).catch(() => fn(null));
    return Promise.resolve(fn(null));
  }
  window.ShePageAdapter = Object.freeze({
    ready,
    async sendMessage(...args) {
      const service = window.SheFeatures?.chats;
      if (service?.sendMessage) return service.sendMessage(...args);
      return window.sendMessage?.(...args);
    },
    async loadChats(...args) {
      const service = window.SheFeatures?.chats;
      if (service?.loadChats) return service.loadChats(...args);
      return window.loadChats?.(...args);
    },
    async loadMessages(...args) {
      const service = window.SheFeatures?.chats;
      if (service?.loadMessages) return service.loadMessages(...args);
      return window.loadMessages?.(...args);
    },
    getCurrentUser() {
      const auth = window.SheFeatures?.auth;
      return auth?.currentUser?.() || window.SheFirebase?.auth?.currentUser || null;
    }
  });
})();
