/* She read/delivery receipts.
 * Marks incoming messages delivered as soon as this signed-in client sees them,
 * and read when the conversation is open. This keeps the sender's ticks tied to
 * the actual message status instead of notification UI state.
 */
(() => {
  "use strict";

  let stop = null;
  let running = false;

  async function boot() {
    if (running) return;
    running = true;
    try {
      const runtime = await import("./firebase-runtime.js").then(m => m.getFirebaseRuntime());
      const auth = runtime.auth;
      const db = runtime.db;
      const F = runtime.firestoreModule;
      const me = auth.currentUser;
      const other = localStorage.getItem("currentChatUid") || new URLSearchParams(location.search).get("chat");
      if (!me?.uid || !other || me.uid === other) return;

      const conversationId = [me.uid, other].sort().join("_");
      const messagesRef = F.collection(db, "conversations", conversationId, "messages");

      const unsubscribe = F.onSnapshot(messagesRef, async (snapshot) => {
        const updates = snapshot.docChanges().filter(change => change.type !== "removed");
        for (const change of updates) {
          const data = change.doc.data() || {};
          if (data.senderId !== me.uid && data.status !== "read") {
            try {
              await F.updateDoc(change.doc.ref, { status: "read", readAt: F.serverTimestamp() });
            } catch (error) {
              console.warn("[She receipts] Could not mark message read", error);
            }
          }
        }

        try {
          const conversationRef = F.doc(db, "conversations", conversationId);
          const conversation = await F.getDoc(conversationRef);
          if (conversation.exists()) {
            const unreadBy = Array.isArray(conversation.data().unreadBy)
              ? conversation.data().unreadBy.filter(uid => uid !== me.uid)
              : [];
            await F.updateDoc(conversationRef, { unreadBy });
          }
        } catch (error) {
          console.warn("[She receipts] Could not clear conversation unread state", error);
        }
      });

      stop = unsubscribe;
    } catch (error) {
      console.warn("[She receipts] Startup failed", error);
    } finally {
      running = false;
    }
  }

  window.SheReadReceipts = {
    start: boot,
    stop: () => { if (stop) stop(); stop = null; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
