/* Presence + typing feature boundary. */

export function createPresenceFeature({ getAuth, getDb }) {
  let stopPresenceSubscription = null;
  let stopTypingSubscription = null;

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
    if (typeof window.stopTypingStatus === "function") {
      return window.stopTypingStatus();
    }
    if (typeof stopTypingSubscription === "function") {
      stopTypingSubscription();
      stopTypingSubscription = null;
    }
  }

  function dispose() {
    if (typeof stopPresenceSubscription === "function") stopPresenceSubscription();
    if (typeof stopTypingSubscription === "function") stopTypingSubscription();
    stopPresenceSubscription = null;
    stopTypingSubscription = null;
  }

  return { setOnline, setTyping, stopTyping, dispose, getAuth, getDb };
}
