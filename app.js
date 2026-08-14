import { firebaseConfig } from "./firebase-config.js";

// ============================================
// GLOBAL STATE & CONSTANTS
// ============================================
const STORAGE_KEY = "she_app_state";
const CURRENT_USER_KEY = "she_current_user";

let auth = null;
let db = null;
let storage = null;
let firebaseApp = null;
let firebaseInitialized = false;

// Contacts and chats
let userContacts = [];
let chats = [];
let currentChatUid = null;
let chatListUnsubscribe = null;
let messagesUnsubscribe = null;
let presenceUnsubscribe = null;
let typingUnsubscribe = null;
let typingTimer = null;

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
        const { getStorage } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
        
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        storage = getStorage(firebaseApp);
        
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

function setAvatarElement(element, photoURL, fallbackText = "👤") {
    if (!element) return;

    if (photoURL) {
        element.innerHTML = `<img src="${photoURL}" alt="Profile photo" />`;
        element.style.background = "#ddd";
        element.style.overflow = "hidden";
        return;
    }

    element.innerHTML = "";
    element.textContent = fallbackText;
    element.style.background = "#ddd";
    element.style.overflow = "hidden";
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
        
        await setCurrentUserPresence(true);
        
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
            createdAt: new Date(),
            online: true,
            lastSeen: null
        });

        await setCurrentUserPresence(true);
        
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
            createdAt: new Date(),
            online: true,
            lastSeen: null
        }, { merge: true });

        await setCurrentUserPresence(true);
        
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

