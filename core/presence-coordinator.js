/* She presence coordinator: heartbeat + browser connectivity boundary. */
(function () {
  "use strict";
  let timer = null;
  let uid = null;
  let db = null;
  let fs = null;
  let writing = false;

  async function writePresence(online) {
    if (!uid || !db || !fs || writing) return;
    writing = true;
    try {
      const ref = fs.doc(db, "users", uid);
      await fs.setDoc(ref, {
        uid,
        online: !!online,
        lastActiveAt: fs.serverTimestamp(),
        ...(online ? {} : { lastSeen: fs.serverTimestamp() })
      }, { merge: true });
    } catch (e) {
      console.warn("[She presence] update failed", e);
    } finally {
      writing = false;
    }
  }

  function start(user, runtime) {
    const nextUid = user?.uid || null;
    if (nextUid === uid && timer) return;
    if (timer) clearInterval(timer);
    timer = null;
    uid = nextUid;
    db = runtime?.db || null;
    fs = runtime?.firestore || null;
    if (!uid || !db || !fs) return;

    const sync = () => writePresence(navigator.onLine !== false);
    sync();
    timer = setInterval(sync, 30000);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (uid) writePresence(false);
    uid = null;
  }

  window.addEventListener("online", () => writePresence(true));
  window.addEventListener("offline", () => writePresence(false));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") writePresence(navigator.onLine !== false);
  });
  window.addEventListener("pagehide", () => writePresence(false));

  function attach() {
    const session = window.SheAuthSession;
    const runtime = window.SheFirebase;
    if (!session || !runtime) return false;
    session.subscribe(user => user ? start(user, runtime) : stop());
    return true;
  }

  if (!attach()) window.addEventListener("she:firebase-ready", attach, { once: true });
})();
