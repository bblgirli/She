import { firebaseConfig } from "./firebase-config.js";

// Log immediately when script loads
console.log("app.js loaded at", new Date().toISOString());

// Set an absolute hard stop - after 10 seconds, give up on Firebase and let user continue
const FIREBASE_TIMEOUT = 10000;
const startTime = Date.now();

setTimeout(() => {
    console.warn("HARD STOP: Firebase took >10 seconds, forcing page forward");
    window.firebaseInitCompleted = true;
    if (!window.firebaseError) {
        window.firebaseError = "Firebase timeout";
    }
    // Force status update
    const el = document.getElementById("firebaseStatus");
    if (el) {
        el.textContent = "⚠️ Firebase load timeout - local mode";
    }
}, FIREBASE_TIMEOUT);

const STORAGE_KEY = "she_app_state";
const CURRENT_USER_KEY = "she_current_user";

function isFirebaseConfigured() {
    const apiKey = firebaseConfig?.apiKey || "";
    const projectId = firebaseConfig?.projectId || "";
    const hasPlaceholders = /YOUR_|example|changeme/i.test(apiKey) || /YOUR_|example|changeme/i.test(projectId);
    return Boolean(apiKey && projectId && !hasPlaceholders);
}

let configured = isFirebaseConfigured();
let firebaseApp = null;
let auth = null;
let db = null;
let firebaseAuthModule = null;
let firebaseFirestoreModule = null;
let chatListUnsubscribe = null;
let contactsUnsubscribe = null;
let messagesUnsubscribe = null;
let contactsCache = [];
let currentContactsSearch = "";
let authStateResolved = false;
let authStatePromiseResolve = null;
let firebaseError = null;
let firebaseInitCompleted = false;  // Track if init finished (success or failure)

async function initializeFirebaseCore() {
    if (!configured || auth || db) return;

    try {
        console.log("Starting Firebase initialization...");
        console.log("Importing Firebase modules from CDN...");

        // Wrap module imports with 8-second timeout
        const moduleImportPromise = Promise.all([
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
        ]);

        const moduleImportTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Firebase module import timeout (8s)")), 8000);
        });

        const [appModule, authModule, firestoreModule] = await Promise.race([
            moduleImportPromise,
            moduleImportTimeout
        ]);

        console.log("Firebase modules imported successfully");
        firebaseAuthModule = authModule;
        firebaseFirestoreModule = firestoreModule;

        console.log("Initializing Firebase app...");
        firebaseApp = appModule.initializeApp(firebaseConfig);
        auth = authModule.getAuth(firebaseApp);

        console.log("Setting persistence...");
        await Promise.race([
            firebaseAuthModule.setPersistence(auth, firebaseAuthModule.browserLocalPersistence),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Persistence timeout")), 3000))
        ]);
        console.log("Persistence set");

        db = firestoreModule.getFirestore(firebaseApp);
        console.log("Firebase initialized successfully");

        firebaseAuthModule.onAuthStateChanged(auth, (user) => {
            console.log("Auth state changed:", user ? `User ${user.uid}` : "No user");
            handleFirebaseAuthState(user);
            if (!authStateResolved) {
                authStateResolved = true;
                if (authStatePromiseResolve) {
                    authStatePromiseResolve();
                    authStatePromiseResolve = null;
                }
            }
        });

        console.log("Getting redirect result...");
        const redirectResult = await Promise.race([
            firebaseAuthModule.getRedirectResult(auth),
            new Promise((resolve) => setTimeout(() => resolve(null), 2000))
        ]);

        if (redirectResult?.user) {
            console.log("Redirect result found:", redirectResult.user.uid);
            const signedInUser = getFirebaseUserData(redirectResult.user);
            setCurrentUser(signedInUser);
            saveUserProfile(redirectResult.user, {
                displayName: redirectResult.user.displayName || "",
                phone: redirectResult.user.phoneNumber || "",
                photoURL: redirectResult.user.photoURL || ""
            }).catch(() => {});
            loadUserProfile(redirectResult.user).catch(() => {});
            if (isAuthPage()) {
                redirectToChats();
            }
        }
    } catch (error) {
        const errorMsg = error?.message || error?.toString() || "Unknown error";
        firebaseError = errorMsg;
        console.error("Firebase initialization error:", error);
        console.error("Error message:", errorMsg);
        console.warn("Firebase unavailable; falling back to local mode.", error);
        configured = false;
    }
}

async function initializeFirebase() {
    console.log(">>> initializeFirebase() STARTING");
    try {
        console.log("Firebase initialization started");
        // Set a 10-second maximum timeout for Firebase init
        await Promise.race([
            initializeFirebaseCore(),
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error("Firebase initialization timeout after 10 seconds"));
                }, 10000);
            })
        ]);
        console.log("Firebase initialization completed");
        if (firebaseError) {
            console.error("Firebase Error Summary:", firebaseError);
        }
    } catch (error) {
        const errorMsg = error?.message || error?.toString() || "Unknown error";
        firebaseError = errorMsg;
        console.error(">>> CATCH Firebase initialization error:", error);
        console.error("Error message:", errorMsg);
    } finally {
        firebaseInitCompleted = true;
        console.log(">>> FINALLY: Firebase init flow complete. auth=" + !!auth + " module=" + !!firebaseAuthModule + " error=" + firebaseError);
        // Force immediate status update
        try {
            const statusEl = document.getElementById("firebaseStatus");
            if (statusEl) {\n                if (!auth || !firebaseAuthModule) {\n                    statusEl.textContent = "⚠️ Firebase unavailable - using local mode";\n                } else {\n                    statusEl.textContent = "✅ Firebase is ready";\n                }\n            }
            if (typeof updateFirebaseStatus === 'function') {\n                updateFirebaseStatus();\n            }
        } catch (e) {
            console.error(">>> Error updating status:", e);
        }
    }
}

function readState() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify({ accounts: [], messages: {} }));
    } catch (error) {
        return { accounts: [], messages: {} };
    }
}

function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureAccountSeed() {
    const state = readState();
    if (!state.accounts.length) {
        state.accounts.push({
            id: "seed-local",
            email: "demo@example.com",
            password: "demo123",
            displayName: "Demo User",
            phone: "+2348000000000",
            about: "Available"
        });
        writeState(state);
    }
}

function currentUserFromStorage() {
    try {
        return JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "null");
    } catch (error) {
        return null;
    }
}

function getCurrentUser() {
    const storedUser = currentUserFromStorage();
    if (configured && auth) {
        return auth.currentUser ? (storedUser || getFirebaseUserData(auth.currentUser)) : null;
    }
    return storedUser;
}

