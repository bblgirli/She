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
let userDataCache = {}; // Cache user data to avoid re-fetching
let firebaseModulesCache = {}; // Cache Firebase module imports

// Contacts and chats
let userContacts = [];
let chats = [];
let currentChatUid = null;
let chatListUnsubscribe = null;
let messagesUnsubscribe = null;
let presenceUnsubscribe = null;
let typingUnsubscribe = null;
let typingTimer = null;
let shownNotificationIds = new Set(); // Track shown notifications to avoid duplicates
let renderChatListDebounceTimer = null; // Debounce chat list rendering

// Voice recording
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingLocked = false;
let recordingStartTime = null;
let recordingTimerInterval = null;

// Audio analysis for pitch level
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationId = null;

// WebRTC calling
let peerConnection = null;
let currentCallState = null; // 'calling', 'ringing', 'connected', null
let callStream = null;
let incomingCallData = null;
let currentCallUid = null;
let callStartTime = null;
let callDurationInterval = null;
let callHistoryListener = null;

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

function showInfo(message) {
    const statusElement = document.getElementById("pageStatus")
        || document.getElementById("loginStatus")
        || document.getElementById("signupStatus")
        || document.getElementById("forgotStatus")
        || document.getElementById("resetStatus");
    
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = "status-message status-info";
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

// ============================================
// NOTIFICATIONS
// ============================================
async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("Notifications not supported");
        return false;
    }
    
    if (Notification.permission === "granted") {
        return true;
    }
    
    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }
    
    return false;
}

function showMessageNotification(senderName, messagePreview, senderUid) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    
    const currentUid = localStorage.getItem("currentChatUid");
    if (currentUid === senderUid) return;
    
    const cleanPreview = (messagePreview || "New message").toString().trim();
    const preview = cleanPreview.length > 100 ? cleanPreview.substring(0, 97) + "..." : cleanPreview;
    const notifId = `${senderUid}_${preview}`;
    if (shownNotificationIds.has(notifId)) return;
    shownNotificationIds.add(notifId);
    
    const notification = new Notification(senderName, {
        body: preview || "New message",
        icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23078b59%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2250%22 fill=%22white%22>💬</text></svg>",
        badge: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23078b59%22 width=%22100%22 height=%22100%22/></svg>",
        tag: `message_${senderUid}`
    });
    
    setTimeout(() => notification.close(), 6000);
    
    notification.onclick = () => {
        window.focus();
        startChatWithUser(senderUid, senderName);
    };
}

function setupBackgroundRefresh() {
    const currentPage = window.location.pathname.split("/").pop();
    const refreshablePages = new Set([
        "chats.html",
        "chat.html",
        "contacts.html",
        "calls.html",
        "status.html",
        "settings.html",
        "profile.html",
        "new-chat.html",
        "new-group.html",
        "group-info.html",
        "edit-profile.html"
    ]);

    if (!refreshablePages.has(currentPage)) return;

    const refreshAll = async () => {
        if (!firebaseInitialized || !auth?.currentUser) return;

        if (currentPage === "chats.html") await loadChats();
        if (currentPage === "chat.html") await loadMessages();
        if (currentPage === "contacts.html") await loadContactsPage();
        if (currentPage === "calls.html") await loadCallHistory();
        if (currentPage === "profile.html" || currentPage === "edit-profile.html") await loadUserProfile();
    };

    document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState !== "visible") return;
        await refreshAll();
    });

    window.addEventListener("focus", async () => {
        await refreshAll();
    });

    setInterval(() => {
        if (document.visibilityState !== "visible") {
            refreshAll();
        }
    }, 15000);
}

function openImageViewer(imageSrc, title = "Shared photo") {
    if (!imageSrc) return;

    const overlay = document.createElement("div");
    overlay.className = "image-viewer-backdrop";

    const modal = document.createElement("div");
    modal.className = "image-viewer-modal";

    const header = document.createElement("div");
    header.className = "image-viewer-header";
    header.innerHTML = `<span>${escapeHTML(title)}</span><button class="image-viewer-close" aria-label="Close image" onclick="this.closest('.image-viewer-backdrop').remove()">✕</button>`;

    const image = document.createElement("img");
    image.src = imageSrc;
    image.alt = title;
    image.className = "image-viewer-image";

    const actions = document.createElement("div");
    actions.className = "image-viewer-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "image-viewer-save";
    saveBtn.textContent = "Save image";
    saveBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = imageSrc;
        link.download = "she-photo";
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const closeBtn = document.createElement("button");
    closeBtn.className = "image-viewer-close-action";
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => overlay.remove();

    actions.appendChild(saveBtn);
    actions.appendChild(closeBtn);
    modal.appendChild(header);
    modal.appendChild(image);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) overlay.remove();
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

// ============================================
// VOICE RECORDING
// ============================================
async function startVoiceRecording() {
    if (isRecording) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
        
        // Set up audio context for pitch analysis
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            await sendAudioMessage(audioBlob);
            stream.getTracks().forEach(track => track.stop());
            audioContext.close();
            audioContext = null;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        };
        
        isRecording = true;
        recordingStartTime = Date.now();
        showRecordingUI();
        updateRecordingTime();
        recordingTimerInterval = setInterval(updateRecordingTime, 100);
        mediaRecorder.start();
        visualizePitchLevel();
        
    } catch (error) {
        console.error("Error accessing microphone:", error);
        showError("Microphone access denied");
    }
}

function stopVoiceRecording() {
    if (!isRecording || recordingLocked) return;
    
    isRecording = false;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
    clearInterval(recordingTimerInterval);
    hideRecordingUI();
}

function toggleLockRecording() {
    recordingLocked = !recordingLocked;
    const lockBtn = document.getElementById("lockRecordingBtn");
    if (lockBtn) {
        lockBtn.textContent = recordingLocked ? "🔒" : "🔓";
        lockBtn.classList.toggle("locked", recordingLocked);
    }
}

function showRecordingUI() {
    const ui = document.getElementById("voiceRecordingUI");
    if (ui) ui.style.display = "flex";
}

