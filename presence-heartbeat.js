/* Reliable mobile presence heartbeat. Keeps the signed-in user's active status current. */
(function () {
  "use strict";
  let timer = null;
  let started = false;

  async function start() {
    if (started) return;
    try {
      const [{ getApp, getApps }, { getAuth, onAuthStateChanged }, { getFirestore, doc, setDoc, serverTimestamp }] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
      ]);

      if (!getApps().length) {
        setTimeout(start, 500);
        return;
      }

      const app = getApp();
      const auth = getAuth(app);
      const db = getFirestore(app);
      started = true;

      const writePresence = async (online) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            online,
            lastSeen: online ? null : serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          console.warn("Presence heartbeat failed:", error);
        }
      };

      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          if (timer) clearInterval(timer);
          timer = null;
          return;
        }

        await writePresence(document.visibilityState === "visible");
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
          if (document.visibilityState === "visible") writePresence(true);
        }, 30000);
      });

      document.addEventListener("visibilitychange", () => {
        if (auth.currentUser) writePresence(document.visibilityState === "visible");
      });
    } catch (error) {
      console.warn("Presence heartbeat unavailable:", error);
      setTimeout(start, 1000);
    }
  }

  start();
})();