function setCurrentUser(user) {
    if (!user) {
        localStorage.removeItem(CURRENT_USER_KEY);
        return;
    }
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function clearCurrentUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
}

async function loadUserProfile(user) {
    if (!configured || !db || !firebaseFirestoreModule || !user) return null;
    try {
        const userDoc = firebaseFirestoreModule.doc(db, "users", user.uid);
        const snapshot = await firebaseFirestoreModule.getDoc(userDoc);
        if (snapshot.exists()) {
            const profileData = snapshot.data();
            const mergedUser = {
                id: user.uid,
                uid: user.uid,
                email: user.email || "",
                displayName: profileData.name || profileData.displayName || user.displayName || "",
                phone: profileData.phone || user.phoneNumber || "",
                about: profileData.about || "Available",
                username: profileData.username || (user.email ? user.email.split("@")[0] : ""),
                photoURL: profileData.photoUrl || profileData.photoURL || profileData.profilePicture || user.photoURL || "",
                online: profileData.online ?? false,
                createdAt: profileData.createdAt || null,
                lastSeen: profileData.lastSeen || null,
                userId: user.uid
            };
            setCurrentUser(mergedUser);
            return mergedUser;
        }
    } catch (error) {
        console.warn("Unable to load user profile from Firestore.", error);
    }
    return null;
}

function getFirebaseUserData(user) {
    if (!user) return null;
    return {
        id: user.uid,
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        phone: user.phoneNumber || "",
        about: "Available",
        username: user.email ? user.email.split("@")[0] : "",
        photoURL: user.photoURL || "",
        userId: user.uid
    };
}

async function syncUserFirestoreProfile(user) {
    if (!configured || !db || !auth || !firebaseFirestoreModule || !user) return;
    try {
        await saveUserProfile(user, {
            displayName: user.displayName || "",
            phone: user.phoneNumber || "",
            about: "Available",
            online: true,
            lastSeen: firebaseFirestoreModule.serverTimestamp()
        });
        await loadUserProfile(user);
    } catch (error) {
        console.warn("Unable to sync user Firestore profile.", error);
    }
}

function redirectToChats() {
    const target = new URL("chats.html", window.location.href);
    window.location.replace(target.toString());
}

function redirectToLogin() {
    const target = new URL("login.html", window.location.href);
    window.location.replace(target.toString());
}

function handleFirebaseAuthState(user) {
    if (user) {
        const authUser = getFirebaseUserData(user);
        setCurrentUser(authUser);
        syncUserFirestoreProfile(user).catch(() => {});

        if (isAuthPage()) {
            redirectToChats();
        }
    } else {
        clearCurrentUser();
        if (!isAuthPage()) {
            redirectToLogin();
        }
    }
}

function isAuthPage() {
    const path = window.location.pathname.split("/").pop() || "";
    return ["login.html", "signup.html", "forgot-password.html", "reset-password.html"].includes(path);
}

function requireAuth() {
    const user = getCurrentUser();
    if (!user && !isAuthPage()) {
        redirectToLogin();
        return false;
    }
    return true;
}

function waitForAuthState() {
    if (!configured || authStateResolved) {
        console.log("Auth state already resolved or Firebase not configured");
        return Promise.resolve();
    }
    console.log("Waiting for auth state...");
    return Promise.race([
        new Promise((resolve) => {
            authStatePromiseResolve = resolve;
        }),
        new Promise((resolve) => {
            setTimeout(() => {
                console.log("Auth state timeout after 1 second");
                resolve();
            }, 1000);  // Reduced from 3000ms to 1000ms
        })
    ]);
}

function forgotPassword() {
    window.location.href = "forgot-password.html";
}

async function handleForgotPasswordForm(event) {
    event.preventDefault();
    if (!configured || !auth || !firebaseAuthModule) {
        showError("Firebase forgot-password is unavailable.");
        return;
    }
    const email = document.getElementById("forgotEmail")?.value.trim().toLowerCase();
    clearStatus();
    if (!email) {
        showError("Please enter your email address.");
        return;
    }
    try {
        const actionCodeSettings = {
            url: `${window.location.origin}/reset-password.html`,
            handleCodeInApp: true
        };
        await firebaseAuthModule.sendPasswordResetEmail(auth, email, actionCodeSettings);
        const status = document.getElementById("forgotStatus");
        if (status) {
            status.textContent = "A password reset email has been sent. Follow the link in your inbox to finish resetting your password.";
        }
    } catch (error) {
        showError(error);
    }
}

function initializeVerifyEmailPage() {
    return;
}

async function handleResetPasswordForm(event) {
    event.preventDefault();
    if (!configured || !auth || !firebaseAuthModule) {
        showError("Firebase reset-password is unavailable.");
        return;
    }
    const code = new URLSearchParams(window.location.search).get("oobCode");
    const password = document.getElementById("newPassword")?.value;
    const confirmPassword = document.getElementById("confirmPassword")?.value;
    clearStatus();
    if (!code) {
        showError("Invalid or missing password reset code.");
        return;
    }
    if (!password || !confirmPassword) {
        showError("Please enter and confirm your new password.");
        return;
    }
    if (password !== confirmPassword) {
        showError("Passwords do not match.");
        return;
    }
    try {
        await firebaseAuthModule.confirmPasswordReset(auth, code, password);
        window.location.href = "login.html";
    } catch (error) {
        showError(error);
    }
}

function showError(error) {
    const message = error?.message || error || "Something went wrong.";
    const statusElement = document.getElementById("pageStatus")
        || document.getElementById("loginStatus")
        || document.getElementById("signupStatus")
        || document.getElementById("forgotStatus")
        || document.getElementById("resetStatus");
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.classList.add("status-error");
        statusElement.classList.remove("status-success");
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
        statusElement.classList.remove("status-error");
        statusElement.classList.add("status-success");
        return;
    }
    alert(message);
}

function clearStatus() {
    ["pageStatus", "loginStatus", "signupStatus", "forgotStatus", "resetStatus"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = "";
            el.classList.remove("status-error", "status-success");
        }
    });
}

function isFirebaseReady() {
    return configured && auth && firebaseAuthModule;
}

