(() => {
  let pendingReply = null;
  let db = null;
  let auth = null;
  let renderTimer = null;

  const escapeHtml = (value) => {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  };

  function rememberReply(event) {
    const d = event?.detail || {};
    if (!d.id) return;
    pendingReply = { id: String(d.id), text: d.text || '' };
    const input = document.getElementById('messageInput');
    if (input) {
      input.dataset.replyTo = String(d.id);
      input.dataset.replyText = d.text || '';
    }
  }

  window.addEventListener('sheReplyToMessage', rememberReply);

  async function getFirebase() {
    if (db && auth) return { db, auth };
    try {
      const [appModule, authModule, fs] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      ]);
      if (!appModule.getApps().length) return null;
      const app = appModule.getApp();
      auth = authModule.getAuth(app);
      db = fs.getFirestore(app);
      return { db, auth, fs };
    } catch (e) {
      console.warn('Reply Firebase bridge failed:', e);
      return null;
    }
  }

  function readReplyTarget(input) {
    if (!input) return pendingReply;
    const id = input.dataset.replyTo || input.getAttribute('data-reply-to');
    if (!id) return null;
    return {
      id: String(id),
      text: input.dataset.replyText || input.getAttribute('data-reply-text') || ''
    };
  }

  // Replace the old send path only for this chat page. This writes the reply
  // metadata on the message at creation time, so there is no race afterward.
  async function sendMessageWithReply() {
    const input = document.getElementById('messageInput');
    const text = (input?.value || '').trim();
    if (!text) return;

    const chatUid = localStorage.getItem('currentChatUid');
    const firebase = await getFirebase();
    if (!chatUid || !firebase?.auth?.currentUser) {
      if (typeof window.showError === 'function') window.showError('Not in a chat');
      return;
    }

    const { collection, addDoc, doc, setDoc, serverTimestamp } = firebase.fs;
    const uid = firebase.auth.currentUser.uid;
    const conversationId = [uid, chatUid].sort().join('_');
    const reply = readReplyTarget(input);

    const message = {
      senderId: uid,
      receiverId: chatUid,
      text,
      createdAt: serverTimestamp(),
      status: 'sent'
    };

    if (reply?.id) {
      message.replyToId = reply.id;
      message.replyToText = reply.text || '';
    }

    try {
      await addDoc(collection(firebase.db, 'conversations', conversationId, 'messages'), message);
      await setDoc(doc(firebase.db, 'conversations', conversationId), {
        participants: [uid, chatUid],
        lastMessage: text,
        lastMessageSenderId: uid,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadBy: [chatUid]
      }, { merge: true });

      input.textContent = '';
      delete input.dataset.replyTo;
      delete input.dataset.replyText;
      input.removeAttribute('data-reply-to');
      input.removeAttribute('data-reply-text');
      input.placeholder = 'Type a message';
      pendingReply = null;
      window.updateMessageActions?.();
      input.focus();
    } catch (e) {
      console.error('Error sending message with reply:', e);
      if (typeof window.showError === 'function') window.showError('Failed to send message');
    }
  }

  // chat.html's send button calls sendMessage() inline. Expose the corrected
  // implementation without changing the message-bar markup or CSS.
  window.sendMessage = sendMessageWithReply;

  function renderReplies() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(async () => {
      const firebase = await getFirebase();
      const chatUid = localStorage.getItem('currentChatUid');
      if (!firebase?.auth?.currentUser || !chatUid) return;

      try {
        const { collection, query, orderBy, getDocs } = firebase.fs;
        const conversationId = [firebase.auth.currentUser.uid, chatUid].sort().join('_');
        const ref = collection(firebase.db, 'conversations', conversationId, 'messages');
        const snapshot = await getDocs(query(ref, orderBy('createdAt', 'asc')));
        const elements = [...document.querySelectorAll('#messages > .message')];

        snapshot.docs.forEach((messageDoc, index) => {
          const data = messageDoc.data() || {};
          if (!data.replyToText) return;

          let el = elements.find(node =>
            (node.dataset.messageId || node.getAttribute('data-message-id')) === messageDoc.id
          );
          if (!el) el = elements[index];
          if (!el) return;

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
        }
        });
    }, 80);
  }

  // App.js redraws the message list from Firestore. Re-apply the small quote
  // after each redraw, without inserting any extra message bubbles.
  new MutationObserver(renderReplies).observe(document.getElementById('messages') || document.body, {
    childList: true,
    subtree: true
  });

  document.addEventListener('keydown', (event) => {
    if (event.target?.id === 'messageInput' && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      sendMessageWithReply();
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderReplies, { once: true });
  } else {
    renderReplies();
  }
})();
