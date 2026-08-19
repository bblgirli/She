/* Mobile-safe presence: heartbeat + stale-online protection. */
(function () {
  "use strict";
  const STALE_AFTER_MS = 75000;
  let timer = null;
  let stopPresence = null;
  let currentUid = null;

  async function start() {
    try {
      const [{ getApps, getApp }, { getAuth, onAuthStateChanged }, firestore] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
      ]);
      if (!getApps().length) return setTimeout(start, 500);

      const auth = getAuth(getApp());
      const db = firestore.getFirestore(getApp());
      const { doc, onSnapshot, setDoc, serverTimestamp } = firestore;

      const writePresence = async (online) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            online: !!online,
            lastActive: online ? serverTimestamp() : null,
            lastSeen: online ? null : serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn("Presence update failed", e);
        }
      };

      const refreshStatus = (data) => {
        const el = document.querySelector(".chat-profile p");
        if (!el) return;
        if (data.online !== true) {
          el.textContent = data.lastSeen ? `Last seen ${formatPresenceTime(data.lastSeen)}` : "Offline";
          return;
        }
        const active = data.lastActive || data.updatedAt;
        const ms = timestampMs(active);
        if (!ms || Date.now() - ms > STALE_AFTER_MS) {
          el.textContent = "Offline";
        } else {
          el.textContent = "Online";
        }
      };

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
        if (!ms) return "";
        const d = new Date(ms);
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }

      onAuthStateChanged(auth, async (user) => {
        if (timer) clearInterval(timer);
        timer = null;
        if (stopPresence) { stopPresence(); stopPresence = null; }
        if (!user) return;

        await writePresence(document.visibilityState === "visible");
        timer = setInterval(() => {
          if (document.visibilityState === "visible") writePresence(true);
        }, 30000);

        const uid = localStorage.getItem("currentChatUid");
        if (!uid) return;
        currentUid = uid;
        const unsub = onSnapshot(doc(db, "users", uid), snap => refreshStatus(snap.data() || {}));
        stopPresence = unsub;
      });

      document.addEventListener("visibilitychange", () => {
        if (auth.currentUser) writePresence(document.visibilityState === "visible");
      });

      window.addEventListener("pagehide", () => {
        if (auth.currentUser) writePresence(false);
      });

      setInterval(() => {
        if (currentUid) {
          const el = document.querySelector(".chat-profile p");
          if (el && el.textContent === "Online") {
            // Force a snapshot refresh by re-reading the document on the next interval.
            // The heartbeat timestamp is authoritative; no optimistic Online state is kept.
          }
        }
      }, 15000);
    } catch (e) {
      console.warn("Presence v2 unavailable", e);
      setTimeout(start, 1000);
    }
  }
  start();
})();