function updateFirebaseStatus() {
    const statusElement = document.getElementById("firebaseStatus");
    const errorElement = document.getElementById("firebaseError");
    const googleButton = document.querySelector(".google-button");
    
    if (!statusElement) {
        console.log("updateFirebaseStatus: statusElement not found (page may not be ready)");
        return;
    }

    // Display error if one exists
    if (firebaseError && errorElement) {
        errorElement.style.display = "block";
        errorElement.innerHTML = `<strong>⚠️ Firebase Error:</strong> ${escapeHTML(firebaseError)}`;
        console.log("Error box shown:", firebaseError);
    } else if (errorElement) {
        errorElement.style.display = "none";
    }

    if (!configured) {
        statusElement.textContent = "⚠️ Using local mode (Firebase unavailable)";
        if (googleButton) googleButton.disabled = false;
        console.log("Status: Firebase not configured");
        return;
    }

    // If initialization is complete but auth/authModule not ready, show error state
    if (firebaseInitCompleted && (!auth || !firebaseAuthModule)) {
        statusElement.textContent = "⚠️ Firebase loaded but auth unavailable";
        if (googleButton) googleButton.disabled = false;  // Still allow local login
        console.log("Status: Init complete but auth not available");
        return;
    }

    if (!auth || !firebaseAuthModule) {
        statusElement.textContent = "⏳ Firebase is loading...";
        if (googleButton) googleButton.disabled = true;
        // console.log("Status: Still loading...");
        return;
    }

    statusElement.textContent = "✅ Firebase is ready. Sign in to continue.";
    if (googleButton) googleButton.disabled = false;
    console.log("Status: Firebase ready");
}

function normalizePhone(value = "") {
    const raw = `${value}`.trim();
    if (!raw) return "";
    const normalized = raw.replace(/[^\d+]/g, "");
    if (!normalized) return "";
    return normalized.startsWith("+") ? normalized : `+${normalized.replace(/^\+/, "")}`;
}

async function resolveLoginEmailFromPhone(phone) {
    if (!configured || !db || !auth || !firebaseFirestoreModule) return null;
    try {
        const usersRef = firebaseFirestoreModule.collection(db, "users");
        const q = firebaseFirestoreModule.query(usersRef, firebaseFirestoreModule.where("phone", "==", phone));
        const snapshot = await firebaseFirestoreModule.getDocs(q);
        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            return userData.email || null;
        }
    } catch (error) {
        console.warn("Unable to resolve login email from phone number.", error);
    }
    return null;
}

function getConversationId(firstUid = "", secondUid = "") {
    const ids = [firstUid, secondUid].filter(Boolean).sort();
    return ids.length ? ids.join("_") : `conversation-${Date.now()}`;
}

function conversationKey(contactId = "") {
    const user = getCurrentUser();
    const currentUserId = user?.uid || user?.id || user?.email || "guest";
    const contactUid = contactId || localStorage.getItem("currentChatUid") || "";

    if (contactUid) {
        return getConversationId(currentUserId, contactUid);
    }

    const fallbackId = localStorage.getItem("currentChat") || "chat";
    return `${currentUserId}-${fallbackId}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function localMessagesForConversation(key) {
    const state = readState();
    return state.messages[key] || [];
}

function saveLocalMessages(key, messages) {
    const state = readState();
    state.messages[key] = messages;
    writeState(state);
}

function getStatusTicks(status = "") {
    const normalizedStatus = (status || "").toLowerCase().trim();
    if (normalizedStatus === "read") return "<span class='status-ticks read'>✓✓</span>";
    if (normalizedStatus === "delivered") return "<span class='status-ticks delivered'>✓✓</span>";
    return "<span class='status-ticks sent'>✓</span>";
}

function messageStatusLabel(item) {
    if (!item) return "";
    const isSender = item.senderId === getCurrentUser()?.uid || item.senderId === getCurrentUser()?.id;
    if (isSender) {
        return item.status ? item.status : "Sent";
    }
    return item.status ? item.status : "Received";
}

async function updateMessageStatus(conversationId, messageId, newStatus) {
    if (!configured || !db || !firebaseFirestoreModule) return;
    try {
        await firebaseFirestoreModule.updateDoc(
            firebaseFirestoreModule.doc(db, "conversations", conversationId, "messages", messageId),
            { status: newStatus }
        );
    } catch (error) {
        console.warn("Could not update message status:", error);
    }
}

async function markConversationMessagesAsRead(conversationId, senderUid) {
    if (!configured || !db || !firebaseFirestoreModule) return;
    try {
        const messagesRef = firebaseFirestoreModule.collection(db, "conversations", conversationId, "messages");
        const q = firebaseFirestoreModule.query(
            messagesRef,
            firebaseFirestoreModule.where("senderId", "==", senderUid),
            firebaseFirestoreModule.where("status", "!=", "read")
        );
        const snapshot = await firebaseFirestoreModule.getDocs(q);
        snapshot.docs.forEach((docItem) => {
            updateMessageStatus(conversationId, docItem.id, "read").catch(() => {});
        });
    } catch (error) {
        console.warn("Could not mark messages as read:", error);
    }
}

function renderLocalMessages() {
    const messages = document.getElementById("messages");
    if (!messages) return;
    const key = conversationKey();
    const items = localMessagesForConversation(key);
    messages.innerHTML = "";
    if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "message received";
        empty.innerHTML = "<p>No messages yet. Start the conversation.</p><span>Now</span>";
        messages.appendChild(empty);
        return;
    }
    items.forEach((item) => {
        const wrapper = document.createElement("div");
        wrapper.className = `message ${item.senderId === getCurrentUser()?.id || item.senderId === getCurrentUser()?.uid ? "sent" : "received"}`;\n        const isSender = item.senderId === getCurrentUser()?.id || item.senderId === getCurrentUser()?.uid;\n        const statusContent = isSender ? getStatusTicks(item.status) : \"\";\n        wrapper.innerHTML = `<p>${escapeHTML(item.text)}</p><span>${formatTime(item.createdAt)}${statusContent ? \" • \" + statusContent : \"\"}</span>`;\n        messages.appendChild(wrapper);
    });
    messages.scrollTop = messages.scrollHeight;
}

