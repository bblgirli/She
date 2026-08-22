import { getFirebaseRuntime } from "../firebase-runtime.js";
import { setFirebaseRuntime } from "./app-state.js";

let initialization = null;

export function initializeFirebase() {
  if (initialization) return initialization;

  initialization = getFirebaseRuntime().then(runtime => {
    if (!runtime) throw new Error("Firebase runtime unavailable");
    setFirebaseRuntime(runtime);
    return runtime;
  }).catch(error => {
    initialization = null;
    throw error;
  });

  return initialization;
}

export async function getFirebase() {
  return initializeFirebase();
}
