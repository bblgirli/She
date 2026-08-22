// Single Firebase runtime adapter for the She app.
// Keeps one Firebase initialization path while preserving the existing config.
import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

let promise;

export function getSheFirebase() {
  if (promise) return promise;
  promise = Promise.resolve().then(() => {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return { app, auth: getAuth(app), db: getFirestore(app) };
  }).catch(error => {
    promise = null;
    console.error("She Firebase initialization failed:", error);
    throw error;
  });
  return promise;
}

if (typeof window !== "undefined") {
  window.SheFirebaseReady = getSheFirebase;
}