async function saveUserProfile(user, data = {}) {
    await initializeFirebase();
    
    // Ensure user and uid are valid before proceeding
    if (!user || !user.uid) {
        console.error("Cannot save user profile: user or user.uid is missing.");
        return;
    }
    
    const phone = normalizePhone(data.phone || "");
    const usernameValue = data.username || (data.displayName ? data.displayName.replace(/\s+/g, "").toLowerCase() : user.email ? user.email.split("@")[0] : "");
    const profileRef = firebaseFirestoreModule ? firebaseFirestoreModule.doc(db, "users", user.uid) : null;
    let createdAt = null;

    if (configured && db && auth && firebaseFirestoreModule && profileRef) {
        try {
            const snapshot = await firebaseFirestoreModule.getDoc(profileRef);
            if (!snapshot.exists()) {
                createdAt = firebaseFirestoreModule.serverTimestamp();
            }
        } catch (error) {
            console.warn("Unable to read user profile document before save.", error);
        }
    }

    const profileData = {
        uid: user.uid,
        userId: user.uid,
        email: user.email,
        name: data.name || data.displayName || user.displayName || "",
        username: usernameValue,
        phone,
        about: data.about || "Available",
        photoUrl: data.photoURL || user.photoURL || "",
        online: data.online !== undefined ? data.online : true,
        lastSeen: data.lastSeen || (firebaseFirestoreModule ? firebaseFirestoreModule.serverTimestamp() : null),
        updatedAt: firebaseFirestoreModule ? firebaseFirestoreModule.serverTimestamp() : null
    };

    if (createdAt) {
        profileData.createdAt = createdAt;
    }

    if (configured && db && auth && firebaseFirestoreModule && profileRef) {
        await firebaseFirestoreModule.setDoc(profileRef, profileData, { merge: true });
        return;
    }

    const state = readState();
    const account = state.accounts.find((entry) => entry.email.toLowerCase() === (user.email || "").toLowerCase());
    if (!account) return;
    Object.assign(account, {
        displayName: profileData.name || profileData.displayName || account.displayName || "",
        phone: profileData.phone || account.phone || "",
        about: profileData.about || account.about || "Available",
        username: profileData.username || account.username || "",
        photoURL: profileData.photoUrl || profileData.photoURL || account.photoURL || "",
        userId: profileData.userId || account.userId || account.id
    });
    writeState(state);
    setCurrentUser(account);
}

async function handleSignup(event) {
    event.preventDefault();
    await initializeFirebase();
    ensureAccountSeed();
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const phoneInput = document.getElementById("phone").value.trim();
    const phone = phoneInput
        ? normalizePhone(`${document.getElementById("countryCode").value}${phoneInput}`)
        : "";

    clearStatus();
    if (!name || !email || !password) {
        showError("Please complete the form.");
        return;
    }

    if (configured && auth && firebaseAuthModule) {
        try {
            const result = await firebaseAuthModule.createUserWithEmailAndPassword(auth, email, password);
            await firebaseAuthModule.updateProfile(result.user, { displayName: name });
            const signedInUser = getFirebaseUserData(result.user);
            setCurrentUser(signedInUser);
            await saveUserProfile(result.user, { displayName: name, phone });
            await loadUserProfile(result.user);
            localStorage.setItem("she_verification_email", email);
            window.location.href = "chats.html";
            return;
        } catch (error) {
            showError(error);
            return;
        }
    }

    const state = readState();
    if (state.accounts.some((entry) => entry.email.toLowerCase() === email.toLowerCase())) {
        showError("An account with that email already exists.");
        return;
    }

    const user = {
        id: `local-${Date.now()}`,
        email,
        password,
        displayName: name,
        phone,
        about: "Available"
    };
    state.accounts.push(user);
    writeState(state);
    setCurrentUser(user);
    window.location.href = "chats.html";
}

async function handleLogin(event) {
    event.preventDefault();
    await initializeFirebase();
    ensureAccountSeed();
    const loginValue = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;

    clearStatus();
    if (!loginValue || !password) {
        showError("Please enter your email and password.");
        return;
    }

    if (configured && auth && firebaseAuthModule) {
        try {
            const result = await firebaseAuthModule.signInWithEmailAndPassword(auth, loginValue, password);
            const signedInUser = getFirebaseUserData(result.user);
            setCurrentUser(signedInUser);
            await loadUserProfile(result.user);
            redirectToChats();
            return;
        } catch (error) {
            showError(error);
            return;
        }
    }

    const state = readState();
    const account = state.accounts.find((entry) => entry.email.toLowerCase() === loginValue && entry.password === password);
    if (account) {
        setCurrentUser(account);
        window.location.href = "chats.html";
        return;
    }

    showError("No account matched that email and password.");
}

async function sendMessage() {
    const input = document.getElementById("messageInput");
    if (!input || !input.value.trim()) return;

    const user = getCurrentUser();
    if (!user) {
        showError("Please log in first.");
        return;
    }

    const text = input.value.trim();
    if (!text) return;

    if (configured && db && auth && firebaseFirestoreModule) {
        try {
            const recipientUid = localStorage.getItem("currentChatUid") || "";
            const conversationId = getConversationId(user.uid || user.id, recipientUid);
            await firebaseFirestoreModule.setDoc(firebaseFirestoreModule.doc(db, "conversations", conversationId), {
                participants: [user.uid || user.id, recipientUid].filter(Boolean),
                updatedAt: firebaseFirestoreModule.serverTimestamp(),
                lastMessage: text,
                lastMessageAt: firebaseFirestoreModule.serverTimestamp()
            }, { merge: true });
            await firebaseFirestoreModule.addDoc(firebaseFirestoreModule.collection(db, "conversations", conversationId, "messages"), {
                text,
                senderId: user.uid || user.id,
                status: "Sent",
                createdAt: firebaseFirestoreModule.serverTimestamp()
            });
            input.value = "";
            return;
        } catch (error) {
            showError(error);
            return;
        }
    }

    const key = conversationKey();
    const state = readState();
    const list = state.messages[key] || [];
    list.push({
        text,
        senderId: user.id || user.uid || user.email,
        status: "Sent",
        createdAt: new Date().toISOString()
    });
    state.messages[key] = list;
    writeState(state);
    input.value = "";
    renderLocalMessages();
}

