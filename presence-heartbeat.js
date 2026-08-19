/* Reliable mobile presence heartbeat. Keeps active status current without erasing last-seen. */
(function () {
  "use strict";
  let timer = null;
  let started = false;

  async function start() {
    if (started) return;
    try {
      const [{ getApp, getApps }, { getAuth, onAuthStateChanged }, firestore] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
      ]);
      if (!getApps().length) { setTimeout(start, 500); return; }
      const app = getApp();
      const auth = getAuth(app);
      const db = firestore.getFirestore(app);
      const { doc, setDoc, serverTimestamp } = firestore;
      started = true;

      async function writePresence(online) {
        const user = auth.currentUser;
        if (!user) return;
        try {
          const payload = { uid: user.uid, online: !!online, updatedAt: serverTimestamp() };
          if (online) payload.lastActive = serverTimestamp();
          else { payload.lastSeen = serverTimestamp(); payload.lastActive = null; }
          await setDoc(doc(db, "users", user.uid), payload, { merge: true });
        } catch (error) { console.warn("Presence heartbeat failed:", error); }
      }

      onAuthStateChanged(auth, async user => {
        if (timer) clearInterval(timer);
        timer = null;
        if (!user) return;
        await writePresence(document.visibilityState === "visible");
        timer = setInterval(() => {
          if (document.visibilityState === "visible") writePresence(true);
        }, 30000);
      });

      document.addEventListener("visibilitychange", () => {
        if (auth.currentUser) writePresence(document.visibilityState === "visible");
      });
      window.addEventListener("pagehide", () => {
        if (auth.currentUser) writePresence(false);
      });
    } catch (error) {
      console.warn("Presence heartbeat unavailable:", error);
      setTimeout(start, 1000);
    }
  }
  start();
})();