function hideRecordingUI() {
    const ui = document.getElementById("voiceRecordingUI");
    if (ui) ui.style.display = "none";
    recordingLocked = false;
    const lockBtn = document.getElementById("lockRecordingBtn");
    if (lockBtn) {
        lockBtn.textContent = "🔓";
        lockBtn.classList.remove("locked");
    }
}

function updateRecordingTime() {
    if (!recordingStartTime) return;
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    const timeEl = document.getElementById("recordingTime");
    if (timeEl) timeEl.textContent = timeStr;
}

function visualizePitchLevel() {
    if (!isRecording || !analyser || !dataArray) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average frequency level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    
    // Normalize to 0-100
    const level = Math.min(100, (average / 255) * 120);
    
    // Update pitch level bars
    const bars = document.querySelectorAll(".pitch-bar");
    const barCount = bars.length;
    
    bars.forEach((bar, index) => {
        const barLevel = (level / 100) * barCount;
        if (index < barLevel) {
            bar.classList.add("active");
        } else {
            bar.classList.remove("active");
        }
    });
    
    animationId = requestAnimationFrame(visualizePitchLevel);
}

async function sendAudioMessage(audioBlob) {
    if (!auth?.currentUser || !db) return;
    
    try {
        const conversationId = getConversationId(auth.currentUser.uid, localStorage.getItem("currentChatUid"));
        
        // Convert blob to base64 for smaller storage
        const reader = new FileReader();
        reader.onload = async (e) => {
            const audioData = e.target.result;
            
            const { doc, collection, addDoc, serverTimestamp, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            
            // Add message with audio data
            const messageDocRef = await addDoc(collection(db, "conversations", conversationId, "messages"), {
                senderId: auth.currentUser.uid,
                audioData: audioData, // base64 encoded audio
                text: "[Voice message]",
                status: "sent",
                createdAt: serverTimestamp()
            });
            
            // Update conversation
            await updateDoc(doc(db, "conversations", conversationId), {
                lastMessage: "[Voice message]",
                lastMessageSenderId: auth.currentUser.uid,
                lastMessageTime: serverTimestamp(),
                updatedAt: serverTimestamp(),
                unreadBy: [localStorage.getItem("currentChatUid")]
            });
            
            // Set message to read for sender
            await updateDoc(doc(db, "conversations", conversationId, "messages", messageDocRef.id), {
                status: "read"
            });
        };
        reader.readAsDataURL(audioBlob);
        
    } catch (error) {
        console.error("Error sending audio message:", error);
        showError("Failed to send voice message");
    }
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
            // Check Firestore first, then localStorage as fallback
            const photoURL = userData.photoData || getProfilePhotoFromStorage(auth.currentUser.uid);
            
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
            setAvatarElement(profilePhoto, photoURL, "👤");
            
            // Load into edit page
            const editName = document.getElementById("editName");
            const editAbout = document.getElementById("editAbout");
            const editPhotoURL = document.getElementById("editPhotoURL");
            const editPhone = document.getElementById("editPhone");
            const editProfilePhoto = document.getElementById("editProfilePhoto");
            
            if (editName) editName.value = userData.displayName || "";
            if (editAbout) editAbout.value = userData.about || "";
            if (editPhotoURL) editPhotoURL.value = photoURL ? "[Photo stored]" : "";
            if (editPhone) editPhone.value = userData.phone || "";
            setAvatarElement(editProfilePhoto, photoURL, "👤");
            
            // Cache in localStorage for next load
            if (photoURL) {
                localStorage.setItem(`profilePhoto_${auth.currentUser.uid}`, photoURL);
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

async function compressImage(file, maxWidth = 150, maxHeight = 150, quality = 0.4) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = () => {
                console.error("Error loading image");
                showError("Failed to process image");
                resolve("");
            };
            img.src = event.target?.result || "";
        };
        reader.onerror = () => {
            console.error("Error reading file");
            showError("Failed to read image");
            resolve("");
        };
        reader.readAsDataURL(file);
    });
}

async function uploadProfilePhoto(file) {
    if (!file || !auth?.currentUser) {
        return "";
    }

    const compressedURL = await compressImage(file, 150, 150, 0.4);
    if (!compressedURL) return "";

    // Store compressed image in Firestore
    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            photoData: compressedURL
        });
    } catch (error) {
        console.error("Error saving photo to Firestore:", error);
        showError("Failed to sync photo");
        return "";
    }

    // Also store locally for instant display
    const storageKey = `profilePhoto_${auth.currentUser.uid}`;
    localStorage.setItem(storageKey, compressedURL);

    return compressedURL;
}

