import { firebaseConfig } from "./firebase-config.js";

// ============================================
// GLOBAL STATE & CONSTANTS
// ============================================
const STORAGE_KEY = "she_app_state";
const CURRENT_USER_KEY = "she_current_user";

let auth = null;
let db = null;
let firebaseApp = null;
let firebaseInitialized = false;

// ============================================
// FIREBASE INITIALIZATION
// ============================================
async function initializeFirebase() {
    if (firebaseInitialized) return;
    
    try {
        console.log("🔥 Initializing Firebase...");
        showDebug("🔥 Loading Firebase modules...");
        
        // Import Firebase modules
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
        const { getAuth, setPersistence, browserLocalPersistence } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        // Initialize Firebase
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        
        // Set persistence
        await setPersistence(auth, browserLocalPersistence);
        
        firebaseInitialized = true;
        showDebug("✅ Firebase initialized successfully");
        console.log("✅ Firebase ready");
        
        return true;
    } catch (error) {
        console.error("❌ Firebase initialization failed:", error);
        showDebug("❌ Firebase error: " + error.message);
        return false;
    }
}

// ============================================
// DEBUG PANEL
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

// ============================================
// UI HELPERS
// ============================================
function showError(message) {
    const statusElement = document.getElementById("pageStatus")
        || document.getElementById("loginStatus")
        || document.getElementById("signupStatus")
        || document.getElementById("forgotStatus")
        || document.getElementById("resetStatus");
    
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = "status-message status-error";
        return;
    }
    alert(message);
}

function showSuccess(message) {
    const statusElement = document.getElementById("pageStatus")
        || document.getElementById("loginStatus")
        || document.getElementById("signupStatus")
        || document.getElementById("forgotStatus")
        || document.getElementById("resetStatus");
    
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = "status-message status-success";
        return;
    }
    alert(message);
}

function clearStatus() {
    ["pageStatus", "loginStatus", "signupStatus", "forgotStatus", "resetStatus"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = "";
            el.className = "";
        }
    });
}

function toggleLoginPassword() {
    const input = document.getElementById("loginPassword");
    if (input) {
        input.type = input.type === "password" ? "text" : "password";
    }
}

function toggleSignupPassword() {
    const input = document.getElementById("signupPassword");
    if (input) {
        input.type = input.type === "password" ? "text" : "password";
    }
}

function toggleConfirmPassword() {
    const input = document.getElementById("signupConfirm");
    if (input) {
        input.type = input.type === "password" ? "text" : "password";
    }
}

// ============================================
// LOCAL STORAGE (Fallback for offline mode)
// ============================================
function saveUser(user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function getCurrentUser() {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
}

function clearUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
}

// ============================================
// AUTHENTICATION HANDLERS
// ============================================
async function handleLogin(event) {
    event.preventDefault();
    clearStatus();
    
    const email = document.getElementById("loginEmail")?.value?.trim() || "";
    const password = document.getElementById("loginPassword")?.value || "";
    
    if (!email || !password) {
        showError("Please enter email and password");
        return;
    }
    
    showError("Logging in...");
    showDebug("🔥 Attempting login for: " + email);
    
    if (!firebaseInitialized) {
        const success = await initializeFirebase();
        if (!success) {
            showError("Firebase connection failed. Check your internet.");
            return;
        }
    }
    
    try {
        const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        
        showDebug("🔥 Calling signInWithEmailAndPassword...");
        const result = await signInWithEmailAndPassword(auth, email, password);
        
        showDebug("✅ Login successful: " + result.user.uid);
        saveUser({
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName || ""
        });
        
        showSuccess("Login successful! Redirecting...");
        setTimeout(() => {
            window.location.href = "chats.html";
        }, 500);
        
    } catch (error) {
        showDebug("❌ Login failed: " + error.code + " - " + error.message);
        
        let message = error.message;
        if (error.code === "auth/user-not-found") {
            message = "No account found with this email";
        } else if (error.code === "auth/wrong-password") {
            message = "Wrong password";
        } else if (error.code === "auth/invalid-email") {
            message = "Invalid email";
        } else if (error.code === "auth/too-many-requests") {
            message = "Too many failed attempts. Try again later";
        }
        
        showError(message);
    }
}

async function handleSignup(event) {
    event.preventDefault();
    clearStatus();
    
    const email = document.getElementById("signupEmail")?.value?.trim() || "";
    const password = document.getElementById("signupPassword")?.value || "";
    const confirm = document.getElementById("signupConfirm")?.value || "";
    const displayName = document.getElementById("signupName")?.value?.trim() || "";
    
    if (!email || !password || !confirm || !displayName) {
        showError("Please fill in all fields");
        return;
    }
    
    if (password !== confirm) {
        showError("Passwords do not match");
        return;
    }
    
    if (password.length < 6) {
        showError("Password must be at least 6 characters");
        return;
    }
    
    showError("Creating account...");
    showDebug("🔥 Attempting signup for: " + email);
    
    if (!firebaseInitialized) {
        const success = await initializeFirebase();
        if (!success) {
            showError("Firebase connection failed. Check your internet.");
            return;
        }
    }
    
    try {
        const { createUserWithEmailAndPassword, updateProfile } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        
        showDebug("🔥 Calling createUserWithEmailAndPassword...");
        const result = await createUserWithEmailAndPassword(auth, email, password);
        
        showDebug("🔥 Updating display name...");
        await updateProfile(result.user, { displayName });
        
        showDebug("✅ Signup successful: " + result.user.uid);
        saveUser({
            uid: result.user.uid,
            email: result.user.email,
            displayName: displayName
        });
        
        showSuccess("Account created! Redirecting...");
        setTimeout(() => {
            window.location.href = "chats.html";
        }, 500);
        
    } catch (error) {
        showDebug("❌ Signup failed: " + error.code + " - " + error.message);
        
        let message = error.message;
        if (error.code === "auth/email-already-in-use") {
            message = "Email already in use";
        } else if (error.code === "auth/invalid-email") {
            message = "Invalid email";
        } else if (error.code === "auth/weak-password") {
            message = "Password too weak";
        }
        
        showError(message);
    }
}

