// Shared Firebase runtime boundary.
// Smart-Bank-style migration: one cached module loader and one Firebase app
// instance per page. Existing feature code can migrate to this boundary
// incrementally without changing the current UI or Firestore schema.
import { firebaseConfig } from "../firebase-config.js";

const VERSION = "10.12.2";
let appPromise = null;
let authPromise = null;
let firestorePromise = null;

async function loadApp() {
    if (!appPromise) {
        appPromise = import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`)
            .then(async ({ getApps, getApp, initializeApp }) => {
                const apps = getApps();
                return apps.length ? getApp() : initializeApp(firebaseConfig);
            });
    }
    return appPromise;
}

export async function getFirebaseAuth() {
    if (!authPromise) {
        authPromise = Promise.all([
            loadApp(),
            import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-auth.js`)
        ]).then(([app, authModule]) => authModule.getAuth(app));
    }
    return authPromise;
}

export async function getFirestoreDb() {
    if (!firestorePromise) {
        firestorePromise = Promise.all([
            loadApp(),
            import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-firestore.js`)
        ]).then(([app, firestoreModule]) => firestoreModule.getFirestore(app));
    }
    return firestorePromise;
}

export async function getFirebaseApp() {
    return loadApp();
}

export const FIREBASE_VERSION = VERSION;
