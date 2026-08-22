/* Calls/WebRTC feature boundary. The legacy implementation remains the compatibility owner until the final cutover. */

export function createCallsFeature({ getAuth, getDb, getCurrentChatUid, ui = {} }) {
  let peerConnection = null;
  let callStream = null;
  let state = "idle";

  const getRuntime = () => ({ auth: getAuth?.(), db: getDb?.() });

  async function start() {
    const { auth, db } = getRuntime();
    if (!auth?.currentUser || !db) return false;
    const uid = getCurrentChatUid?.();
    if (!uid) return false;

    // The existing app owns the production WebRTC signaling path for now.
    // This feature boundary intentionally delegates during migration.
    if (typeof window.initiateCall === "function") {
      await window.initiateCall();
      return true;
    }
    return false;
  }

  async function answer() {
    if (typeof window.answerCall === "function") {
      await window.answerCall();
      return true;
    }
    return false;
  }

  async function decline() {
    if (typeof window.declineCall === "function") {
      await window.declineCall();
      return true;
    }
    return false;
  }

  async function end() {
    if (typeof window.endCall === "function") {
      await window.endCall();
      return true;
    }
    return false;
  }

  function dispose() {
    if (peerConnection) peerConnection.close();
    peerConnection = null;
    callStream?.getTracks?.().forEach(track => track.stop());
    callStream = null;
    state = "idle";
  }

  return { start, answer, decline, end, dispose, get state() { return state; } };
}
