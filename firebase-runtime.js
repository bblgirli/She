/* Shared Firebase runtime. One initialization path for the whole app. */
import { getSheFirebase } from "./firebase-singleton.js";

export function getFirebaseRuntime() {
  return getSheFirebase();
}

export function preloadFirebaseRuntime() {
  return getSheFirebase().catch(error => {
    console.warn("She Firebase preload failed:", error);
    return null;
  });
}

if (typeof window !== "undefined") {
  window.SheFirebaseRuntime = { getFirebaseRuntime, preloadFirebaseRuntime };
  preloadFirebaseRuntime();
}
