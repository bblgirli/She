import { firebaseConfig } from "./firebase-config.js";
import { getFirebaseRuntime } from "./firebase-runtime.js";

// ============================================
// GLOBAL STATE & CONSTANTS
// ============================================
const STORAGE_KEY = "she_app_state";
const CURRENT_USER_KEY = "she_current_user";

let auth = null;
let db = null;
let firebaseApp = null;
let firebaseInitialized = false;
let firebaseInitPromise = null;

// Firebase initialization is centralized in firebase-runtime.js.
// The rest of this module keeps the existing app state and feature logic.
async function initializeFirebase() {
    if (firebaseInitialized && auth && db) return true;
    if (firebaseInitPromise) return firebaseInitPromise;

    firebaseInitPromise = (async () => {
        try {
            console.log("🔥 Initializing Firebase runtime...");
            showDebug("🔥 Loading Firebase modules...");

            const runtime = await getFirebaseRuntime();
            if (!runtime) throw new Error("Firebase runtime unavailable");

            firebaseApp = runtime.firebaseApp;
            auth = runtime.auth;
            db = runtime.db;

            const { setPersistence, browserLocalPersistence } = runtime.authModule;
            await setPersistence(auth, browserLocalPersistence);

            firebaseInitialized = true;
            showDebug("✅ Firebase initialized");
            return true;
        } catch (error) {
            console.error("❌ Firebase error:", error);
            showDebug("❌ Firebase error: " + error.message);
            firebaseInitialized = false;
            return false;
        } finally {
            firebaseInitPromise = null;
        }
    })();

    return firebaseInitPromise;
}

// ============================================
// DEBUG & UI HELPERS
// ============================================
function showDebug(msg) {
    console.log(msg);
    const debugEl = document.getElementById("firebaseDebug");
    if (debugEl) {
        const line = document.createElement("div");
        line.textContent = msg;
        debugEl.appendChild(line);
        debugEl.scrollTop = debugEl.scrollHeight;
    }
}

function showError(message) {
    const statusElement = document.getElementById("pageStatus") || document.getElementById("loginStatus") || document.getElementById("signupStatus") || document.getElementById("forgotStatus") || document.getElementById("resetStatus");
    if (statusElement) { statusElement.textContent = message; statusElement.className = "status-message status-error"; return; }
    alert(message);
}

function showSuccess(message) {
    const statusElement = document.getElementById("pageStatus") || document.getElementById("loginStatus") || document.getElementById("signupStatus") || document.getElementById("forgotStatus") || document.getElementById("resetStatus");
    if (statusElement) { statusElement.textContent = message; statusElement.className = "status-message status-success"; return; }
    alert(message);
}

function showInfo(message) {
    const statusElement = document.getElementById("pageStatus") || document.getElementById("loginStatus") || document.getElementById("signupStatus") || document.getElementById("forgotStatus") || document.getElementById("resetStatus");
    if (statusElement) { statusElement.textContent = message; statusElement.className = "status-message status-info"; return; }
    alert(message);
}

function clearStatus() {
    ["pageStatus", "loginStatus", "signupStatus", "forgotStatus", "resetStatus"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ""; el.className = ""; }
    });
}

// NOTE: The original app.js is intentionally not replaced wholesale here.
// This bridge file is the next migration point for the existing feature modules.
export { initializeFirebase };
