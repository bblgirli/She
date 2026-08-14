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

// Contacts and chats
let userContacts = [];
let chats = [];
let currentChatUid = null;
let chatListUnsubscribe = null;
let messagesUnsubscribe = null;

// ============================================
// FIREBASE INITIALIZATION
// ============================================
async function initializeFirebase() {
    if (firebaseInitialized) return;
    
    try {
        console.log("🔥 Initializing Firebase...");
        showDebug("🔥 Loading Firebase modules...");
        
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
        const { getAuth, setPersistence, browserLocalPersistence } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        
        await setPersistence(auth, browserLocalPersistence);
        
        firebaseInitialized = true;
        showDebug("✅ Firebase initialized");
        
        return true;
    } catch (error) {
        console.error("❌ Firebase error:", error);
        showDebug("❌ Firebase error: " + error.message);
        return false;
    }
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
    if (input) input.type = input.type === "password" ? "text" : "password";
}

function toggleSignupPassword() {
    const input = document.getElementById("signupPassword");
    if (input) input.type = input.type === "password" ? "text" : "password";
}

function toggleConfirmPassword() {
    const input = document.getElementById("signupConfirm");
    if (input) input.type = input.type === "password" ? "text" : "password";
}

// ============================================
// LOCAL STORAGE
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
// AUTHENTICATION
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
    
    if (!firebaseInitialized) {
        const success = await initializeFirebase();
        if (!success) {
            showError("Firebase connection failed");
            return;
        }
    }
    
    try {
        const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        
        const result = await signInWithEmailAndPassword(auth, email, password);
        
        saveUser({
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName || ""
        });
        
        showSuccess("Redirecting...");
        setTimeout(() => window.location.href = "chats.html", 500);
        
    } catch (error) {
        let message = error.message;
        if (error.code === "auth/user-not-found") message = "No account found";
        else if (error.code === "auth/wrong-password") message = "Wrong password";
        
        showError(message);
    }
}

async function handleSignup(event) {
    event.preventDefault();
    clearStatus();
    
    const email = document.getElementById("signupEmail")?.value?.trim() || document.getElementById("email")?.value?.trim() || "";
    const password = document.getElementById("signupPassword")?.value || document.getElementById("password")?.value || "";
    const confirm = document.getElementById("signupConfirm")?.value || document.getElementById("confirmPassword")?.value || "";
    const displayName = document.getElementById("signupName")?.value?.trim() || document.getElementById("name")?.value?.trim() || "";
    const countryCode = document.getElementById("countryCode")?.value || "+234";
    const phone = document.getElementById("phone")?.value?.trim() || "";
    
    if (!email || !password || !confirm || !displayName) {
        showError("Please fill in all fields");
        return;
    }
    
    if (password !== confirm) {
        showError("Passwords don't match");
        return;
    }
    
    if (password.length < 6) {
        showError("Password must be 6+ characters");
        return;
    }
    
    showError("Creating account...");
    
    if (!firebaseInitialized) {
        const success = await initializeFirebase();
        if (!success) {
            showError("Firebase connection failed");
            return;
        }
    }
    
    try {
        const { createUserWithEmailAndPassword, updateProfile } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        
        // Full phone with country code
        const fullPhone = phone ? countryCode + phone : "";
        
        // Save user to Firestore with phone
        const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        await setDoc(doc(db, "users", result.user.uid), {
            uid: result.user.uid,
            email: result.user.email,
            displayName: displayName,
            phone: fullPhone,
            createdAt: new Date()
        });
        
        saveUser({
            uid: result.user.uid,
            email: result.user.email,
            displayName: displayName
        });
        
        showSuccess("Redirecting...");
        setTimeout(() => window.location.href = "chats.html", 500);
        
    } catch (error) {
        let message = error.message;
        if (error.code === "auth/email-already-in-use") message = "Email already in use";
        
        showError(message);
    }
}

