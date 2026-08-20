(() => {
  let pendingReply = null;
  let db = null;
  let auth = null;
  let unsubscribe = null;
  const patchedIds = new Set();

  const escapeHtml = (value) => {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  };

  function rememberReply(event) {
    const d = event?.detail || {};
    if (!d.id) return;
    pendingReply = {
      id: d.id,
      text: d.text || '',
      startedAt: Date.now()
    };
  }

  window.addEventListener('sheReplyToMessage', rememberReply);

  async function getFirebase() {
    if (db && auth) return { db, auth };
    try {
      const appModule = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const authModule = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const apps = appModule.getApps();
      if (!apps.length) return null;
      const app = appModule.getApp();
      auth = authModule.getAuth(app);
      db = firestoreModule.getFirestore(app);
      return { db, auth };
    } catch (e) {
      return null;
    }
  }

  async function watchMessages() {
    const firebase = await getFirebase();
    if (!firebase || !auth.currentUser) {
      setTimeout(watchMessages, 700);
      return;
    }

    const chatUid = localStorage.getItem('currentChatUid');
    if (!chatUid) {
      setTimeout(watchMessages, 700);
      return;
    }

    const { collection, query, orderBy, onSnapshot, updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const conversationId = [auth.currentUser.uid, chatUid].sort().join('_');
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    if (unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(query(messagesRef, orderBy('createdAt', 'asc')), async (snapshot) => {
      const messageEls = Array.from(document.querySelectorAll('#messages > .message'));

      snapshot.docChanges().forEach(async (change) => {
        if (change.type !== 'added' || !pendingReply || patchedIds.has(change.doc.id)) return;
        const data = change.doc.data() || {};
        if (data.senderId !== auth.currentUser.uid) return;

        patchedIds.add(change.doc.id);
        try {
          await updateDoc(doc(db, 'conversations', conversationId, 'messages', change.doc.id), {
            replyToId: pendingReply.id,
            replyToText: pendingReply.text
          });
          pendingReply = null;
        } catch (e) {
          patchedIds.delete(change.doc.id);
          console.warn('Reply metadata update failed:', e);
        }
      });

      // Render ONLY the quoted message inside the reply message.
      // We never insert the original message again.
      snapshot.docs.forEach((messageDoc, index) => {
        const data = messageDoc.data() || {};
        const el = messageEls[index];
        if (!el || !data.replyToText) return;

        const body = el.querySelector('.message-body');
        if (!body) return;

        let quote = body.querySelector('.reply-quote-inline');
        if (!quote) {
          quote = document.createElement('div');
          quote.className = 'reply-quote-inline';
          quote.style.cssText = 'margin:0 0 6px;padding:6px 9px;border-left:3px solid currentColor;border-radius:6px;background:rgba(127,127,127,.12);font-size:.82em;opacity:.82;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          body.insertBefore(quote, body.firstChild);
        }
        quote.innerHTML = escapeHtml(data.replyToText);
      });
    });
  }

  function start() {
    setTimeout(watchMessages, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
