/* Presence + typing feature boundary. */

export function createPresenceFeature({ getAuth, getDb }) {
  let stopPresence = null;
  let stopTyping = null;

  async function setOnline(online) {
    if (typeof window.setCurrentUserPresence === "function") {
      return window.setCurrentUserPresence(online);
    }
    return false;
  }

  async function setTyping(isTyping, chatUid) {
    if (typeof window.setTypingStatus === "function") {
      return window.setTypingStatus(isTyping, chatUid);
    }
    return false;
  }

  function stopTyping() {
    if (typeof window.stopTypingStatus === "function") return window.stopTypingStatus();
    stopTyping?.();
  }

  function dispose() {
    stopPresence?.();
    stopTyping?.();
    stopPresence = null;
    stopTyping = null;
  }

  return { setOnline, setTyping, stopTyping, dispose, getAuth, getDb };
}