function getProfilePhotoFromStorage(uid) {
    const storageKey = `profilePhoto_${uid}`;
    return localStorage.getItem(storageKey) || "";
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
    let chatName = localStorage.getItem("currentChatName");
    
    if (!chatUid || !firebaseInitialized || !auth?.currentUser) {
        console.error("Missing chat info");
        return;
    }
    
    try {
        const chatHeader = document.querySelector(".chat-profile h3");
        const chatStatus = document.querySelector(".chat-profile p");
        const chatAvatar = document.querySelector(".small-avatar");
        
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const userSnap = await getDoc(doc(db, "users", chatUid));
        const otherUserData = userSnap.data() || {};
        
        // If no name in localStorage, get from Firestore
        if (!chatName) {
            chatName = otherUserData.displayName || "User";
            localStorage.setItem("currentChatName", chatName);
        }
        
        if (chatHeader) chatHeader.textContent = chatName || "Chat";
        if (chatStatus) chatStatus.textContent = "online";
        setAvatarElement(chatAvatar, otherUserData.photoData, "👤");
        
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

            if (userData.photoData) {
                setAvatarElement(avatarEl, userData.photoData, "👤");
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
        const { collection, query, orderBy, onSnapshot, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        const messagesRef = collection(db, "conversations", conversationId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        
        if (messagesUnsubscribe) messagesUnsubscribe();
        
        let isFirstLoad = true;
        
        messagesUnsubscribe = onSnapshot(q, async (snapshot) => {
            const messagesContainer = document.getElementById("messages");
            if (!messagesContainer) return;

            await markMessagesAsDelivered(conversationId);

            // Check for new incoming messages
            if (!isFirstLoad) {
                for (const messageDoc of snapshot.docChanges()) {
                    if (messageDoc.type === "added") {
                        const message = messageDoc.doc.data();
                        const isIncoming = message.senderId !== auth.currentUser.uid;
                        
                        if (isIncoming) {
                            // Fetch sender's display name
                            const senderSnap = await getDoc(doc(db, "users", message.senderId));
                            const senderData = senderSnap.data() || {};
                            const senderName = senderData.displayName || "User";
                            
                            // Show notification
                            showMessageNotification(senderName, message.text, message.senderId);
                        }
                    }
                }
            }
            
            isFirstLoad = false;

            messagesContainer.innerHTML = "";
            snapshot.forEach((messageDoc) => {
                const message = messageDoc.data();
                const isOwn = message.senderId === auth.currentUser.uid;
                const messageStatus = message.status || "sent";
                const messageTime = formatMessageTime(message.createdAt);

                const messageEl = document.createElement("div");
                messageEl.className = `message ${isOwn ? "sent" : "received"}`;
                
                // Check if this is an audio message
                if (message.audioData) {
                    messageEl.innerHTML = `
                        <div class="message-body">
                            <div class="voice-note-bubble">
                                <button class="voice-play-btn" onclick="playAudio('${messageDoc.id}', this)">▶️</button>
                                <audio id="audio-${messageDoc.id}" class="audio-player" onloadedmetadata="updateAudioDuration('${messageDoc.id}')">
                                    <source src="${message.audioData}" type="audio/webm" />
                                </audio>
                                <div class="voice-info">
                                    <div class="voice-progress">
                                        <div class="voice-progress-bar"></div>
                                    </div>
                                    <span class="voice-duration" id="duration-${messageDoc.id}">0:00</span>
                                </div>
                            </div>
                        </div>
                        <div class="message-meta">
                            <span class="message-time-inline">${messageTime}</span>
                            ${isOwn ? `<span class="status-ticks ${messageStatus}">${getStatusTicks(messageStatus)}</span>` : ""}
                        </div>
                    `;
                } else if (message.imageData) {
                    messageEl.innerHTML = `
                        <div class="message-body">
                            <img src="${message.imageData}" alt="Shared image" class="message-image" />
                        </div>
                        <div class="message-meta">
                            <span class="message-time-inline">${messageTime}</span>
                            ${isOwn ? `<span class="status-ticks ${messageStatus}">${getStatusTicks(messageStatus)}</span>` : ""}
                        </div>
                    `;
                } else {
                    messageEl.innerHTML = `
                        <div class="message-body">
                            <p>${escapeHTML(message.text)}</p>
                        </div>
                        <div class="message-meta">
                            <span class="message-time-inline">${messageTime}</span>
                            ${isOwn ? `<span class="status-ticks ${messageStatus}">${getStatusTicks(messageStatus)}</span>` : ""}
                        </div>
                    `;
                }

                messagesContainer.appendChild(messageEl);
            });

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
        
    } catch (error) {
        console.error("Error setting up listener:", error);
    }
}

function playAudio(messageId, buttonEl) {
    const audio = document.getElementById(`audio-${messageId}`);
    if (!audio) return;
    
    if (audio.paused) {
        audio.play();
        buttonEl.textContent = "⏸️";
        
        // Update progress bar
        const updateInterval = setInterval(() => {
            if (audio.paused || audio.ended) {
                clearInterval(updateInterval);
                buttonEl.textContent = "▶️";
                return;
            }
            
            const progress = document.querySelector(`#audio-${messageId}`).nextElementSibling?.querySelector(".voice-progress-bar");
            if (progress && audio.duration) {
                const percent = (audio.currentTime / audio.duration) * 100;
                progress.style.width = percent + "%";
            }
        }, 100);
    } else {
        audio.pause();
        buttonEl.textContent = "▶️";
    }
    
    audio.onended = () => {
        buttonEl.textContent = "▶️";
    };
}

function updateAudioDuration(messageId) {
    const audio = document.getElementById(`audio-${messageId}`);
    const durationEl = document.getElementById(`duration-${messageId}`);
    
    if (audio && durationEl && audio.duration) {
        const mins = Math.floor(audio.duration / 60);
        const secs = Math.floor(audio.duration % 60);
        durationEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
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
    const hasText = value.length > 0;

    // Toggle button visibility based on input
    const sendBtn = document.getElementById("sendBtn");
    const cameraBtn = document.getElementById("cameraBtn");
    const voiceBtn = document.getElementById("voiceBtn");
    
    if (sendBtn) sendBtn.style.display = hasText ? "flex" : "none";
    if (cameraBtn) cameraBtn.style.display = hasText ? "none" : "flex";
    if (voiceBtn) voiceBtn.style.display = hasText ? "none" : "flex";

    if (!chatUid || !firebaseInitialized || !auth?.currentUser) return;

    if (hasText) {
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
    if (!localStorage.getItem("currentChatUid")) {
        showError("No chat selected");
        return;
    }
    initiateCall();
}

async function initiateCall() {
    if (peerConnection) {
        showError("Call already in progress");
        return;
    }
    
    if (!auth?.currentUser || !db) return;
    
    try {
        currentCallUid = localStorage.getItem("currentChatUid");
        const configuration = {
            iceServers: [
                { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
            ]
        };
        
        peerConnection = new RTCPeerConnection(configuration);
        callStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        callStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, callStream);
        });
        
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                const { doc, collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
                const conversationId = getConversationId(auth.currentUser.uid, currentCallUid);
                
                await addDoc(collection(db, "conversations", conversationId, "calls", localStorage.getItem("callSessionId"), "iceCandidates"), {
                    candidate: event.candidate.candidate,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    sdpMid: event.candidate.sdpMid,
                    createdAt: new Date()
                });
            }
        };
        
        peerConnection.ontrack = (event) => {
            console.log("Received remote track:", event.track);
            const remoteAudio = document.getElementById("remoteAudio");
            if (remoteAudio && event.streams[0]) {
                remoteAudio.srcObject = event.streams[0];
            }
        };
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        const callSessionId = Date.now().toString();
        localStorage.setItem("callSessionId", callSessionId);
        currentCallState = "calling";
        showOutgoingCallScreen();
        
        const { doc, collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const conversationId = getConversationId(auth.currentUser.uid, currentCallUid);
        
        await addDoc(collection(db, "conversations", conversationId, "calls"), {
            callSessionId: callSessionId,
            callerId: auth.currentUser.uid,
            receiverId: currentCallUid,
            offer: offer.sdp,
            status: "calling",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Listen for answer
        const { query, where, onSnapshot, Query } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const callsRef = collection(db, "conversations", conversationId, "calls");
        const q = query(callsRef, where("callSessionId", "==", callSessionId));
        
        onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "modified") {
                    const callDoc = change.doc.data();
                    if (callDoc.answer && !peerConnection.remoteDescription) {
                        currentCallState = "connected";
                        hideOutgoingCallScreen();
                        showOngoingCallScreen();
                        
                        const remoteDescription = new RTCSessionDescription({
                            type: "answer",
                            sdp: callDoc.answer
                        });
                        await peerConnection.setRemoteDescription(remoteDescription);
                    }
                }
            });
        });
        
    } catch (error) {
        console.error("Error initiating call:", error);
        showError("Failed to start call");
        endCall();
    }
}

async function handleIncomingCall() {
    if (!db || !auth?.currentUser) return;
    
    try {
        const { collectionGroup, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        // Listen for incoming calls across all conversations using collectionGroup
        const callsRef = collectionGroup(db, "calls");
        const q = query(callsRef, where("receiverId", "==", auth.currentUser.uid), where("status", "==", "calling"));
        
        onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added" && !incomingCallData && !peerConnection) {
                    const callData = change.doc.data();
                    const docPath = change.doc.ref.path; // e.g., conversations/{id}/calls/{docId}
                    const conversationId = docPath.split("/")[1];
                    
                    incomingCallData = { 
                        ...callData, 
                        docId: change.doc.id, 
                        conversationId,
                        docRef: change.doc.ref
                    };
                    console.log("Incoming call from:", callData.callerId, "in conversation:", conversationId);
                    showIncomingCallScreen();
                }
            });
        });
        
    } catch (error) {
        console.error("Error setting up incoming call listener:", error);
    }
}

