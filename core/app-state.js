// Shared application state for She.
// Feature modules should use this store instead of declaring their own copies.

const state = {
  auth: null,
  db: null,
  firebaseApp: null,
  firebaseInitialized: false,
  currentUser: null,
  currentChatUid: null,
  chats: [],
  contacts: [],
  subscriptions: {
    chatList: null,
    messages: null,
    presence: null,
    typing: null,
    calls: null
  },
  notifications: {
    shownIds: new Set()
  },
  voice: {
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    locked: false,
    startTime: null,
    timer: null,
    audioContext: null,
    analyser: null,
    dataArray: null,
    animationId: null
  },
  call: {
    peerConnection: null,
    state: null,
    stream: null,
    incomingData: null,
    uid: null,
    startTime: null,
    durationTimer: null,
    historyListener: null
  }
};

export function getState() {
  return state;
}

export function setCurrentUser(user) {
  state.currentUser = user || null;
}

export function setFirebaseRuntime(runtime) {
  if (!runtime) return;
  state.firebaseApp = runtime.firebaseApp;
  state.auth = runtime.auth;
  state.db = runtime.db;
  state.firebaseInitialized = true;
}

export function resetRuntimeState() {
  state.auth = null;
  state.db = null;
  state.firebaseApp = null;
  state.firebaseInitialized = false;
  state.currentUser = null;
  state.currentChatUid = null;
  state.chats = [];
  state.contacts = [];
}

if (typeof window !== "undefined") {
  window.SheAppState = state;
}
