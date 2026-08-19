/* Presence v3: preserve last-seen history and make mobile presence deterministic. */
(function () {
  "use strict";
  const STALE_AFTER_MS = 75000;
  let heartbeat = null;

  const tsMs = value => {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
    if (typeof value.seconds === "number") return value.seconds * 1000;
    const n = new Date(value).getTime();
    return Number.isFinite(n) ? n : 0;
  };

  const lastSeenText = value => {
    const ms = tsMs(value);
    return ms ? `Last seen ${new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Offline";
  };

  async function start() {
    try {
      const [{ getApps, getApp }, authMod, fs] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
      ]);
      if (!getApps().length) return setTimeout(start, 500);
      const auth = authMod.getAuth(getApp());
      const db = fs.getFirestore(getApp());
      const { doc, getDoc, setDoc, serverTimestamp, onSnapshot } = fs;

      async function markOnline() {
        const user = auth.currentUser;
        if (!user || document.visibilityState !== "visible") return;
        // IMPORTANT: never clear lastSeen while going online.
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          online: true,
          lastActive: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      async function markOffline() {
        const user = auth.currentUser;
        if (!user) return;
        // Keep the exact previous lastSeen history until this write replaces it.
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          online: false,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      function render(data) {
        const el = document.querySelector(".chat-profile p");
        if (!el) return;
        const active = tsMs(data.lastActive || data.updatedAt);
        if (data.online === true && active && Date.now() - active <= STALE_AFTER_MS) {
          el.textContent = "Online";
        } else {
          el.textContent = lastSeenText(data.lastSeen);
        }
      }

      authMod.onAuthStateChanged(auth, async user => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        if (!user) return;
        await markOnline();
        heartbeat = setInterval(markOnline, 30000);

        const chatUid = localStorage.getItem("currentChatUid");
        if (chatUid) {
          onSnapshot(doc(db, "users", chatUid), snap => render(snap.exists() ? snap.data() : {}));
        }
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") markOnline();
        else markOffline();
      });
      window.addEventListener("pagehide", markOffline);
    } catch (e) {
      console.warn("Presence v3 unavailable", e);
      setTimeout(start, 1000);
    }
  }
  start();
})();