async function answerCall() {
    if (!incomingCallData || !auth?.currentUser || !db) return;
    
    try {
        const configuration = {
            iceServers: [
                { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
            ]
        };
        
        peerConnection = new RTCPeerConnection(configuration);
        callStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        callStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, callStream);
        });
        
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                const { doc, collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
                
                await addDoc(collection(db, "conversations", incomingCallData.conversationId, "calls", incomingCallData.callSessionId, "iceCandidates"), {
                    candidate: event.candidate.candidate,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    sdpMid: event.candidate.sdpMid,
                    createdAt: new Date()
                });
            }
        };
        
        peerConnection.ontrack = (event) => {
            console.log("Received remote track:", event.track);
            const remoteAudio = document.getElementById("remoteAudio");
            if (remoteAudio && event.streams[0]) {
                remoteAudio.srcObject = event.streams[0];
            }
        };
        
        const remoteDescription = new RTCSessionDescription({
            type: "offer",
            sdp: incomingCallData.offer
        });
        await peerConnection.setRemoteDescription(remoteDescription);
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        await updateDoc(incomingCallData.docRef, {
            answer: answer.sdp,
            status: "connected",
            updatedAt: new Date()
        });
        
        currentCallState = "connected";
        currentCallUid = incomingCallData.callerId;
        currentCallState = "connected";
        hideIncomingCallScreen();
        showOngoingCallScreen();
        callStartTime = Date.now();
        startCallDurationTimer();
        
    } catch (error) {
        console.error("Error answering call:", error);
        showError("Failed to answer call");
        declineCall();
    }
}

async function declineCall() {
    if (!incomingCallData || !db) return;
    
    try {
        const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        await updateDoc(incomingCallData.docRef, {
            status: "declined",
            updatedAt: new Date()
        });
        
        hideIncomingCallScreen();
        incomingCallData = null;
        
    } catch (error) {
        console.error("Error declining call:", error);
    }
}