async function setCurrentUserPresence(isOnline) {
    if (!firebaseInitialized || !auth?.currentUser) return;

    try {
        const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        await setDoc(doc(db, "users", auth.currentUser.uid), {
            uid: auth.currentUser.uid,
            online: isOnline,
            lastSeen: isOnline ? null : serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.warn("Could not update presence:", error);
    }
}

async function setTypingStatus(isTyping, chatWithUserId) {
    if (!firebaseInitialized || !auth?.currentUser) return;

    try {
        const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        await setDoc(doc(db, "users", auth.currentUser.uid), {
            typing: isTyping ? {
                isTyping: true,
                chatWith: chatWithUserId,
                updatedAt: serverTimestamp()
            } : {
                isTyping: false,
                chatWith: null,
                updatedAt: serverTimestamp()
            }
        }, { merge: true });
    } catch (error) {
        console.warn("Could not update typing status:", error);
    }
}

function stopTypingStatus() {
    if (typingTimer) {
        clearTimeout(typingTimer);
        typingTimer = null;
    }
    const chatUid = localStorage.getItem("currentChatUid");
    if (chatUid) {
        setTypingStatus(false, chatUid);
    }
}

function logout() {
    if (auth) {
        setCurrentUserPresence(false);
        setTypingStatus(false, localStorage.getItem("currentChatUid"));
        auth.signOut();
    }
    clearUser();
    if (chatListUnsubscribe) chatListUnsubscribe();
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (presenceUnsubscribe) presenceUnsubscribe();
    if (typingUnsubscribe) typingUnsubscribe();
    window.location.href = "login.html";
}

// ============================================
// PROFILE MANAGEMENT
// ============================================
async function loadUserProfile() {
    if (!firebaseInitialized || !auth?.currentUser) return;
    
    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Display on profile page
            const profileName = document.getElementById("profileName");
            const displayName = document.getElementById("displayName");
            const profileEmail = document.getElementById("profileEmail");
            const profilePhone = document.getElementById("profilePhone");
            const profileAbout = document.getElementById("profileAbout");
            const profilePhoto = document.getElementById("profilePhoto");
            
            if (profileName) profileName.textContent = userData.displayName || "User";
            if (displayName) displayName.textContent = userData.displayName || "User";
            if (profileEmail) profileEmail.textContent = userData.email || "";
            if (profilePhone) profilePhone.textContent = userData.phone || "Not set";
            if (profileAbout) profileAbout.textContent = userData.about || "Available";
            setAvatarElement(profilePhoto, userData.photoURL, "👤");
            
            // Load into edit page
            const editName = document.getElementById("editName");
            const editAbout = document.getElementById("editAbout");
            const editPhotoURL = document.getElementById("editPhotoURL");
            const editPhone = document.getElementById("editPhone");
            const editProfilePhoto = document.getElementById("editProfilePhoto");
            
            if (editName) editName.value = userData.displayName || "";
            if (editAbout) editAbout.value = userData.about || "";
            if (editPhotoURL) editPhotoURL.value = userData.photoURL || "";
            if (editPhone) editPhone.value = userData.phone || "";
            setAvatarElement(editProfilePhoto, userData.photoURL, "👤");
            
            return userData;
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

async function saveProfile() {
    if (!firebaseInitialized || !auth?.currentUser) return;
    
    try {
        const name = document.getElementById("editName")?.value?.trim() || "";
        const about = document.getElementById("editAbout")?.value?.trim() || "";
        const photoURL = document.getElementById("editPhotoURL")?.value?.trim() || "";
        const phone = document.getElementById("editPhone")?.value?.trim() || "";
        
        if (!name) {
            showError("Name is required");
            return;
        }
        
        showError("Saving profile...");
        
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const { updateProfile } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        
        // Update Firestore
        await setDoc(doc(db, "users", auth.currentUser.uid), {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: name,
            about: about,
            photoURL: photoURL,
            phone: phone,
            updatedAt: new Date()
        }, { merge: true });
        
        // Update Firebase Auth
        await updateProfile(auth.currentUser, {
            displayName: name,
            photoURL: photoURL
        });
        
        showSuccess("Profile saved!");
        setTimeout(() => {
            window.location.href = "profile.html";
        }, 1000);
        
    } catch (error) {
        console.error("Error saving profile:", error);
        showError("Failed to save profile: " + error.message);
    }
}

function editProfileName() {
    window.location.href = "edit-profile.html";
}

function editAbout() {
    window.location.href = "edit-profile.html";
}

async function uploadProfilePhoto(file) {
    if (!file || !auth?.currentUser || !storage) {
        return "";
    }

    try {
        const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
        const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
        const storageRef = ref(storage, `profile-photos/${auth.currentUser.uid}/${Date.now()}.${extension}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Error uploading image:", error);
        showError("Failed to upload image");
        return "";
    }
}

async function changeProfilePhoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";

    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        const uploadedURL = await uploadProfilePhoto(file);
        if (!uploadedURL) return;

        const editPhotoURL = document.getElementById("editPhotoURL");
        if (editPhotoURL) editPhotoURL.value = uploadedURL;

        const editProfilePhoto = document.getElementById("editProfilePhoto");
        if (editProfilePhoto) setAvatarElement(editProfilePhoto, uploadedURL, "👤");

        const profilePhoto = document.getElementById("profilePhoto");
        if (profilePhoto) setAvatarElement(profilePhoto, uploadedURL, "👤");
    };

    document.body.appendChild(input);
    input.click();
    input.remove();
}

// ============================================
// REAL-TIME MESSAGING
// ============================================
async function loadMessages() {
    const chatUid = localStorage.getItem("currentChatUid");
    const chatName = localStorage.getItem("currentChatName");
    
    if (!chatUid || !firebaseInitialized || !auth?.currentUser) {
        console.error("Missing chat info");
        return;
    }
    
    try {
        const chatHeader = document.querySelector(".chat-profile h3");
        const chatStatus = document.querySelector(".chat-profile p");
        const chatAvatar = document.querySelector(".small-avatar");
        if (chatHeader) chatHeader.textContent = chatName || "Chat";
        if (chatStatus) chatStatus.textContent = "online";
        
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const userSnap = await getDoc(doc(db, "users", chatUid));
        const otherUserData = userSnap.data() || {};
        setAvatarElement(chatAvatar, otherUserData.photoURL, "👤");
        
        const conversationId = getConversationId(auth.currentUser.uid, chatUid);
        await markMessagesAsRead(conversationId);
        await markConversationRead(conversationId);
        await setupMessageListener(conversationId);
        await listenToUserPresence(chatUid);
        await listenToUserTyping(chatUid);
        
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

async function listenToUserPresence(chatUid) {
    if (!chatUid || !firebaseInitialized) return;

    try {
        const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        if (presenceUnsubscribe) presenceUnsubscribe();

        presenceUnsubscribe = onSnapshot(doc(db, "users", chatUid), (snapshot) => {
            const userData = snapshot.data() || {};
            const statusEl = document.querySelector(".chat-profile p");
            const avatarEl = document.querySelector(".small-avatar");
            if (!statusEl) return;

            if (userData.photoURL) {
                setAvatarElement(avatarEl, userData.photoURL, "👤");
            }

            if (userData.online === true) {
                statusEl.textContent = "Online";
            } else if (userData.lastSeen) {
                statusEl.textContent = `Last seen ${formatMessageTime(userData.lastSeen)}`;
            } else {
                statusEl.textContent = "Offline";
            }
        });
    } catch (error) {
        console.warn("Could not listen to user presence:", error);
    }
}

async function listenToUserTyping(chatUid) {
    if (!chatUid || !firebaseInitialized) return;

    try {
        const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        if (typingUnsubscribe) typingUnsubscribe();

        typingUnsubscribe = onSnapshot(doc(db, "users", chatUid), (snapshot) => {
            const userData = snapshot.data() || {};
            const typingEl = document.getElementById("typingIndicator");
            if (!typingEl) return;

            const typing = userData.typing || {};
            const isTyping = typing.isTyping === true && typing.chatWith === auth.currentUser.uid;
            typingEl.style.display = isTyping ? "block" : "none";
            typingEl.textContent = isTyping ? "typing..." : "";
        });
    } catch (error) {
        console.warn("Could not listen to typing state:", error);
    }
}

async function setupMessageListener(conversationId) {
    try {
        const { collection, query, orderBy, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        const messagesRef = collection(db, "conversations", conversationId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        
        if (messagesUnsubscribe) messagesUnsubscribe();
        
        messagesUnsubscribe = onSnapshot(q, async (snapshot) => {
            const messagesContainer = document.getElementById("messages");
            if (!messagesContainer) return;

            await markMessagesAsDelivered(conversationId);

            messagesContainer.innerHTML = "";
            snapshot.forEach((messageDoc) => {
                const message = messageDoc.data();
                const isOwn = message.senderId === auth.currentUser.uid;
                const messageStatus = message.status || "sent";
                const messageTime = formatMessageTime(message.createdAt);

                const messageEl = document.createElement("div");
                messageEl.className = `message ${isOwn ? "sent" : "received"}`;
                messageEl.innerHTML = `
                    <div class="message-body">
                        <p>${escapeHTML(message.text)}</p>
                    </div>
                    <div class="message-meta">
                        <span class="message-time-inline">${messageTime}</span>
                        ${isOwn ? `<span class="status-ticks ${messageStatus}">${getStatusTicks(messageStatus)}</span>` : ""}
                    </div>
                `;

                messagesContainer.appendChild(messageEl);
            });

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
        
    } catch (error) {
        console.error("Error setting up listener:", error);
    }
}

function getStatusTicks(status) {
    if (status === "sent") return "✓";
    if (status === "delivered") return "✓✓";
    if (status === "read") return "✓✓";
    return "✓";
}

async function markMessagesAsDelivered(conversationId) {
    if (!firebaseInitialized || !auth?.currentUser || !conversationId) return;

    try {
        const { collection, getDocs, doc, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const messagesRef = collection(db, "conversations", conversationId, "messages");
        const snapshot = await getDocs(messagesRef);

        const batch = writeBatch(db);
        snapshot.docs.forEach((messageDoc) => {
            const message = messageDoc.data();
            const isIncoming = message.senderId !== auth.currentUser.uid;
            const needsDelivered = isIncoming && (message.status === "sent" || !message.status);

            if (needsDelivered) {
                batch.update(doc(db, "conversations", conversationId, "messages", messageDoc.id), {
                    status: "delivered"
                });
            }
        });

        if (snapshot.docs.some(docSnap => {
            const message = docSnap.data();
            return message.senderId !== auth.currentUser.uid && (message.status === "sent" || !message.status);
        })) {
            await batch.commit();
        }
    } catch (error) {
        console.warn("Could not update delivered status:", error);
    }
}

async function markMessagesAsRead(conversationId) {
    if (!firebaseInitialized || !auth?.currentUser || !conversationId) return;

    try {
        const { collection, getDocs, doc, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const messagesRef = collection(db, "conversations", conversationId, "messages");
        const snapshot = await getDocs(messagesRef);

        const batch = writeBatch(db);
        snapshot.docs.forEach((messageDoc) => {
            const message = messageDoc.data();
            const isIncoming = message.senderId !== auth.currentUser.uid;
            const needsRead = isIncoming && message.status !== "read";

            if (needsRead) {
                batch.update(doc(db, "conversations", conversationId, "messages", messageDoc.id), {
                    status: "read"
                });
            }
        });

        if (snapshot.docs.some(docSnap => {
            const message = docSnap.data();
            return message.senderId !== auth.currentUser.uid && message.status !== "read";
        })) {
            await batch.commit();
        }
    } catch (error) {
        console.warn("Could not update read status:", error);
    }
}

async function sendMessage() {
    const messageInput = document.getElementById("messageInput");
    const text = messageInput?.value?.trim() || "";
    
    if (!text) return;
    
    const chatUid = localStorage.getItem("currentChatUid");
    
    if (!chatUid || !firebaseInitialized || !auth?.currentUser) {
        showError("Not in a chat");
        return;
    }
    
    try {
        const { collection, addDoc, doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        const conversationId = getConversationId(auth.currentUser.uid, chatUid);
        
        await addDoc(collection(db, "conversations", conversationId, "messages"), {
            senderId: auth.currentUser.uid,
            receiverId: chatUid,
            text: text,
            createdAt: serverTimestamp(),
            status: "sent"
        });

        await setDoc(doc(db, "conversations", conversationId), {
            participants: [auth.currentUser.uid, chatUid],
            lastMessage: text,
            lastMessageSenderId: auth.currentUser.uid,
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp(),
            unreadBy: [chatUid]
        }, { merge: true });
        
        messageInput.value = "";
        messageInput.focus();
        
    } catch (error) {
        console.error("Error sending message:", error);
        showError("Failed to send message");
    }
}

function handleEnter(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function handleMessageInput() {
    const chatUid = localStorage.getItem("currentChatUid");
    const value = document.getElementById("messageInput")?.value?.trim() || "";

    if (!chatUid || !firebaseInitialized || !auth?.currentUser) return;

    if (value.length > 0) {
        if (typingTimer) clearTimeout(typingTimer);
        setTypingStatus(true, chatUid);
        typingTimer = setTimeout(() => {
            setTypingStatus(false, chatUid);
        }, 1200);
    } else {
        stopTypingStatus();
    }
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function getPreviewText(text) {
    const safeText = text || "No messages yet";
    return safeText.length > 30 ? safeText.slice(0, 30) + "..." : safeText;
}

function formatMessageTime(timestamp) {
    if (!timestamp) return "";

    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch (error) {
        return "";
    }
}

function getConversationId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
}

async function markConversationRead(conversationId) {
    if (!firebaseInitialized || !auth?.currentUser || !conversationId) return;

    try {
        const { doc, updateDoc, arrayRemove } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        await updateDoc(doc(db, "conversations", conversationId), {
            unreadBy: arrayRemove(auth.currentUser.uid)
        });
    } catch (error) {
        console.warn("Could not mark conversation as read:", error);
    }
}

// Stub functions for other features
function startCall() {
    showError("Call feature coming soon");
}

function startVideoCall() {
    showError("Video call feature coming soon");
}

function showEmoji() {
    showError("Emoji picker coming soon");
}

function attachFile() {
    showError("File sharing coming soon");
}

function openCamera() {
    showError("Camera feature coming soon");
}

function sendVoiceMessage() {
    showError("Voice message feature coming soon");
}
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
    
    const sortedChats = [...chats].sort((a, b) => {
        const aTime = a.updatedAt?.seconds ?? a.updatedAt?.toDate?.()?.getTime?.() / 1000 ?? 0;
        const bTime = b.updatedAt?.seconds ?? b.updatedAt?.toDate?.()?.getTime?.() / 1000 ?? 0;
        return bTime - aTime;
    });

    let html = "";
    for (const chat of sortedChats) {
        const otherUid = chat.participants?.find(uid => uid !== auth.currentUser.uid);
        if (!otherUid) continue;

        const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const userSnap = await getDocs(query(collection(db, "users"), where("uid", "==", otherUid)));
        const otherUser = userSnap.docs[0]?.data() || { displayName: "Unknown" };
        const unreadCount = Array.isArray(chat.unreadBy) ? chat.unreadBy.length : 0;
        const hasUnread = unreadCount > 0;
        const preview = getPreviewText(chat.lastMessage);
        const lastTime = formatMessageTime(chat.lastMessageTime || chat.updatedAt);
        const avatarMarkup = otherUser.photoURL
            ? `<img src="${otherUser.photoURL}" alt="Profile photo" />`
            : "👤";

        html += `
            <div class="chat-item ${hasUnread ? "unread" : ""}" onclick="openChat('${otherUid}')">
                <div class="avatar chat-avatar">${avatarMarkup}</div>
                <div class="chat-info">
                    <div class="chat-top">
                        <h3>${otherUser.displayName || "User"}</h3>
                        <span class="message-time">${lastTime}</span>
                    </div>
                    <div class="chat-bottom">
                        <p>${preview}</p>
                        ${hasUnread ? `<span class="unread-badge">${unreadCount}</span>` : ""}
                    </div>
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
        const avatarMarkup = user.photoURL
            ? `<img src="${user.photoURL}" alt="Profile photo" />`
            : "👤";

        html += `
            <div class="contact-item" onclick="startChatWithUser('${user.uid}', '${user.displayName || 'User'}')">
                <div class="contact-avatar">${avatarMarkup}</div>
                <div class="contact-info">
                    <h3>${user.displayName || "Unknown"}</h3>
                    <p>${user.email}${phoneDisplay}</p>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

async function loadContactsPage() {
    if (!firebaseInitialized || !auth?.currentUser) return;

    try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const snapshot = await getDocs(collection(db, "users"));
        const users = snapshot.docs
            .map(doc => doc.data())
            .filter(user => user.uid && user.uid !== auth.currentUser.uid)
            .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

        const container = document.getElementById("contactsResults");
        if (!container) return;

        if (!users.length) {
            container.innerHTML = '<div class="message received"><p>No contacts yet.</p></div>';
            return;
        }

        container.innerHTML = users.map((user) => {
            const avatarMarkup = user.photoURL
                ? `<img src="${user.photoURL}" alt="${user.displayName || "User"} profile" />`
                : "👤";
            return `
                <div class="contact-item" onclick="startChatWithUser('${user.uid}', '${user.displayName || 'User'}')">
                    <div class="contact-avatar">${avatarMarkup}</div>
                    <div class="contact-info">
                        <h3>${user.displayName || "Unknown"}</h3>
                        <p>${user.phone || user.email || "No contact info"}</p>
                    </div>
                </div>
            `;
        }).join("");
    } catch (error) {
        console.error("Error loading contacts:", error);
    }
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
        
        const conversationId = getConversationId(auth.currentUser.uid, uid);
        
        await setDoc(doc(db, "conversations", conversationId), {
            participants: [auth.currentUser.uid, uid],
            lastMessage: "",
            lastMessageSenderId: "",
            unreadBy: [],
            updatedAt: new Date()
        }, { merge: true });
        
        localStorage.setItem("currentChatUid", uid);
        localStorage.setItem("currentChatName", displayName);
        
        window.location.href = "chat.html";
        
    } catch (error) {
        console.error("Error starting chat:", error);
        showError("Failed to start chat");
    }
}

async function openChat(uid) {
    currentChatUid = uid;
    localStorage.setItem("currentChatUid", uid);

    const conversationId = getConversationId(auth.currentUser.uid, uid);
    await markMessagesAsRead(conversationId);
    await markConversationRead(conversationId);

    window.location.href = "chat.html";
}

function newChat() {
    window.location.href = "new-chat.html";
}

function goBack() {
    window.history.back();
}

function openMenu() {
    const choice = prompt("Menu:\n1. Profile\n2. Settings\n3. Logout\n\nEnter 1, 2, or 3:");
    
    if (choice === "1") {
        window.location.href = "profile.html";
    } else if (choice === "2") {
        window.location.href = "settings.html";
    } else if (choice === "3") {
        if (confirm("Are you sure you want to logout?")) {
            logout();
        }
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

    document.addEventListener("visibilitychange", async () => {
        if (!auth?.currentUser) return;
        if (document.visibilityState === "hidden") {
            await setCurrentUserPresence(false);
            stopTypingStatus();
        } else {
            await setCurrentUserPresence(true);
        }
    });

    window.addEventListener("beforeunload", () => {
        if (auth?.currentUser) {
            setCurrentUserPresence(false);
            stopTypingStatus();
        }
    });
    
    // Attach auth form listeners
    document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
    document.getElementById("signupForm")?.addEventListener("submit", handleSignup);
    document.getElementById("forgotPasswordForm")?.addEventListener("submit", handleForgotPassword);
    document.getElementById("resetPasswordForm")?.addEventListener("submit", handleResetPassword);
    document.querySelector(".google-button")?.addEventListener("click", handleGoogleLogin);

    const messageInput = document.getElementById("messageInput");
    if (messageInput) {
        messageInput.addEventListener("input", handleMessageInput);
        messageInput.addEventListener("blur", () => {
            stopTypingStatus();
        });
    }
    
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
        
        // Load profile if on profile or edit-profile page
        if (currentPage === "profile.html" || currentPage === "edit-profile.html") {
            await loadUserProfile();
        }

        // Load contacts page
        if (currentPage === "contacts.html") {
            await loadContactsPage();
        }
        
        // Load messages if on chat page
        if (currentPage === "chat.html") {
            await setCurrentUserPresence(true);
            await loadMessages();
        }
        
        if (currentPage === "chats.html") {
            await setCurrentUserPresence(true);
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
window.loadUserProfile = loadUserProfile;
window.saveProfile = saveProfile;
window.editProfileName = editProfileName;
window.editAbout = editAbout;
window.changeProfilePhoto = changeProfilePhoto;
window.toggleLoginPassword = toggleLoginPassword;
window.toggleSignupPassword = toggleSignupPassword;
window.toggleConfirmPassword = toggleConfirmPassword;
window.showDebug = showDebug;
window.loadMessages = loadMessages;
window.sendMessage = sendMessage;
window.handleEnter = handleEnter;
window.handleMessageInput = handleMessageInput;
window.showEmoji = showEmoji;
window.attachFile = attachFile;
window.openCamera = openCamera;
window.sendVoiceMessage = sendVoiceMessage;
window.startCall = startCall;
window.startVideoCall = startVideoCall;
