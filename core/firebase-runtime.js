// Shared Firebase runtime boundary.
// Smart-Bank-style migration: cache Firebase module/app loading once per page.
import { firebaseConfig } from "../firebase-config.js";

const VERSION = "10.12.2";
let appPromise;
let authPromise;
let firestorePromise;

async function loadApp() {
    if (!appPromise) {
        appPromise = import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`)
            .then(({ getApps, getApp, initializeApp }) => {
                const apps = getApps();
                return apps.length ? getApp() : initializeApp(firebaseConfig);
            });
    }
    return appPromise;
}

export async function getFirebaseApp() {
    return loadApp();
}

export async function getFirebaseAuth() {
    if (!authPromise) {
        authPromise = Promise.all([
            loadApp(),
            import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-auth.js`)
        ]).then(([app, { getAuth }]) => getAuth(app));
    }
    return authPromise;
}

export async function getFirestoreDb() {
    if (!firestorePromise) {
        firestorePromise = Promise.all([
            loadApp(),
            import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-firestore.js`)
        ]).then(([app, { getFirestore }]) => getFirestore(app));
    }
    return firestorePromise;
}

export const FIREBASE_VERSION = VERSION;