function formatTime(timestamp) {
    if (!timestamp) return "Now";
    if (typeof timestamp === "string") return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (timestamp?.toDate) return timestamp.toDate().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return "Now";
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function togglePassword(id = "password") {
    const input = document.getElementById(id);
    if (input) input.type = input.type === "password" ? "text" : "password";
}

function toggleLoginPassword() { togglePassword("loginPassword"); }
function handleEnter(event) { if (event.key === "Enter") { event.preventDefault(); sendMessage(); } }
function escapeAttribute(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function buildOpenChatClick(name = "", uid = "") {
    return `data-name="${escapeAttribute(name)}" data-uid="${escapeAttribute(uid)}"`;
}

function bindOpenChatEvents(container) {
    if (!container) return;
    const items = container.querySelectorAll(".contact-item, .chat-item");
    items.forEach((item) => {
        item.addEventListener("click", () => {
            const name = item.getAttribute("data-name") || "";
            const uid = item.getAttribute("data-uid") || "";
            openChat(name, uid);
        });
    });
}

function openChat(name, uid = "") {
    console.log("openChat debug", { name, uid });
    const params = new URLSearchParams();
    if (uid) params.set("uid", uid);
    if (name) params.set("name", name);
    localStorage.setItem("currentChat", name || "Chat");
    if (uid) localStorage.setItem("currentChatUid", uid); else localStorage.removeItem("currentChatUid");
    window.location.href = `chat.html${params.toString() ? `?${params.toString()}` : ""}`;
}
function goBack() { window.location.href = "chats.html"; }
function showEmoji() { const input = document.getElementById("messageInput"); if (input) { input.value += "😊"; input.focus(); } }
function logout() {
    if (confirm("Are you sure you want to log out?")) {
        if (configured && auth && firebaseAuthModule) {
            firebaseAuthModule.signOut(auth).then(() => {
                localStorage.removeItem(CURRENT_USER_KEY);
                window.location.href = "login.html";
            }).catch(showError);
            return;
        }
        localStorage.removeItem(CURRENT_USER_KEY);
        window.location.href = "login.html";
    }
}
async function googleLogin() {
    if (!configured || !auth || !firebaseAuthModule) {
        showError("Firebase Google sign-in is unavailable. Check your Firebase configuration.");
        return;
    }

    try {
        const provider = new firebaseAuthModule.GoogleAuthProvider();
        await firebaseAuthModule.signInWithRedirect(auth, provider);
    } catch (error) {
        showError(error);
    }
}
function editProfileName() { window.location.href = "edit-profile.html"; }
function goTo(page) { window.location.href = page; }
function searchChats() { const value = prompt("Search chats:"); if (value) { const container = document.getElementById("chatList") || document.querySelector(".chat-list"); if (container) { const items = Array.from(container.querySelectorAll(".chat-item")); items.forEach((item) => { const text = item.textContent.toLowerCase(); item.style.display = text.includes(value.toLowerCase()) ? "flex" : "none"; }); } } }
function searchContacts() {
    const input = document.getElementById("contactsSearch") || document.getElementById("newChatSearch");
    const value = input?.value?.trim();
    if (value) {
        currentContactsSearch = value;
        void renderContactsResults();
        return;
    }

    const query = prompt("Search contacts:");
    if (!query) return;
    currentContactsSearch = query.trim();
    if (input) {
        input.value = currentContactsSearch;
    }
    void renderContactsResults();
}

function searchContactsInput(event) {
    currentContactsSearch = event.target.value || "";
    void renderContactsResults();
}

function getContactsResultsContainer() {
    return document.getElementById("contactsResults") || document.getElementById("newChatResults") || document.querySelector(".contacts-list") || document.querySelector(".new-chat-list");
}

function filterContactsData(items, query) {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return items.filter((entry) => {
        const displayName = `${entry.displayName || entry.name || entry.email || ""}`.toLowerCase();
        const email = `${entry.email || ""}`.toLowerCase();
        const phone = `${entry.phone || ""}`.toLowerCase();
        const username = `${entry.username || ""}`.toLowerCase();
        return displayName.includes(lowerQuery) || email.includes(lowerQuery) || phone.includes(lowerQuery) || username.includes(lowerQuery);
    });
}

async function searchUsersInFirestore(query) {
    if (!configured || !db || !auth || !firebaseFirestoreModule) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const currentUser = getCurrentUser();
    const currentUserId = currentUser?.uid || currentUser?.id || "";
    const snapshot = await firebaseFirestoreModule.getDocs(firebaseFirestoreModule.collection(db, "users"));

    return snapshot.docs
        .map((docItem) => ({ uid: docItem.id, ...docItem.data() }))
        .filter((userEntry) => {
            if (!userEntry.uid || userEntry.uid === currentUserId) return false;
            const displayName = `${userEntry.name || userEntry.displayName || userEntry.email || ""}`.toLowerCase();
            const email = `${userEntry.email || ""}`.toLowerCase();
            const phone = `${userEntry.phone || ""}`.toLowerCase();
            const username = `${userEntry.username || ""}`.toLowerCase();
            return displayName.includes(normalizedQuery) || email.includes(normalizedQuery) || phone.includes(normalizedQuery) || username.includes(normalizedQuery);
        })
        .map((userEntry) => ({
            ...userEntry,
            displayName: userEntry.name || userEntry.displayName || userEntry.email || "User",
            name: userEntry.name || userEntry.displayName || userEntry.email || "User",
            about: userEntry.about || "Available",
            photoUrl: userEntry.photoUrl || userEntry.photoURL || userEntry.photo || ""
        }));
}

async function renderContactsResults() {
    const resultsContainer = getContactsResultsContainer();
    if (!resultsContainer) return;
    const query = currentContactsSearch.trim();

    if (configured && db && auth && firebaseFirestoreModule) {
        if (!query) {
            resultsContainer.innerHTML = '<div class="message received"><p>Type a name or email to search registered users.</p></div>';
            return;
        }

        resultsContainer.innerHTML = '<div class="message received"><p>Searching…</p></div>';
        const users = await searchUsersInFirestore(query);
        if (!users.length) {
            resultsContainer.innerHTML = '<div class="message received"><p>No matching users found.</p></div>';
            return;
        }

        resultsContainer.innerHTML = users.map((userEntry) => {
            const uid = userEntry.uid || userEntry.id || userEntry.userId || "";
            const name = userEntry.name || userEntry.displayName || userEntry.email || "User";
            const status = userEntry.about || "Available";
            const photoURL = userEntry.photoUrl || userEntry.photoURL || userEntry.photo || "";
            const avatarMarkup = photoURL
                ? `<img class="avatar-photo" src="${escapeHTML(photoURL)}" alt="${escapeHTML(name)}">`
                : "👤";
            return `
                <div class="contact-item" ${buildOpenChatClick(name, uid)}>
                    <div class="avatar">${avatarMarkup}</div>
                    <div class="contact-details">
                        <h3>${escapeHTML(name)}</h3>
                        <p>${escapeHTML(status)}</p>
                    </div>
                </div>
            `;
        }).join("");
        bindOpenChatEvents(resultsContainer);
        return;
    }

    const state = readState();
    const currentUser = getCurrentUser();
    const currentUserKey = currentUser?.id || currentUser?.uid || currentUser?.email || "guest";
    const phoneList = (state.contacts && state.contacts[currentUserKey]) || [];
    const contacts = phoneList.map((phone) => {
        const account = state.accounts.find((entry) => normalizePhone(entry.phone) === normalizePhone(phone));
        const name = account?.displayName || account?.email || phone;
        return {
            name,
            phone,
            email: account?.email || "",
            displayName: name,
            username: account?.username || "",
            uid: account?.id || account?.uid || account?.email || phone
        };
    });

    const filtered = filterContactsData(contacts, query);
    if (!filtered.length) {
        resultsContainer.innerHTML = '<div class="message received"><p>No contacts found.</p></div>';
        return;
    }

    resultsContainer.innerHTML = filtered.map((contact) => `
        <div class="contact-item" ${buildOpenChatClick(contact.name, contact.uid)}>
            <div class="avatar">👤</div>
            <div class="contact-details">
                <h3>${escapeHTML(contact.name)}</h3>
                <p>${escapeHTML(contact.phone)}</p>
            </div>
        </div>
    `).join("");
    bindOpenChatEvents(resultsContainer);
}

function searchCalls() { alert("Calls are managed through your connected contacts."); }
function openMenu() { window.location.href = "profile.html"; }
function newChat() { window.location.href = "new-chat.html"; }
function createGroup() { window.location.href = "new-group.html"; }
function createContact() {
    const phone = prompt("Enter the phone number of the person you want to add:");
    if (!phone) return;
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
        showError("Please enter a valid phone number.");
        return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) {
        showError("Please sign in first.");
        return;
    }

    const state = readState();
    const contacts = state.contacts || {};
    contacts[currentUser.id || currentUser.uid || currentUser.email] = contacts[currentUser.id || currentUser.uid || currentUser.email] || [];
    contacts[currentUser.id || currentUser.uid || currentUser.email].push(normalizedPhone);
    state.contacts = contacts;
    writeState(state);

    const foundAccount = state.accounts.find((entry) => normalizePhone(entry.phone) === normalizedPhone);
    if (foundAccount) {
        openChat(foundAccount.displayName || foundAccount.email || normalizedPhone, foundAccount.id || foundAccount.uid || foundAccount.email);
        return;
    }

    alert(`Added contact request for ${normalizedPhone}. If that number is registered, it will appear in your chats after sign-in.`);
}
function startCall() { alert("Voice calls require a WebRTC service and are not enabled yet."); }
function startVideoCall() { alert("Video calls require a WebRTC service and are not enabled yet."); }
function attachFile() { alert("File uploads require Firebase Storage setup."); }
function openCamera() { alert("Camera access is not enabled yet."); }
function sendVoiceMessage() { alert("Voice messages are not enabled yet."); }
function changeProfilePhoto() { alert("Profile photos require Firebase Storage setup."); }
function editAbout() { window.location.href = "edit-profile.html"; }
function addParticipant() { alert("Add a registered Firebase user to this group."); }
function leaveGroup() { if (confirm("Are you sure you want to exit this group?")) goBack(); }
function openPrivacy() { alert("Privacy settings are managed through your Firebase account."); }
function openSecurity() { alert("Use Forgot password on the login screen to reset credentials."); }
function openChatSettings() { alert("Chat settings are not enabled yet."); }
function openNotifications() { alert("Notifications are not enabled yet."); }
function openStorage() { alert("Storage settings are not enabled yet."); }
function openHelp() { alert("Please check the Firebase setup instructions in README.md."); }
function toggleDarkMode() { document.body.classList.toggle("dark-mode"); localStorage.setItem("darkMode", document.body.classList.contains("dark-mode")); }
function addStatus() { alert("Status posts are not enabled yet."); }
function viewStatus(name) { alert(`Status from ${name} is not available yet.`); }

async function saveProfile() {
    try {
        await initializeFirebase();
        const displayName = document.getElementById("editName").value.trim();
        const about = document.getElementById("editAbout").value.trim();
        const username = document.getElementById("editUsername")?.value.trim();
        const photoURL = document.getElementById("editPhotoURL")?.value.trim();
        if (!displayName) throw new Error("Please enter your name.");
        const currentUser = getCurrentUser();
        if (configured && auth && firebaseAuthModule && auth.currentUser) {
            const profileData = {
                displayName,
                about,
                username,
                photoURL: photoURL || currentUser?.photoURL || ""
            };
            await firebaseAuthModule.updateProfile(auth.currentUser, {
                displayName,
                photoURL: profileData.photoURL
            });
            await saveUserProfile(auth.currentUser, profileData);
            await loadUserProfile(auth.currentUser);
        } else {
            await saveUserProfile(currentUser, { displayName, about, username, photoURL });
        }
        window.location.href = "profile.html";
    } catch (error) {
        showError(error);
    }
}

function hydrateProfilePage() {
    const user = getCurrentUser();
    if (!user) return;
    const profilePhoto = document.getElementById("profilePhoto");
    const displayName = document.getElementById("displayName");
    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");
    const profileUsername = document.getElementById("profileUsername");
    const profileUserId = document.getElementById("profileUserId");
    const profileAbout = document.getElementById("profileAbout");
    const profilePhone = document.querySelector(".profile-phone");
    const profileMeta = document.getElementById("profileMeta");

    if (profilePhoto) {
        if (user.photoURL) {
            profilePhoto.style.backgroundImage = `url(${user.photoURL})`;
            profilePhoto.textContent = "";
        } else {
            profilePhoto.style.backgroundImage = "";
            profilePhoto.textContent = "👤";
        }
    }
    if (displayName) displayName.textContent = user.displayName || "Your Name";
    if (profileName) profileName.textContent = user.displayName || "Your Name";
    if (profileEmail) profileEmail.textContent = user.email || "";
    if (profileUsername) profileUsername.textContent = user.username || user.email?.split("@")[0] || "username";
    if (profileUserId) profileUserId.textContent = user.userId || user.uid || user.id || "-";
    if (profileAbout) profileAbout.textContent = user.about || "Available";
    if (profilePhone) profilePhone.textContent = user.phone || user.email || "";
    if (profileMeta) {
        const createdAt = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleString() : user.createdAt || "";
        const lastSeen = user.lastSeen?.toDate ? user.lastSeen.toDate().toLocaleString() : user.lastSeen || "";
        profileMeta.textContent = [createdAt ? `Joined: ${createdAt}` : null, lastSeen ? `Last seen: ${lastSeen}` : null].filter(Boolean).join(" • ");
    }
}

function hydrateEditProfilePage() {
    const user = getCurrentUser();
    if (!user) return;
    const editName = document.getElementById("editName");
    const editAbout = document.getElementById("editAbout");
    const editUsername = document.getElementById("editUsername");
    const editPhotoURL = document.getElementById("editPhotoURL");
    const editPhone = document.querySelector(".edit-profile-page input[disabled]");
    if (editName) editName.value = user.displayName || "";
    if (editAbout) editAbout.value = user.about || "";
    if (editUsername) editUsername.value = user.username || user.email?.split("@")[0] || "";
    if (editPhotoURL) editPhotoURL.value = user.photoURL || "";
    if (editPhone) editPhone.value = user.phone || user.email || "";
}

function hydrateSettingsPage() {
    const user = getCurrentUser();
    if (!user) return;
    const profileName = document.querySelector(".settings-profile h3");
    const profileStatus = document.querySelector(".settings-profile p");
    if (profileName) profileName.textContent = user.displayName || user.username || "Your Name";
    if (profileStatus) profileStatus.textContent = user.about || "Available";
}

function stopRealtimeListeners() {
    if (chatListUnsubscribe) { chatListUnsubscribe(); chatListUnsubscribe = null; }
    if (contactsUnsubscribe) { contactsUnsubscribe(); contactsUnsubscribe = null; }
    if (messagesUnsubscribe) { messagesUnsubscribe(); messagesUnsubscribe = null; }
}

async function renderChatList() {
    const container = document.getElementById("chatList") || document.querySelector(".chat-list");
    if (!container) return;

    if (configured && db && auth && firebaseFirestoreModule) {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            container.innerHTML = '<div class="message received"><p>Please sign in to see real chats.</p></div>';
            return;
        }

        if (chatListUnsubscribe) chatListUnsubscribe();
        const conversationsRef = firebaseFirestoreModule.collection(db, "conversations");
        const q = firebaseFirestoreModule.query(conversationsRef, firebaseFirestoreModule.where("participants", "array-contains", currentUser.uid || currentUser.id));
        chatListUnsubscribe = firebaseFirestoreModule.onSnapshot(q, async (snapshot) => {
            const conversations = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))
                .sort((a, b) => (b.lastMessageAt?.toDate?.() || 0) - (a.lastMessageAt?.toDate?.() || 0));

            const items = await Promise.all(conversations.map(async (conversation) => {
                const otherUid = (conversation.participants || []).find((participant) => participant !== (currentUser.uid || currentUser.id));
                let otherUser = null;
                if (otherUid && firebaseFirestoreModule) {
                    const otherDoc = await firebaseFirestoreModule.getDoc(firebaseFirestoreModule.doc(db, "users", otherUid));
                    if (otherDoc.exists()) {
                        otherUser = { uid: otherDoc.id, ...otherDoc.data() };
                    }
                }
                const name = otherUser?.displayName || otherUser?.email || "New chat";
                const preview = conversation.lastMessage || "Start the conversation";
                const time = conversation.lastMessageAt?.toDate ? formatTime(conversation.lastMessageAt) : "Now";
                return `
                    <div class="chat-item" ${buildOpenChatClick(name, otherUid || "")}>
                        <div class="avatar">👤</div>
                        <div class="chat-details">
                            <div class="chat-top">
                                <h3>${escapeHTML(name)}</h3>
                                <span>${time}</span>
                            </div>
                            <div class="chat-bottom">
                                <p>${escapeHTML(preview)}</p>
                            </div>
                        </div>
                    </div>
                `;
            }));

            container.innerHTML = items.join("") || '<div class="message received"><p>No conversations yet. Open a real contact to start chatting.</p></div>';
            bindOpenChatEvents(container);
        });
        return;
    }

    const state = readState();
    const currentUser = getCurrentUser();
    const currentUserKey = currentUser?.id || currentUser?.uid || currentUser?.email || "guest";
    const phoneList = (state.contacts && state.contacts[currentUserKey]) || [];

    if (!phoneList.length) {
        container.innerHTML = '<div class="message received"><p>Add someone by phone number to start a real conversation.</p></div>';
        return;
    }

    const html = phoneList.map((phone) => {
        const account = state.accounts.find((entry) => normalizePhone(entry.phone) === normalizePhone(phone));
        const name = account?.displayName || account?.email || phone;
        const uid = account?.id || account?.uid || account?.email || phone;
        const key = conversationKey(uid);
        const messages = state.messages[key] || [];
        const lastMessage = messages[messages.length - 1];
        const preview = lastMessage ? lastMessage.text : "Tap to chat";
        const time = lastMessage ? formatTime(lastMessage.createdAt) : "Now";
        return `
            <div class="chat-item" ${buildOpenChatClick(name, uid)}>
                <div class="avatar">👤</div>
                <div class="chat-details">
                    <div class="chat-top">
                        <h3>${escapeHTML(name)}</h3>
                        <span>${time}</span>
                    </div>
                    <div class="chat-bottom">
                        <p>${escapeHTML(preview)}</p>
                        ${messages.length ? '<span class="unread">1</span>' : ""}
                    </div>
                </div>
            </div>
        `;
    }).join("");

    container.innerHTML = html;
}

