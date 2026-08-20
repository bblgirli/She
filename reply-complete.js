(() => {
  const INPUT_ID = 'messageInput';
  let unsub = null;
  let timer = null;
  let pending = null;

  const input = () => document.getElementById(INPUT_ID);
  const textOf = el => (el?.innerText || el?.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  function capturePending() {
    const i = input();
    if (!i) return;
    const targetId = i.dataset.replyTo || i.getAttribute('data-reply-to');
    const targetText = i.dataset.replyText || i.getAttribute('data-reply-text') || '';
    const text = textOf(i);
    if (!targetId || !text) return;
    pending = { targetId, targetText, text, chatUid: localStorage.getItem('currentChatUid'), at: Date.now() };
  }

  document.addEventListener('click', e => {
    if (e.target?.closest?.('#sendMessageButton')) capturePending();
  }, true);

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.id === INPUT_ID) capturePending();
  }, true);

  function conversationId(a, b) { return [a, b].sort().join('_'); }

  async function firebase() {
    try {
      const [cfg, app, authMod, fs] = await Promise.all([
        import('./firebase-config.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      ]);
      const apps = app.getApps();
      const fa = apps.length ? apps[0] : app.initializeApp(cfg.firebaseConfig);
      return { auth: authMod.getAuth(fa), db: fs.getFirestore(fa), fs };
    } catch (e) { console.warn('reply runtime firebase:', e); return null; }
  }

  function renderQuote(el, message) {
    if (!el || !message) return;
    const body = el.querySelector('.message-body');
    if (!body) return;
    const old = body.querySelector('.she-reply-quote');
    if (old) old.remove();
    const replyText = message.replyToText || message.replyText || '';
    if (!replyText) return;
    const quote = document.createElement('div');
    quote.className = 'she-reply-quote';
    quote.textContent = replyText;
    quote.title = 'Replied message';
    quote.style.cssText = 'display:block!important;margin:-2px 0 6px;padding:6px 9px;border-left:3px solid #078b59;border-radius:6px;background:rgba(0,0,0,.07);font-size:12px;line-height:1.25;opacity:.86;white-space:pre-wrap;overflow:hidden;max-height:48px;';
    body.prepend(quote);
  }

  function renderSnapshot(snapshot) {
    const bubbles = [...document.querySelectorAll('#messages .message')];
    snapshot.docs.forEach((snap, index) => {
      const el = bubbles[index];
      if (!el) return;
      el.dataset.messageId = snap.id;
      renderQuote(el, snap.data());
    });
  }

  async function start() {
    const x = await firebase();
    if (!x) return;
    const uid = x.auth.currentUser?.uid;
    const other = localStorage.getItem('currentChatUid');
    if (!uid || !other) { timer = setTimeout(start, 1000); return; }
    const cid = conversationId(uid, other);
    const ref = x.fs.collection(x.db, 'conversations', cid, 'messages');
    const q = x.fs.query(ref, x.fs.orderBy('createdAt', 'asc'));
    if (unsub) unsub();
    unsub = x.fs.onSnapshot(q, async snapshot => {
      renderSnapshot(snapshot);
      if (!pending || pending.chatUid !== other) return;
      const candidates = snapshot.docs.filter(s => {
        const d = s.data();
        if (s.id === pending.targetId || d.senderId !== uid || d.text !== pending.text) return false;
        const created = d.createdAt?.toMillis?.() || 0;
        return !created || created >= pending.at - 5000;
      });
      const newest = candidates[candidates.length - 1];
      if (!newest) return;
      try {
        await x.fs.updateDoc(x.fs.doc(x.db, 'conversations', cid, 'messages', newest.id), {
          replyToId: pending.targetId,
          replyToText: pending.targetText
        });
        pending = null;
        const i = input();
        if (i) {
          delete i.dataset.replyTo;
          delete i.dataset.replyText;
          i.removeAttribute('data-reply-to');
          i.removeAttribute('data-reply-text');
        }
      } catch (e) { console.warn('reply save:', e); }
    });
  }

  function boot() {
    clearTimeout(timer);
    start();
    const m = document.getElementById('messages');
    if (m) new MutationObserver(() => setTimeout(() => {
      if (window.__replyCompleteRefresh) window.__replyCompleteRefresh();
    }, 80)).observe(m, { childList: true, subtree: true });
  }

  window.__replyCompleteRefresh = async () => {
    const x = await firebase();
    const uid = x?.auth?.currentUser?.uid;
    const other = localStorage.getItem('currentChatUid');
    if (!x || !uid || !other) return;
    const cid = conversationId(uid, other);
    const q = x.fs.query(x.fs.collection(x.db, 'conversations', cid, 'messages'), x.fs.orderBy('createdAt', 'asc'));
    const snap = await x.fs.getDocs(q);
    renderSnapshot(snap);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