async function handleGoogleLogin() {
    clearStatus();
    showError("Starting Google sign-in...");
    
    if (!firebaseInitialized) {
        const success = await initializeFirebase();
        if (!success) {
            showError("Firebase connection failed");
            return;
        }
    }
    
    try {
        const { GoogleAuthProvider, signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        
        // Save to Firestore
        const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        await setDoc(doc(db, "users", result.user.uid), {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName || "",
            phone: "", // Google doesn't provide phone
            createdAt: new Date()
        }, { merge: true });
        
        saveUser({
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName || ""
        });
        
        showSuccess("Redirecting...");
        setTimeout(() => window.location.href = "chats.html", 500);
        
    } catch (error) {
        let message = error.message;
        if (error.code === "auth/popup-closed-by-user") message = "Popup closed";
        
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
    
    if (!firebaseInitialized) {
        const success = await initializeFirebase();
        if (!success) {
            showError("Firebase connection failed");
            return;
        }
    }
    
    try {
        const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        
        await sendPasswordResetEmail(auth, email);
        showSuccess("Check your email for password reset link");
        
    } catch (error) {
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
        showError("Passwords don't match");
        return;
    }
    
    showError("Resetting password...");
    
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
            showError("Invalid reset link");
            return;
        }
        
        await confirmPasswordReset(auth, code, password);
        showSuccess("Password reset! Redirecting to login...");
        setTimeout(() => window.location.href = "login.html", 2000);
        
    } catch (error) {
        showError(error.message);
    }
}

function logout() {
    if (auth) auth.signOut();
    clearUser();
    if (chatListUnsubscribe) chatListUnsubscribe();
    if (messagesUnsubscribe) messagesUnsubscribe();
    window.location.href = "login.html";
}