function renderContactsList() {
    const container = document.getElementById("contactsList") || document.querySelector(".contacts-list") || document.getElementById("newChatList") || document.querySelector(".new-chat-list");
    if (!container) return;

    if (configured && db && auth && firebaseFirestoreModule) {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            const resultsContainer = getContactsResultsContainer();
            if (resultsContainer) {
                resultsContainer.innerHTML = '<div class="message received"><p>Please sign in to see real contacts.</p></div>';
            }
            return;
        }

        if (contactsUnsubscribe) contactsUnsubscribe();
        const usersRef = firebaseFirestoreModule.collection(db, "users");
        contactsUnsubscribe = firebaseFirestoreModule.onSnapshot(usersRef, (snapshot) => {
            const users = snapshot.docs
                .map((docItem) => ({ uid: docItem.id, ...docItem.data() }))
                .filter((userEntry) => userEntry.uid && userEntry.uid !== (currentUser.uid || currentUser.id))
                .map((userEntry) => ({
                    ...userEntry,
                    displayName: userEntry.name || userEntry.displayName || userEntry.email || "User",
                    name: userEntry.name || userEntry.displayName || userEntry.email || "User",
                    about: userEntry.about || "Available",
                    photoUrl: userEntry.photoUrl || userEntry.photoURL || userEntry.photo || ""
                }))
                .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

            contactsCache = users;
            renderContactsResults();
        });
        return;
    }

    renderContactsResults();
}

