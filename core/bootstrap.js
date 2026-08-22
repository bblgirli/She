/* She architecture bootstrap.
 * Loads the shared Firebase runtime once and exposes the same runtime shape to
 * the new core/data/session modules before the legacy feature runtime starts.
 */
import { getFirebaseRuntime } from "../firebase-runtime.js";
import { initializeFirebase as initializeCoreFirebase } from "./firebase.js";
import "./auth-session.js";
import "./data-store.js";

const ready = getFirebaseRuntime().then((runtime) => {
  window.SheFirebase = {
    firebaseApp: runtime.firebaseApp,
    auth: runtime.auth,
    db: runtime.db,
    firestore: runtime.firestoreModule,
    appModule: runtime.appModule,
    authModule: runtime.authModule
  };
  window.dispatchEvent(new Event("she:firebase-ready"));
  return initializeCoreFirebase().catch(() => runtime);
}).catch((error) => {
  console.warn("She shared architecture bootstrap failed; legacy runtime may continue:", error);
  return null;
});

window.SheArchitecture = { ready };
export { ready };