// ============================================
// CONTACTS & CHATS
// ============================================
async function loadChats() {
    if (!firebaseInitialized || !auth?.currentUser) return;
    
    try {
        const { collection, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        if (chatListUnsubscribe) chatListUnsubscribe();
        
        const q = query(
            collection(db, "conversations"),
            where("participants", "array-contains", auth.currentUser.uid)
        );
        
        chatListUnsubscribe = onSnapshot(q, (snapshot) => {
            chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderChatList();
        });
    } catch (error) {
        console.error("Error loading chats:", error);
    }
}

async function renderChatList() {
    const container = document.getElementById("chatList") || document.querySelector(".chat-list");
    if (!container) return;
    
    if (!chats || chats.length === 0) {
        container.innerHTML = '<div class="message received"><p>No chats yet. Start a new chat!</p></div>';
        return;
    }
    
    let html = "";
    for (const chat of chats) {
        const otherUid = chat.participants.find(uid => uid !== auth.currentUser.uid);
        const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        const userSnap = await getDocs(query(collection(db, "users"), where("uid", "==", otherUid)));
        const otherUser = userSnap.docs[0]?.data() || { displayName: "Unknown" };
        
        html += `
            <div class="chat-item" onclick="openChat('${otherUid}')">
                <div class="chat-info">
                    <h3>${otherUser.displayName || "User"}</h3>
                    <p>${chat.lastMessage || "No messages yet"}</p>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

async function searchContactsInput(event) {
    const searchTerm = event.target.value?.trim() || "";
    const resultsContainer = document.getElementById("newChatResults");
    
    if (!searchTerm) {
        resultsContainer.innerHTML = '<div class="message received"><p>Search by username or phone number</p></div>';
        return;
    }
    
    if (!firebaseInitialized || !auth?.currentUser) return;
    
    try {
        resultsContainer.innerHTML = '<div class="message received"><p>Searching...</p></div>';
        
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        // Get all users
        const snapshot = await getDocs(collection(db, "users"));
        const allUsers = snapshot.docs.map(doc => doc.data());
        
        // Filter by phone or username (displayName)
        const results = allUsers.filter(user => 
            user.uid !== auth.currentUser.uid && (
                (user.phone && user.phone.includes(searchTerm)) ||
                (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
            )
        );
        
        renderSearchResults(results);
        
    } catch (error) {
        console.error("Search error:", error);
        resultsContainer.innerHTML = '<div class="message received"><p>Search failed</p></div>';
    }
}

function renderSearchResults(users) {
    const container = document.getElementById("newChatResults");
    if (!container) return;
    
    if (!users || users.length === 0) {
        container.innerHTML = '<div class="message received"><p>No users found</p></div>';
        return;
    }
    
    let html = "";
    for (const user of users) {
        const phoneDisplay = user.phone ? ` • ${user.phone}` : "";
        html += `
            <div class="contact-item" onclick="startChatWithUser('${user.uid}', '${user.displayName || 'User'}')">
                <div class="contact-avatar">👤</div>
                <div class="contact-info">
                    <h3>${user.displayName || "Unknown"}</h3>
                    <p>${user.email}${phoneDisplay}</p>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function searchContacts() {
    // Focus on search input when search button is clicked
    const searchInput = document.getElementById("newChatSearch");
    if (searchInput) {
        searchInput.focus();
    }
}

async function startChatWithUser(uid, displayName) {
    if (!firebaseInitialized || !auth?.currentUser) return;
    
    try {
        const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        // Create conversation ID
        const conversationId = [auth.currentUser.uid, uid].sort().join("_");
        
        // Create/update conversation in Firestore
        await setDoc(doc(db, "conversations", conversationId), {
            participants: [auth.currentUser.uid, uid],
            lastMessage: "",
            updatedAt: new Date()
        }, { merge: true });
        
        // Save uid to localStorage for chat.html to use
        localStorage.setItem("currentChatUid", uid);
        localStorage.setItem("currentChatName", displayName);
        
        // Open chat.html
        window.location.href = "chat.html";
        
    } catch (error) {
        console.error("Error starting chat:", error);
        showError("Failed to start chat");
    }
}

async function openChat(uid) {
    currentChatUid = uid;
    localStorage.setItem("currentChatUid", uid);
    window.location.href = "chat.html";
}

function newChat() {
    window.location.href = "new-chat.html";
}

function goBack() {
    window.history.back();
}

function openMenu() {
    alert("Menu: Settings, Profile, Logout");
    if (confirm("Logout?")) {
        logout();
    }
}

function goTo(page) {
    window.location.href = page;
}

// ============================================
// PAGE INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("📄 Page loaded");
    
    await initializeFirebase();
    
    // Attach auth form listeners
    document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
    document.getElementById("signupForm")?.addEventListener("submit", handleSignup);
    document.getElementById("forgotPasswordForm")?.addEventListener("submit", handleForgotPassword);
    document.getElementById("resetPasswordForm")?.addEventListener("submit", handleResetPassword);
    document.querySelector(".google-button")?.addEventListener("click", handleGoogleLogin);
    
    // Check if logged in
    if (firebaseInitialized && auth?.currentUser) {
        const currentPage = window.location.pathname.split("/").pop();
        
        if (["login.html", "signup.html", "forgot-password.html", "reset-password.html"].includes(currentPage)) {
            window.location.href = "chats.html";
            return;
        }
        
        // Load chats if on chats page
        if (currentPage === "chats.html") {
            loadChats();
        }
        
        // Initialize search on new-chat page (don't load all users)
        if (currentPage === "new-chat.html") {
            const searchInput = document.getElementById("newChatSearch");
            if (searchInput) {
                searchInput.addEventListener("input", searchContactsInput);
            }
            // Show initial message
            const resultsContainer = document.getElementById("newChatResults");
            if (resultsContainer) {
                resultsContainer.innerHTML = '<div class="message received"><p>Search by username or phone number</p></div>';
            }
        }
    } else if (!firebaseInitialized) {
        const currentPage = window.location.pathname.split("/").pop();
        if (!["login.html", "signup.html", "forgot-password.html", "reset-password.html"].includes(currentPage)) {
            window.location.href = "login.html";
        }
    }
});

// ============================================
// EXPOSE TO WINDOW
// ============================================
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleGoogleLogin = handleGoogleLogin;
window.handleForgotPassword = handleForgotPassword;
window.handleResetPassword = handleResetPassword;
window.logout = logout;
window.goTo = goTo;
window.goBack = goBack;
window.openMenu = openMenu;
window.newChat = newChat;
window.openChat = openChat;
window.startChatWithUser = startChatWithUser;
window.searchContactsInput = searchContactsInput;
window.searchContacts = searchContacts;
window.toggleLoginPassword = toggleLoginPassword;
window.toggleSignupPassword = toggleSignupPassword;
window.toggleConfirmPassword = toggleConfirmPassword;
window.showDebug = showDebug;
