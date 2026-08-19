/* She foundation boot: cache-first UI without replacing Firebase/app logic. */
(() => {
  'use strict';
  if (window.__SHE_FOUNDATION_BOOT__) return;
  window.__SHE_FOUNDATION_BOOT__ = true;

  const path = (location.pathname.split('/').pop() || '').toLowerCase();
  const USER_KEY = 'she_current_user';
  const CHAT_LIST_PREFIX = 'she_chats_dom_v2_';
  const CHAT_MESSAGES_PREFIX = 'she_chat_dom_v2_';
  const readUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } };

  function restoreChats() {
    const userId = readUser()?.uid;
    const root = document.getElementById('chatList');
    if (!root || !userId || root.children.length) return;
    try {
      const html = localStorage.getItem(CHAT_LIST_PREFIX + userId);
      if (html) { root.innerHTML = html; root.dataset.foundationRestored = '1'; }
    } catch {}
  }

  function restoreChat() {
    const chatId = new URLSearchParams(location.search).get('chat') || localStorage.getItem('currentChatUid');
    const root = document.getElementById('messages');
    if (!root || !chatId || root.children.length) return;
    try {
      const cached = JSON.parse(localStorage.getItem(CHAT_MESSAGES_PREFIX + chatId) || 'null');
      if (cached?.html) { root.innerHTML = cached.html; root.dataset.foundationRestored = '1'; }
    } catch {}
  }

  function boot() {
    if (path === 'chats.html') restoreChats();
    if (path === 'chat.html') restoreChat();
    document.documentElement.classList.add('she-foundation-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