async function handleGoogleLogin() {
    clearStatus();
    showError("Starting Google sign-in...");
    showDebug("🔥 Google login initiated");
    
    if (!firebaseInitialized) {
        const success = await initializeFirebase();
        if (!success) {
            showError("Firebase connection failed");
            return;
        }
    }
    
    try {
        const { GoogleAuthProvider, signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        
        showDebug("🔥 Creating Google provider...");
        const provider = new GoogleAuthProvider();
        
        showDebug("🔥 Calling signInWithPopup...");
        const result = await signInWithPopup(auth, provider);
        
        showDebug("✅ Google login successful: " + result.user.uid);
        saveUser({
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName || ""
        });
        
        showSuccess("Google login successful! Redirecting...");
        setTimeout(() => {
            window.location.href = "chats.html";
        }, 500);
        
    } catch (error) {
        showDebug("❌ Google login failed: " + error.code + " - " + error.message);
        
        let message = error.message;
        if (error.code === "auth/popup-closed-by-user") {
            message = "Sign-in popup closed";
        } else if (error.code === "auth/operation-not-allowed") {
            message = "Google sign-in not enabled";
        }
        
        showError(message);
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    clearStatus();
    
    const email = document.getElementById("forgotEmail")?.value?.trim() || "";
    if (!email) {
        showError("Please enter your email");
        return;
    }
    
    showError("Sending reset email...");
    showDebug("🔥 Password reset requested for: " + email);
    
    if (!firebaseInitialized) {
        const success = await initializeFirebase();
        if (!success) {
            showError("Firebase connection failed");
            return;
        }
    }
    
    try {
        const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        
        showDebug("🔥 Sending password reset email...");
        await sendPasswordResetEmail(auth, email);
        
        showDebug("✅ Password reset email sent");
        showSuccess("Check your email for password reset link");
        
    } catch (error) {
        showDebug("❌ Password reset failed: " + error.code);
        showError(error.message);
    }
}

async function handleResetPassword(event) {
    event.preventDefault();
    clearStatus();
    
    const password = document.getElementById("resetPassword")?.value || "";
    const confirm = document.getElementById("resetConfirm")?.value || "";
    
    if (!password || !confirm) {
        showError("Please enter password");
        return;
    }
    
    if (password !== confirm) {
        showError("Passwords do not match");
        return;
    }
    
    showError("Resetting password...");
    showDebug("🔥 Password reset in progress");
    
    if (!firebaseInitialized) {
        const success = await initializeFirebase();
        if (!success) {
            showError("Firebase connection failed");
            return;
        }
    }
    
    try {
        const { confirmPasswordReset } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        const params = new URLSearchParams(window.location.search);
        const code = params.get("oobCode");
        
        if (!code) {
            showError("Invalid password reset link");
            return;
        }
        
        showDebug("🔥 Confirming password reset...");
        await confirmPasswordReset(auth, code, password);
        
        showDebug("✅ Password reset successful");
        showSuccess("Password reset successful! Redirecting to login...");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 2000);
        
    } catch (error) {
        showDebug("❌ Password reset failed: " + error.code);
        showError(error.message);
    }
}

function logout() {
    if (auth) {
        auth.signOut();
    }
    clearUser();
    window.location.href = "login.html";
}

function redirectToChats() {
    window.location.href = "chats.html";
}

function goTo(page) {
    window.location.href = page;
}

// ============================================
// PAGE INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("📄 Page loaded");
    showDebug("App started");
    
    // Initialize Firebase
    await initializeFirebase();
    
    // Attach event listeners
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }
    
    const signupForm = document.getElementById("signupForm");
    if (signupForm) {
        signupForm.addEventListener("submit", handleSignup);
    }
    
    const forgotForm = document.getElementById("forgotPasswordForm");
    if (forgotForm) {
        forgotForm.addEventListener("submit", handleForgotPassword);
    }
    
    const resetForm = document.getElementById("resetPasswordForm");
    if (resetForm) {
        resetForm.addEventListener("submit", handleResetPassword);
    }
    
    const googleBtn = document.querySelector(".google-button");
    if (googleBtn) {
        googleBtn.addEventListener("click", handleGoogleLogin);
    }
    
    // Check if user is already logged in
    if (firebaseInitialized && auth?.currentUser) {
        showDebug("✅ User already logged in: " + auth.currentUser.email);
        saveUser({
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName || ""
        });
        
        // If on auth page, redirect to chats
        const currentPage = window.location.pathname.split("/").pop();
        if (["login.html", "signup.html", "forgot-password.html", "reset-password.html"].includes(currentPage)) {
            redirectToChats();
        }
    }
});

// ============================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleGoogleLogin = handleGoogleLogin;
window.handleForgotPassword = handleForgotPassword;
window.handleResetPassword = handleResetPassword;
window.logout = logout;
window.goTo = goTo;
window.toggleLoginPassword = toggleLoginPassword;
window.toggleSignupPassword = toggleSignupPassword;
window.toggleConfirmPassword = toggleConfirmPassword;
window.showDebug = showDebug;