function renderMessagesForConversation() {
    const messagesContainer = document.getElementById("messages");
    if (!messagesContainer) return;

    if (configured && db && auth && firebaseFirestoreModule) {
        const currentUser = getCurrentUser();
        const recipientUid = localStorage.getItem("currentChatUid") || "";
        if (!currentUser || !recipientUid) {
            messagesContainer.innerHTML = '<div class="message received"><p>Select a real contact to start chatting.</p></div>';
            return;
        }

        if (messagesUnsubscribe) messagesUnsubscribe();
        const conversationId = getConversationId(currentUser.uid || currentUser.id, recipientUid);
        const messagesRef = firebaseFirestoreModule.collection(db, "conversations", conversationId, "messages");
        const q = firebaseFirestoreModule.query(messagesRef, firebaseFirestoreModule.orderBy("createdAt", "asc"));
        messagesUnsubscribe = firebaseFirestoreModule.onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
            messagesContainer.innerHTML = "";
            if (!items.length) {
                const empty = document.createElement("div");
                empty.className = "message received";
                empty.innerHTML = "<p>No messages yet. Start the conversation.</p><span>Now</span>";
                messagesContainer.appendChild(empty);
                return;
            }
            items.forEach((item) => {
                const isSender = item.senderId === (currentUser.uid || currentUser.id);\n                const wrapper = document.createElement("div");
                wrapper.className = `message ${isSender ? "sent" : "received"}`;
                const statusContent = isSender ? getStatusTicks(item.status) : "";\n                wrapper.innerHTML = `<p>${escapeHTML(item.text)}</p><span>${formatTime(item.createdAt)}${statusContent ? " • " + statusContent : ""}</span>`;\n                messagesContainer.appendChild(wrapper);
                
                // Mark received messages as delivered\n                if (!isSender && item.status !== "delivered" && item.status !== "read") {\n                    updateMessageStatus(conversationId, item.id, "delivered").catch(() => {});\n                }\n            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
        return;
    }

    renderLocalMessages();
}

async function hydrateChatPage() {
    const headerName = document.querySelector(".chat-profile h3");
    const headerStatus = document.querySelector(".chat-profile p");
    const avatar = document.querySelector(".small-avatar");
    const params = new URLSearchParams(window.location.search);
    const recipientUid = params.get("uid") || localStorage.getItem("currentChatUid") || "";
    const currentName = params.get("name") || localStorage.getItem("currentChat") || "Chat";
    console.log("hydrateChatPage debug", { recipientUid, currentName, search: window.location.search });

    if (recipientUid) {
        localStorage.setItem("currentChatUid", recipientUid);
    }
    if (currentName) {
        localStorage.setItem("currentChat", currentName);
    }

    if (headerName) headerName.textContent = currentName || "Chat";
    if (headerStatus) headerStatus.textContent = "online";
    if (avatar) {
        avatar.innerHTML = "👩🏾";
    }

    if (!configured && !getCurrentUser()) {
        window.location.href = "login.html";
        return;
    }

    if (configured && db && auth && firebaseFirestoreModule && recipientUid) {
        try {
            const profileDoc = await firebaseFirestoreModule.getDoc(firebaseFirestoreModule.doc(db, "users", recipientUid));
            if (profileDoc.exists()) {
                const profileData = profileDoc.data();
                const displayName = profileData.name || profileData.displayName || profileData.email || currentName || "User";
                const about = profileData.about || "Available";
                const photoURL = profileData.photoUrl || profileData.photoURL || profileData.photo || "";
                if (headerName) headerName.textContent = displayName;
                if (headerStatus) headerStatus.textContent = about;
                if (avatar) {
                    avatar.innerHTML = photoURL
                        ? `<img class="avatar-photo" src="${escapeHTML(photoURL)}" alt="${escapeHTML(displayName)}">`
                        : "👩🏾";
                }
                localStorage.setItem("currentChat", displayName);
            }
        } catch (error) {
            console.warn("Unable to load the chat recipient profile.", error);
        }

        // Mark messages from recipient as read when opening the chat, but do not block page load on it.
        const conversationId = getConversationId(getCurrentUser().uid || getCurrentUser().id, recipientUid);
        markConversationMessagesAsRead(conversationId, recipientUid).catch(() => {});
    }

    renderMessagesForConversation();
}

async function initializeApp() {
    console.log("=== APP INITIALIZATION STARTED ===");
    updateFirebaseStatus();

    console.log("Starting Firebase initialization (non-blocking)");
    // DO NOT AWAIT Firebase - let it initialize in the background
    initializeFirebase().catch(err => {
        console.error("Firebase init error:", err);
        updateFirebaseStatus();
    });

    // Update status every 500ms
    const statusInterval = setInterval(updateFirebaseStatus, 500);
    
    // Wait a bit for Firebase to start, but DON'T WAIT FOR IT TO COMPLETE
    await new Promise(resolve => setTimeout(resolve, 500));
    clearInterval(statusInterval);
    updateFirebaseStatus();
    
    console.log("Continuing app init - Firebase initializing in background");

    if (!requireAuth()) return;

    if (document.getElementById("signupForm")) {
        document.getElementById("signupForm").addEventListener("submit", handleSignup);
    }
    if (document.getElementById("loginForm")) {
        document.getElementById("loginForm").addEventListener("submit", handleLogin);
    }
    if (document.getElementById("forgotPasswordForm")) {
        document.getElementById("forgotPasswordForm").addEventListener("submit", handleForgotPasswordForm);
    }
    if (document.getElementById("resetPasswordForm")) {
        document.getElementById("resetPasswordForm").addEventListener("submit", handleResetPasswordForm);
    }

    updateFirebaseStatus();

    if (document.getElementById("messages")) {
        await hydrateChatPage();
    }

    if (document.getElementById("chatList") || document.querySelector(".chat-list")) {
        await renderChatList();
    }

    if (document.querySelector(".contacts-list") || document.querySelector(".new-chat-list")) {
        renderContactsList();
    }

    if (document.getElementById("displayName") || document.getElementById("profileName") || document.getElementById("profileAbout")) {
        hydrateProfilePage();
    }

    if (document.getElementById("editName") || document.getElementById("editAbout") || document.getElementById("editUsername")) {
        hydrateEditProfilePage();
    }

    if (document.querySelector(".settings-profile")) {
        hydrateSettingsPage();
    }
}

initializeApp().catch(showError);

// Check every second if user is logged in via Firebase and redirect
if (typeof document !== 'undefined') {
    setInterval(() => {
        if (isAuthPage() && firebaseInitCompleted && auth && auth.currentUser) {
            console.log("User logged in, redirecting to chats");
            redirectToChats();
        }
    }, 1000);
}

Object.assign(window, { sendMessage, togglePassword, toggleLoginPassword, handleEnter, openChat, goBack, showEmoji, logout, forgotPassword, googleLogin, editProfileName, saveProfile, goTo, searchChats, searchContacts, searchCalls, openMenu, newChat, createGroup, createContact, startCall, startVideoCall, attachFile, openCamera, sendVoiceMessage, changeProfilePhoto, editAbout, addParticipant, leaveGroup, openPrivacy, openSecurity, openChatSettings, openNotifications, openStorage, openHelp, toggleDarkMode, addStatus, viewStatus });