async function endCall() {
    if (!auth?.currentUser || !db) return;
    
    try {
        // Stop media tracks
        if (callStream) {
            callStream.getTracks().forEach(track => track.stop());
            callStream = null;
        }
        
        // Close peer connection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        // Update call status in Firestore
        if (currentCallUid) {
            const conversationId = getConversationId(auth.currentUser.uid, currentCallUid);
            const callSessionId = localStorage.getItem("callSessionId");
            
            if (callSessionId) {
                const { query, where, getDocs, doc, updateDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
                const callsRef = collection(db, "conversations", conversationId, "calls");
                const q = query(callsRef, where("callSessionId", "==", callSessionId));
                const querySnapshot = await getDocs(q);
                
                querySnapshot.forEach(async (callDoc) => {
                    await updateDoc(callDoc.ref, {
                        status: "ended",
                        duration: Math.floor((Date.now() - callStartTime) / 1000),
                        updatedAt: new Date()
                    });
                });
            }
        }
        
        // Save to call history
        if (callStartTime) {
            const duration = Math.floor((Date.now() - callStartTime) / 1000);
            const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            
            await addDoc(collection(db, "users", auth.currentUser.uid, "callHistory"), {
                contactUid: currentCallUid,
                duration: duration,
                timestamp: serverTimestamp(),
                type: incomingCallData ? "incoming" : "outgoing"
            });
        }
        
        // Clear call state
        currentCallState = null;
        currentCallUid = null;
        callStartTime = null;
        if (callDurationInterval) {
            clearInterval(callDurationInterval);
            callDurationInterval = null;
        }
        
        hideOngoingCallScreen();
        hideOutgoingCallScreen();
        incomingCallData = null;
        localStorage.removeItem("callSessionId");
        
    } catch (error) {
        console.error("Error ending call:", error);
    }
}

function showIncomingCallScreen() {
    const screen = document.getElementById("incomingCallScreen");
    if (screen) {
        screen.style.display = "flex";
        const callerName = localStorage.getItem(`user_${incomingCallData.callerId}_name`) || "Unknown";
        const callerElement = document.getElementById("incomingCallerName");
        if (callerElement) callerElement.textContent = callerName;
    }
}

function hideIncomingCallScreen() {
    const screen = document.getElementById("incomingCallScreen");
    if (screen) screen.style.display = "none";
}

function showOutgoingCallScreen() {
    const screen = document.getElementById("outgoingCallScreen");
    if (screen) {
        screen.style.display = "flex";
        const receiverName = localStorage.getItem("currentChatName") || "Unknown";
        const receiverElement = document.getElementById("outgoingCalleeName");
        if (receiverElement) receiverElement.textContent = receiverName;
    }
}

function hideOutgoingCallScreen() {
    const screen = document.getElementById("outgoingCallScreen");
    if (screen) screen.style.display = "none";
}

function showOngoingCallScreen() {
    const screen = document.getElementById("ongoingCallScreen");
    if (screen) {
        screen.style.display = "flex";
        callStartTime = Date.now();
        startCallDurationTimer();
    }
}

function hideOngoingCallScreen() {
    const screen = document.getElementById("ongoingCallScreen");
    if (screen) screen.style.display = "none";
    if (callDurationInterval) {
        clearInterval(callDurationInterval);
        callDurationInterval = null;
    }
}

function startCallDurationTimer() {
    if (callDurationInterval) clearInterval(callDurationInterval);
    
    callDurationInterval = setInterval(() => {
        if (callStartTime) {
            const duration = Math.floor((Date.now() - callStartTime) / 1000);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            const durationStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
            const durationElement = document.getElementById("callDuration");
            if (durationElement) durationElement.textContent = durationStr;
        }
    }, 1000);
}

function startVideoCall() {
    showError("Video call feature coming soon");
}

function showEmoji() {
    showError("Emoji picker coming soon");
}

async function attachFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";

    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        try {
            // Compress image
            const compressedData = await compressImage(file);
            await sendImageMessage(compressedData);
        } catch (error) {
            console.error("Error sending image:", error);
            showError("Failed to send image");
        }
    };

    document.body.appendChild(input);
    input.click();
    input.remove();
}

async function sendImageMessage(imageData) {
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
            text: "[Image]",
            imageData: imageData,
            createdAt: serverTimestamp(),
            status: "sent"
        });

        await setDoc(doc(db, "conversations", conversationId), {
            participants: [auth.currentUser.uid, chatUid],
            lastMessage: "[Image]",
            lastMessageSenderId: auth.currentUser.uid,
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp(),
            unreadBy: [chatUid]
        }, { merge: true });
        
        showSuccess("Image sent!");
        
    } catch (error) {
        console.error("Error sending image message:", error);
        showError("Failed to send image");
    }
}

