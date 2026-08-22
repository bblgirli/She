/* Transitional feature bootstrap. It gives the app one place to construct feature services. */
import { createCallsFeature } from "./features/calls.js";
import { createAuthFeature } from "./features/auth.js";
import { createChatsFeature } from "./features/chats.js";
import { createPresenceFeature } from "./features/presence.js";
import { getFirebaseRuntime } from "./firebase-runtime.js";

const servicesPromise = getFirebaseRuntime().then(runtime => {
  const currentChat = () => localStorage.getItem("currentChatUid");
  const user = () => runtime.auth;

  const services = {
    auth: createAuthFeature({
      getAuth: user,
      saveUser: (value) => localStorage.setItem("she_current_user", JSON.stringify(value)),
      clearUser: () => localStorage.removeItem("she_current_user")
    }),
    chats: createChatsFeature({
      getAuth: user,
      getDb: () => runtime.db,
      getCurrentChatUid: currentChat
    }),
    calls: createCallsFeature({
      getAuth: user,
      getDb: () => runtime.db,
      getCurrentChatUid: currentChat
    }),
    presence: createPresenceFeature({
      getAuth: user,
      getDb: () => runtime.db
    })
  };

  window.SheFeatures = services;
  return services;
}).catch(error => {
  console.warn("She feature bootstrap failed:", error);
  return null;
});

window.SheFeatureBootstrap = { ready: servicesPromise };
export { servicesPromise };
