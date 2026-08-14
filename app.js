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
            if (profilePhoto && userData.photoURL) {
                profilePhoto.style.backgroundImage = `url('${userData.photoURL}')`;
                profilePhoto.textContent = "";
            }
            
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
            if (editProfilePhoto && userData.photoURL) {
                editProfilePhoto.style.backgroundImage = `url('${userData.photoURL}')`;
                editProfilePhoto.textContent = "";
            }
            
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

function changeProfilePhoto() {
    const photoURL = prompt("Enter photo URL:");
    if (photoURL) {
        const editPhotoURL = document.getElementById("editPhotoURL");
        if (editPhotoURL) {
            editPhotoURL.value = photoURL;
            const editProfilePhoto = document.getElementById("editProfilePhoto");
            if (editProfilePhoto) {
                editProfilePhoto.style.backgroundImage = `url('${photoURL}')`;
                editProfilePhoto.textContent = "";
            }
        }
    }
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
        if (chatHeader) chatHeader.textContent = chatName || "Chat";
        if (chatStatus) chatStatus.textContent = "online";
        
        const conversationId = getConversationId(auth.currentUser.uid, chatUid);
        await markConversationRead(conversationId);
        await setupMessageListener(conversationId);
        
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

async function setupMessageListener(conversationId) {
    try {
        const { collection, query, orderBy, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        const messagesRef = collection(db, "conversations", conversationId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        
        // Set up real-time listener
        if (messagesUnsubscribe) messagesUnsubscribe();
        
        messagesUnsubscribe = onSnapshot(q, (snapshot) => {
            const messagesContainer = document.getElementById("messages");
            messagesContainer.innerHTML = ""; // Clear previous messages
            
            snapshot.forEach((doc) => {
                const message = doc.data();
                const isOwn = message.senderId === auth.currentUser.uid;
                
                const messageEl = document.createElement("div");
                messageEl.className = `message ${isOwn ? "sent" : "received"}`;
                messageEl.innerHTML = `<p>${escapeHTML(message.text)}</p>`;
                
                messagesContainer.appendChild(messageEl);
            });
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
        
    } catch (error) {
        console.error("Error setting up listener:", error);
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
            createdAt: serverTimestamp()
        });

        await setDoc(doc(db, "conversations", conversationId), {
            participants: [auth.currentUser.uid, chatUid],
            lastMessage: text,
            lastMessageSenderId: auth.currentUser.uid,
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

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
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
    
    let html = "";
    for (const chat of chats) {
        const otherUid = chat.participants?.find(uid => uid !== auth.currentUser.uid);
        if (!otherUid) continue;

        const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const userSnap = await getDocs(query(collection(db, "users"), where("uid", "==", otherUid)));
        const otherUser = userSnap.docs[0]?.data() || { displayName: "Unknown" };
        const hasUnread = Array.isArray(chat.unreadBy) && chat.unreadBy.includes(auth.currentUser.uid);

        html += `
            <div class="chat-item ${hasUnread ? "unread" : ""}" onclick="openChat('${otherUid}')">
                <div class="chat-info">
                    <div class="chat-top">
                        <h3>${otherUser.displayName || "User"}</h3>
                        ${hasUnread ? '<span class="unread">1</span>' : ""}
                    </div>
                    <div class="chat-bottom">
                        <p>${chat.lastMessage || "No messages yet"}</p>
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
        
        // Load profile if on profile or edit-profile page
        if (currentPage === "profile.html" || currentPage === "edit-profile.html") {
            await loadUserProfile();
        }
        
        // Load messages if on chat page
        if (currentPage === "chat.html") {
            await loadMessages();
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
window.showEmoji = showEmoji;
window.attachFile = attachFile;
window.openCamera = openCamera;
window.sendVoiceMessage = sendVoiceMessage;
window.startCall = startCall;
window.startVideoCall = startVideoCall;
