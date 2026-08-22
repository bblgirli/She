/* She Firebase runtime: preload Firebase SDK modules once and share them across the app. */
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

let runtimePromise = null;

export function getFirebaseRuntime() {
  if (runtimePromise) return runtimePromise;

  runtimePromise = Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`)
  ]).then(([appModule, authModule, firestoreModule]) => {
    const apps = appModule.getApps();
    const firebaseApp = apps.length ? apps[0] : appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(firebaseApp);
    const db = firestoreModule.getFirestore(firebaseApp);

    return {
      firebaseApp,
      auth,
      db,
      appModule,
      authModule,
      firestoreModule
    };
  }).catch(error => {
    runtimePromise = null;
    throw error;
  });

  return runtimePromise;
}

export function preloadFirebaseRuntime() {
  return getFirebaseRuntime().catch(error => {
    console.warn("She Firebase preload failed:", error);
    return null;
  });
}

if (typeof window !== "undefined") {
  window.SheFirebaseRuntime = { getFirebaseRuntime, preloadFirebaseRuntime };
  preloadFirebaseRuntime();
}
