(() => {
  const KEY = "she_last_page_snapshot";
  const isAppPage = () => /^(chat|chats|app)\.html$/i.test(location.pathname.split("/").pop() || "");
  if (!isAppPage()) return;

  const style = document.createElement("style");
  style.textContent = `#sheSyncStatus{position:fixed;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:2147483646;padding:5px 11px;border-radius:999px;background:rgba(20,20,20,.78);color:#fff;font:500 11px/1.2 system-ui,-apple-system,sans-serif;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .2s ease}#sheSyncStatus.show{opacity:1}#sheSyncStatus.offline{background:rgba(120,45,25,.88)}#sheSyncStatus.online{background:rgba(20,110,75,.88)}`;
  document.head.appendChild(style);

  const pill = document.createElement("div");
  pill.id = "sheSyncStatus";
  pill.setAttribute("aria-live", "polite");
  pill.textContent = "Syncing…";
  document.documentElement.appendChild(pill);

  let hideTimer;
  const show = (text, cls = "") => {
    clearTimeout(hideTimer);
    pill.textContent = text;
    pill.className = `show ${cls}`.trim();
  };
  const hide = () => {
    hideTimer = setTimeout(() => pill.className = "", 900);
  };

  window.addEventListener("online", () => { show("Back online · syncing", "online"); setTimeout(hide, 1600); });
  window.addEventListener("offline", () => show("Offline · keeping your data", "offline"));

  if (!navigator.onLine) show("Offline · keeping your data", "offline");
  else show("Syncing…");

  // Never replace the current UI with a loading/default screen just for sync.
  window.addEventListener("load", () => {
    if (navigator.onLine) { show("Synced", "online"); hide(); }
  });

  // Save a lightweight page marker so reloads don't intentionally blank the app.
  try { sessionStorage.setItem(KEY, location.pathname); } catch (_) {}
})();
