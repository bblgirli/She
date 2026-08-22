/* She feature bootstrap — active shared service layer. */
import { createCallsFeature } from "./features/calls.js";
import { createAuthFeature } from "./features/auth.js";
import { createChatsFeature } from "./features/chats.js";
import { createPresenceFeature } from "./features/presence.js";
import { getFirebaseRuntime } from "./firebase-runtime.js";

const STORAGE_USER = "she_current_user";
const STORAGE_CHAT = "currentChatUid";

function currentChatUid() {
  return localStorage.getItem(STORAGE_CHAT) || null;
}

function authUser() {
  return window.SheFirebase?.auth || null;
}

const servicesPromise = getFirebaseRuntime().then(runtime => {
  const auth = () => runtime.auth;
  const db = () => runtime.db;

  const services = {
    auth: createAuthFeature({
      getAuth: auth,
      saveUser(value) {
        if (value) localStorage.setItem(STORAGE_USER, JSON.stringify(value));
      },
      clearUser() {
        localStorage.removeItem(STORAGE_USER);
      }
    }),
    chats: createChatsFeature({
      getAuth: auth,
      getDb: db,
      getCurrentChatUid: currentChatUid
    }),
    calls: createCallsFeature({
      getAuth: auth,
      getDb: db,
      getCurrentChatUid: currentChatUid
    }),
    presence: createPresenceFeature({
      getAuth: auth,
      getDb: db
    })
  };

  // Publish one stable service surface. Existing legacy functions remain
  // available for compatibility, while new code can depend on SheFeatures.
  window.SheFeatures = Object.freeze(services);
  window.SheServices?.register?.("auth", services.auth);
  window.SheServices?.register?.("chats", services.chats);
  window.SheServices?.register?.("calls", services.calls);
  window.SheServices?.register?.("presence", services.presence);

  return services;
}).catch(error => {
  console.warn("She feature bootstrap failed:", error);
  return null;
});

window.SheFeatureBootstrap = { ready: servicesPromise, currentChatUid, authUser };
export { servicesPromise };
