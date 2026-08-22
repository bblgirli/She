/* Chats/messages feature boundary. Centralizes chat-page operations during migration. */

export function createChatsFeature({ getAuth, getDb, getCurrentChatUid, cache = {} }) {
  const runtime = () => ({ auth: getAuth?.(), db: getDb?.() });

  async function loadChats() {
    if (typeof window.loadChats === "function") return window.loadChats();
    return null;
  }

  async function loadMessages() {
    if (typeof window.loadMessages === "function") return window.loadMessages();
    return null;
  }

  async function sendMessage() {
    if (typeof window.sendMessage === "function") return window.sendMessage();
    return false;
  }

  async function openChat(uid) {
    if (typeof window.openChat === "function") return window.openChat(uid);
    return false;
  }

  async function startChat(uid, name) {
    if (typeof window.startChatWithUser === "function") return window.startChatWithUser(uid, name);
    return false;
  }

  function dispose() {
    cache.clear?.();
  }

  return { runtime, loadChats, loadMessages, sendMessage, openChat, startChat, dispose, getCurrentChatUid };
}