async function openCamera() {
    try {
        // Request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" },
            audio: false 
        });
        
        // Create video element
        const video = document.createElement("video");
        video.srcObject = stream;
        video.play();
        
        // Create canvas for capture
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        // Set dimensions
        canvas.width = 640;
        canvas.height = 480;
        
        // Create modal with video feed
        const modal = document.createElement("div");
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        video.style.cssText = `
            width: 90%;
            max-width: 500px;
            border-radius: 10px;
            margin-bottom: 20px;
        `;
        
        const buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
        `;
        
        const captureBtn = document.createElement("button");
        captureBtn.textContent = "📷 Capture";
        captureBtn.style.cssText = `
            padding: 12px 24px;
            background: #078b59;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
        `;
        
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "✕ Close";
        closeBtn.style.cssText = `
            padding: 12px 24px;
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
        `;
        
        captureBtn.onclick = () => {
            video.play();
            setTimeout(() => {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(async (blob) => {
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const photoData = e.target.result;
                        
                        // Use for profile photo
                        const editPhotoURL = document.getElementById("editPhotoURL");
                        if (editPhotoURL) editPhotoURL.value = photoData;
                        
                        const editProfilePhoto = document.getElementById("editProfilePhoto");
                        if (editProfilePhoto) setAvatarElement(editProfilePhoto, photoData, "👤");
                        
                        // Close modal
                        stream.getTracks().forEach(track => track.stop());
                        document.body.removeChild(modal);
                        
                        showSuccess("Photo captured!");
                    };
                    reader.readAsDataURL(blob);
                }, "image/jpeg", 0.8);
            }, 100);
        };
        
        closeBtn.onclick = () => {
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(modal);
        };
        
        buttonContainer.appendChild(captureBtn);
        buttonContainer.appendChild(closeBtn);
        
        modal.appendChild(video);
        modal.appendChild(buttonContainer);
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error("Camera access error:", error);
        if (error.name === "NotAllowedError") {
            showError("Camera permission denied. Please enable in settings.");
        } else if (error.name === "NotFoundError") {
            showError("No camera found on this device");
        } else {
            showError("Failed to access camera");
        }
    }
}

async function requestAllPermissions() {
    const permissions = [
        { name: "notification", fn: requestNotificationPermission },
        { name: "microphone", fn: requestMicrophonePermission },
        { name: "camera", fn: requestCameraPermission },
        { name: "media", fn: requestMediaPermission }
    ];
    
    let grantedCount = 0;
    
    for (const perm of permissions) {
        try {
            const granted = await perm.fn();
            if (granted) {
                grantedCount++;
                const checkbox = document.getElementById(`perm-${perm.name}`);
                if (checkbox) checkbox.checked = true;
            }
        } catch (error) {
            console.error(`Error requesting ${perm.name}:`, error);
        }
    }
    
    localStorage.setItem("permissionsRequested", "true");
    setTimeout(() => {
        const dialog = document.getElementById("permissionsDialog");
        if (dialog) dialog.style.display = "none";
    }, 1000);
    
    showSuccess(`Permissions: ${grantedCount}/${permissions.length} granted`);
}

async function skipPermissions() {
    localStorage.setItem("permissionsRequested", "true");
    const dialog = document.getElementById("permissionsDialog");
    if (dialog) dialog.style.display = "none";
    showInfo("You can enable permissions anytime from the menu");
}

async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        localStorage.setItem("microphonePermission", "granted");
        return true;
    } catch (error) {
        console.error("Microphone permission denied:", error);
        return false;
    }
}

async function requestCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        localStorage.setItem("cameraPermission", "granted");
        return true;
    } catch (error) {
        console.error("Camera permission denied:", error);
        return false;
    }
}

async function requestMediaPermission() {
    // Media permission is typically granted by allowing file input
    // We can use a hidden file input to test this
    try {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/*";
        
        return new Promise((resolve) => {
            input.onchange = () => {
                localStorage.setItem("mediaPermission", "granted");
                resolve(true);
            };
            input.click();
            setTimeout(() => resolve(false), 5000);
        });
    } catch (error) {
        console.error("Media permission error:", error);
        return false;
    }
}

function showPermissionsDialog() {
    if (localStorage.getItem("permissionsRequested")) return;
    
    const dialog = document.getElementById("permissionsDialog");
    if (dialog) {
        dialog.style.display = "flex";
    }
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

function renderChatList() {
    const container = document.getElementById("chatList") || document.querySelector(".chat-list");
    if (!container) return;
    
    // Debounce rapid re-renders
    if (renderChatListDebounceTimer) clearTimeout(renderChatListDebounceTimer);
    renderChatListDebounceTimer = setTimeout(async () => {
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
    
            // Check cache first
            let otherUser = userDataCache[otherUid];
            if (!otherUser) {
                // Only fetch if not cached
                try {
                    const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
                    const userSnap = await getDocs(query(collection(db, "users"), where("uid", "==", otherUid)));
                    otherUser = userSnap.docs[0]?.data() || { displayName: "Unknown" };
                    userDataCache[otherUid] = otherUser; // Cache it
                } catch (error) {
                    console.error("Error fetching user:", error);
                    otherUser = { displayName: "Unknown" };
                }
            }
            
            const unreadCount = Array.isArray(chat.unreadBy) ? chat.unreadBy.length : 0;
            const hasUnread = unreadCount > 0;
            const preview = getPreviewText(chat.lastMessage);
            const lastTime = formatMessageTime(chat.lastMessageTime || chat.updatedAt);
            const avatarMarkup = otherUser.photoData
                ? `<img src="${otherUser.photoData}" alt="Profile photo" />`
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
    }, 100);
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
        const avatarMarkup = user.photoData
            ? `<img src="${user.photoData}" alt="Profile photo" />`
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

async function loadStatusUpdates() {
    if (!firebaseInitialized || !auth?.currentUser) return;

    try {
        const { collection, query, orderBy, getDocs, getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const statusRef = collection(db, "status");
        const q = query(statusRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const allStatuses = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        const byUser = new Map();
        for (const status of allStatuses) {
            if (!status.userId) continue;
            if (!byUser.has(status.userId)) {
                byUser.set(status.userId, status);
            }
        }

        const statusEntries = [...byUser.values()].sort((a, b) => {
            const at = a.createdAt?.seconds || 0;
            const bt = b.createdAt?.seconds || 0;
            return bt - at;
        });

        const currentUserDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const currentUserName = currentUserDoc.data()?.displayName || "My Status";

        const container = document.querySelector(".status-list");
        if (!container) return;

        const ownStatus = statusEntries.find(item => item.userId === auth.currentUser.uid);
        const recentStatuses = statusEntries.filter(item => item.userId !== auth.currentUser.uid);

        const myStatusMarkup = ownStatus ? `
            <div class="my-status" onclick="viewStatus('${ownStatus.userId}', '${escapeHTML(currentUserName)}')">
                <div class="status-avatar">${ownStatus.imageData ? `<img src="${ownStatus.imageData}" alt="My status" />` : "👤"}</div>
                <div class="status-details">
                    <h3>My Status</h3>
                    <p>${ownStatus.text || "Tap to view your last update"}</p>
                </div>
            </div>
        ` : `
            <div class="my-status" onclick="addStatus()">
                <div class="status-avatar"><span>👤</span><button class="add-status">+</button></div>
                <div class="status-details">
                    <h3>My Status</h3>
                    <p>Tap to add status update</p>
                </div>
            </div>
        `;

        const recentMarkup = recentStatuses.length
            ? recentStatuses.map((status) => {
                const userInfo = status.userName || "User";
                const meta = status.createdAt?.toDate ? status.createdAt.toDate() : new Date();
                const preview = status.text || "Shared an image";
                const avatar = status.userPhoto ? `<img src="${status.userPhoto}" alt="${userInfo}" />` : "👤";
                return `
                    <div class="status-item" onclick="viewStatus('${status.userId}', '${escapeHTML(userInfo)}')">
                        <div class="status-ring"><div class="status-avatar">${avatar}</div></div>
                        <div class="status-details">
                            <h3>${userInfo}</h3>
                            <p>${preview.slice(0, 30)}${preview.length > 30 ? "..." : ""}</p>
                        </div>
                    </div>
                `;
            }).join("")
            : '<div class="message received"><p>No recent updates yet.</p></div>';

        container.innerHTML = `${myStatusMarkup}<h4 class="section-title">Recent updates</h4>${recentMarkup}`;
    } catch (error) {
        console.error("Error loading status updates:", error);
    }
}

async function addStatus() {
    if (!firebaseInitialized || !auth?.currentUser) return;

    const message = prompt("Write a status update (leave blank for a photo only):", "");
    const file = await new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.style.display = "none";
        input.onchange = () => resolve(input.files?.[0] || null);
        document.body.appendChild(input);
        input.click();
        input.remove();
    });

    try {
        const { collection, addDoc, serverTimestamp, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        let imageData = "";

        if (file) {
            const reader = new FileReader();
            const result = await new Promise((resolve, reject) => {
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            imageData = result;
        }

        const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
        const userData = userSnap.data() || {};

        await addDoc(collection(db, "status"), {
            userId: auth.currentUser.uid,
            userName: userData.displayName || auth.currentUser.email || "Me",
            userPhoto: userData.photoData || "",
            text: message || (imageData ? "Shared a photo" : "New status"),
            imageData,
            createdAt: serverTimestamp()
        });

        showSuccess("Status updated");
        await loadStatusUpdates();
    } catch (error) {
        console.error("Error adding status:", error);
        showError("Failed to update status");
    }
}

async function viewStatus(userId, userName = "User") {
    if (!firebaseInitialized || !auth?.currentUser) return;

    try {
        const { collection, query, where, orderBy, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const q = query(collection(db, "status"), where("userId", "==", userId), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const statuses = snapshot.docs.map(doc => doc.data());

        if (!statuses.length) {
            showInfo("No status update available");
            return;
        }

        const overlay = document.createElement("div");
        overlay.className = "image-viewer-backdrop";
        overlay.innerHTML = `
            <div class="image-viewer-modal">
                <div class="image-viewer-header">
                    <span>${escapeHTML(userName)}</span>
                    <button class="image-viewer-close" type="button">✕</button>
                </div>
                <div class="status-viewer-body">
                    ${statuses[0].imageData ? `<img src="${statuses[0].imageData}" class="image-viewer-image" alt="Status image" />` : ""}
                    <p class="status-viewer-text">${escapeHTML(statuses[0].text || "Shared an update")}</p>
                </div>
                <div class="image-viewer-actions">
                    <button class="image-viewer-close-action" type="button">Close</button>
                </div>
            </div>
        `;

        const closeButtons = overlay.querySelectorAll(".image-viewer-close, .image-viewer-close-action");
        closeButtons.forEach(btn => btn.addEventListener("click", () => overlay.remove()));
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
    } catch (error) {
        console.error("Error viewing status:", error);
    }
}

async function createGroup() {
    if (!firebaseInitialized || !auth?.currentUser) return;

    const groupName = prompt("Group name:", "My Group");
    if (!groupName || !groupName.trim()) return;

    const extraMembers = prompt("Add members by comma-separated email addresses (optional):", "");
    const memberEmails = extraMembers ? extraMembers.split(",").map(item => item.trim()).filter(Boolean) : [];

    try {
        const { collection, addDoc, getDocs, query, where, arrayUnion, doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        const matchedMemberIds = [];

        for (const memberEmail of memberEmails) {
            const match = usersSnapshot.docs.find(userDoc => {
                const userData = userDoc.data();
                return (userData.email || "").toLowerCase() === memberEmail.toLowerCase();
            });
            if (match) matchedMemberIds.push(match.data().uid);
        }

        const groupRef = await addDoc(collection(db, "groups"), {
            name: groupName.trim(),
            createdBy: auth.currentUser.uid,
            members: Array.from(new Set([auth.currentUser.uid, ...matchedMemberIds])),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        localStorage.setItem("currentGroupId", groupRef.id);
        localStorage.setItem("currentGroupName", groupName.trim());
        showSuccess("Group created");
        setTimeout(() => window.location.href = "group-info.html", 500);
    } catch (error) {
        console.error("Error creating group:", error);
        showError("Failed to create group");
    }
}

async function createContact() {
    const email = prompt("Add a contact by email address:", "");
    if (!email || !email.trim()) return;

    if (!firebaseInitialized || !auth?.currentUser) return;

    try {
        const { collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email.trim().toLowerCase()));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showInfo("No user found with that email");
            return;
        }

        const user = snapshot.docs[0].data();
        if (user.uid === auth.currentUser.uid) {
            showInfo("That is your own account");
            return;
        }

        const displayName = user.displayName || "User";
        startChatWithUser(user.uid, displayName);
    } catch (error) {
        console.error("Error adding contact:", error);
        showError("Could not add contact");
    }
}

async function addParticipant() {
    if (!firebaseInitialized || !auth?.currentUser) return;

    const email = prompt("Add a participant by email:", "");
    if (!email || !email.trim()) return;

    const groupId = localStorage.getItem("currentGroupId");
    if (!groupId) {
        showInfo("Open a group first");
        return;
    }

    try {
        const { collection, getDocs, query, where, doc, updateDoc, arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const q = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            showInfo("No matching user found");
            return;
        }
        const userData = snapshot.docs[0].data();
        await updateDoc(doc(db, "groups", groupId), {
            members: arrayUnion(userData.uid)
        });
        showSuccess("Participant added");
    } catch (error) {
        console.error("Error adding participant:", error);
        showError("Failed to add participant");
    }
}

async function leaveGroup() {
    const groupId = localStorage.getItem("currentGroupId");
    if (!groupId || !auth?.currentUser) return;

    try {
        const { doc, updateDoc, arrayRemove } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        await updateDoc(doc(db, "groups", groupId), {
            members: arrayRemove(auth.currentUser.uid)
        });
        showSuccess("Left group");
        setTimeout(() => window.location.href = "chats.html", 500);
    } catch (error) {
        console.error("Error leaving group:", error);
        showError("Could not leave group");
    }
}

async function loadGroupSuggestions() {
    if (!firebaseInitialized || !auth?.currentUser) return;

    try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const snapshot = await getDocs(collection(db, "users"));
        const users = snapshot.docs
            .map(doc => doc.data())
            .filter(user => user.uid && user.uid !== auth.currentUser.uid)
            .slice(0, 8);

        const container = document.querySelector(".new-chat-list");
        if (!container || !users.length) return;

        const existingHeader = container.querySelector(".section-title");
        if (existingHeader) {
            const suggestionBox = document.createElement("div");
            suggestionBox.className = "group-suggestions";
            suggestionBox.innerHTML = users.map(user => `
                <button class="group-suggestion" onclick="startChatWithUser('${user.uid}', '${user.displayName || 'User'}')">
                    <span>${user.photoData ? `<img src="${user.photoData}" alt="${user.displayName || 'User'}" />` : "👤"}</span>
                    <small>${user.displayName || "User"}</small>
                </button>
            `).join("");
            container.appendChild(suggestionBox);
        }
    } catch (error) {
        console.warn("Could not load group suggestions:", error);
    }
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
            const avatarMarkup = user.photoData
                ? `<img src="${user.photoData}" alt="${user.displayName || "User"} profile" />`
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

    // Fetch the other user's display name from Firestore
    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const userSnap = await getDoc(doc(db, "users", uid));
        const userData = userSnap.data() || {};
        localStorage.setItem("currentChatName", userData.displayName || "User");
    } catch (error) {
        console.error("Error fetching user name:", error);
        localStorage.setItem("currentChatName", "User");
    }

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

async function loadCallHistory() {
    if (!auth?.currentUser || !db) return;
    
    try {
        const { collection, query, orderBy, getDocs, where } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        const callHistoryRef = collection(db, "users", auth.currentUser.uid, "callHistory");
        const q = query(callHistoryRef, orderBy("timestamp", "desc"));
        
        const snapshot = await getDocs(q);
        const callsList = document.getElementById("callsList");
        const emptyMessage = document.getElementById("emptyCallsMessage");
        
        if (snapshot.empty) {
            if (callsList) callsList.innerHTML = "";
            if (emptyMessage) emptyMessage.style.display = "block";
            return;
        }
        
        if (emptyMessage) emptyMessage.style.display = "none";
        
        let html = "";
        
        for (const callDoc of snapshot.docs) {
            const callData = callDoc.data();
            const contactUid = callData.contactUid;
            
            // Get contact info
            const { query: userQuery, where: whereClause, getDocs: getUserDocs, collection: usersCollection } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const userSnap = await getUserDocs(userQuery(usersCollection(db, "users"), whereClause("uid", "==", contactUid)));
            const contactData = userSnap.docs[0]?.data() || { displayName: "Unknown", photoData: null };
            
            const duration = callData.duration || 0;
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            const durationStr = duration > 0 ? `${minutes}:${seconds.toString().padStart(2, "0")}` : "0:00";
            
            const timestamp = callData.timestamp?.toDate?.() || new Date();
            const timeStr = formatMessageTime(timestamp);
            const callType = callData.type === "incoming" ? "↙ Incoming" : "↗ Outgoing";
            
            const avatar = contactData.photoData ? `<img src="${contactData.photoData}" alt="${contactData.displayName}" class="avatar-img">` : '<div class="avatar">👤</div>';
            
            html += `
                <div class="call-history-item" onclick="startChatWithUser('${contactUid}')">
                    ${avatar}
                    <div class="call-details">
                        <h3>${contactData.displayName}</h3>
                        <p>${callType} • ${timeStr} • ${durationStr}</p>
                    </div>
                    <button class="call-button" onclick="event.stopPropagation(); initiateCall(); localStorage.setItem('currentChatUid', '${contactUid}');">
                        📞
                    </button>
                </div>
            `;
        }
        
        if (callsList) callsList.innerHTML = html;
        
    } catch (error) {
        console.error("Error loading call history:", error);
    }
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

    document.addEventListener("contextmenu", (event) => {
        const target = event.target;
        if (target && target.closest("input, textarea, [contenteditable='true']")) return;
        event.preventDefault();
    });

    document.addEventListener("copy", (event) => {
        const selection = window.getSelection && window.getSelection();
        if (selection && selection.toString().trim()) {
            event.preventDefault();
        }
    });
    
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

    setupBackgroundRefresh();

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
        
        // Request notification permission once for logged-in users
        if (!localStorage.getItem("notificationPermissionRequested")) {
            await requestNotificationPermission();
            localStorage.setItem("notificationPermissionRequested", "true");
        }
        
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

        // Load calls page
        if (currentPage === "calls.html") {
            await loadCallHistory();
        }
        
        // Load messages if on chat page
        if (currentPage === "chat.html") {
            await setCurrentUserPresence(true);
            await loadMessages();
            handleIncomingCall();
            showPermissionsDialog();
        }

        if (currentPage === "status.html") {
            await loadStatusUpdates();
        }

        if (currentPage === "new-group.html") {
            await loadGroupSuggestions();
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
window.loadStatusUpdates = loadStatusUpdates;
window.addStatus = addStatus;
window.viewStatus = viewStatus;
window.createGroup = createGroup;
window.createContact = createContact;
window.addParticipant = addParticipant;
window.leaveGroup = leaveGroup;
window.openImageViewer = openImageViewer;
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
window.startVoiceRecording = startVoiceRecording;
window.stopVoiceRecording = stopVoiceRecording;
window.toggleLockRecording = toggleLockRecording;
window.playAudio = playAudio;
window.updateAudioDuration = updateAudioDuration;
window.startCall = startCall;
window.startVideoCall = startVideoCall;
window.initiateCall = initiateCall;
window.handleIncomingCall = handleIncomingCall;
window.answerCall = answerCall;
window.declineCall = declineCall;
window.endCall = endCall;
window.showIncomingCallScreen = showIncomingCallScreen;
window.hideIncomingCallScreen = hideIncomingCallScreen;
window.showOutgoingCallScreen = showOutgoingCallScreen;
window.hideOutgoingCallScreen = hideOutgoingCallScreen;
window.showOngoingCallScreen = showOngoingCallScreen;
window.hideOngoingCallScreen = hideOngoingCallScreen;
window.startCallDurationTimer = startCallDurationTimer;
window.loadCallHistory = loadCallHistory;
window.openCamera = openCamera;
window.requestAllPermissions = requestAllPermissions;
window.skipPermissions = skipPermissions;
window.requestNotificationPermission = requestNotificationPermission;
window.requestMicrophonePermission = requestMicrophonePermission;
window.requestCameraPermission = requestCameraPermission;
window.requestMediaPermission = requestMediaPermission;
window.showPermissionsDialog = showPermissionsDialog;
window.attachFile = attachFile;
window.sendImageMessage = sendImageMessage;
window.showError = showError;
window.showSuccess = showSuccess;
window.showInfo = showInfo;
