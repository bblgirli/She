/* Mobile-safe presence: heartbeat + stale-online protection + persistent last-seen. */
(function () {
  "use strict";
  const STALE_AFTER_MS = 75000;
  let timer = null;
  let currentData = null;

  function timestampMs(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
    if (value.seconds) return value.seconds * 1000;
    const n = new Date(value).getTime();
    return Number.isFinite(n) ? n : 0;
  }

  function formatPresenceTime(value) {
    const ms = timestampMs(value);
    if (!ms) return "Offline";
    return `Last seen ${new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  function refreshStatus(data) {
    currentData = data || {};
    const el = document.querySelector(".chat-profile p");
    if (!el) return;
    const active = timestampMs(currentData.lastActive || currentData.updatedAt);
    if (currentData.online === true && active && Date.now() - active <= STALE_AFTER_MS) {
      el.textContent = "Online";
    } else {
      el.textContent = formatPresenceTime(currentData.lastSeen);
    }
  }

  async function start() {
    try {
      const [{ getApps, getApp }, authMod, firestore] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
      ]);
      if (!getApps().length) return setTimeout(start, 500);

      const auth = authMod.getAuth(getApp());
      const db = firestore.getFirestore(getApp());
      const { doc, onSnapshot, setDoc, serverTimestamp } = firestore;

      async function writePresence(online) {
        const user = auth.currentUser;
        if (!user) return;
        try {
          const payload = {
            uid: user.uid,
            online: !!online,
            updatedAt: serverTimestamp()
          };
          if (online) {
            // Never clear lastSeen when coming online. It must remain the previous offline time.
            payload.lastActive = serverTimestamp();
          } else {
            payload.lastSeen = serverTimestamp();
            payload.lastActive = null;
          }
          await setDoc(doc(db, "users", user.uid), payload, { merge: true });
        } catch (e) {
          console.warn("Presence update failed", e);
        }
      }

      authMod.onAuthStateChanged(auth, async user => {
        if (timer) clearInterval(timer);
        timer = null;
        currentData = null;
        if (!user) return;

        await writePresence(document.visibilityState === "visible");
        timer = setInterval(() => {
          if (document.visibilityState === "visible") writePresence(true);
        }, 30000);

        const uid = localStorage.getItem("currentChatUid");
        if (uid) {
          onSnapshot(doc(db, "users", uid), snap => refreshStatus(snap.data() || {}));
        }
      });

      // Re-render stale status even when Firestore has not emitted a new snapshot.
      setInterval(() => {
        if (currentData) refreshStatus(currentData);
      }, 15000);

      document.addEventListener("visibilitychange", () => {
        if (auth.currentUser) writePresence(document.visibilityState === "visible");
      });

      window.addEventListener("pagehide", () => {
        if (auth.currentUser) writePresence(false);
      });
    } catch (e) {
      console.warn("Presence v2 unavailable", e);
      setTimeout(start, 1000);
    }
  }
  start();
})();
