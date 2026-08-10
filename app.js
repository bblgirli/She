import { firebaseConfig } from "./firebase-config.js";

const STORAGE_KEY = "she_app_state";
const CURRENT_USER_KEY = "she_current_user";
let configured = Boolean(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);
let firebaseApp = null;
let auth = null;
let db = null;
let firebaseAuthModule = null;
let firebaseFirestoreModule = null;

async function initializeFirebase() {
    if (!configured || auth || db) return;

    try {
        const appModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
        const authModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

        firebaseAuthModule = authModule;
        firebaseFirestoreModule = firestoreModule;
        firebaseApp = appModule.initializeApp(firebaseConfig);
        auth = authModule.getAuth(firebaseApp);
        db = firestoreModule.getFirestore(firebaseApp);
    } catch (error) {
        console.warn("Firebase unavailable; falling back to local mode.", error);
        configured = false;
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
            id: "seed-oluwatosin",
            email: "demo@example.com",
            password: "demo123",
            displayName: "Oluwatosin",
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
    if (configured && auth && auth.currentUser) {
        return {
            id: auth.currentUser.uid,
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName || "",
            phone: "",
            about: "Available"
        };
    }
    return currentUserFromStorage();
}

function setCurrentUser(user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function isAuthPage() {
    const path = window.location.pathname.split("/").pop() || "";
    return path === "login.html" || path === "signup.html";
}

function requireAuth() {
    const user = getCurrentUser();
    if (!user && !isAuthPage()) {
        window.location.href = "login.html";
        return false;
    }
    return true;
}

function showError(error) {
    alert(error?.message || error || "Something went wrong.");
}

function normalizePhone(value = "") {
    const raw = `${value}`.trim();
    if (!raw) return "";
    const normalized = raw.replace(/[^\d+]/g, "");
    if (!normalized) return "";
    return normalized.startsWith("+") ? normalized : `+${normalized.replace(/^\+/, "")}`;
}

async function resolveLoginEmailFromPhone(phone) {
    if (!configured || !db || !auth) return null;
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("phone", "==", phone));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            return userData.email || null;
        }
    } catch (error) {
        console.warn("Unable to resolve login email from phone number.", error);
    }
    return null;
}

function conversationKey(contactId = "") {
    const user = getCurrentUser();
    const fallbackId = contactId || localStorage.getItem("currentChatUid") || localStorage.getItem("currentChat") || "oluwatosin";
    const base = `${user?.id || user?.uid || user?.email || "guest"}-${fallbackId}`;
    return base.toLowerCase().replace(/[^a-z0-9]+/g, "-");
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
        wrapper.className = `message ${item.senderId === getCurrentUser()?.id || item.senderId === getCurrentUser()?.uid ? "sent" : "received"}`;
        wrapper.innerHTML = `<p>${escapeHTML(item.text)}</p><span>${formatTime(item.createdAt)}</span>`;
        messages.appendChild(wrapper);
    });
    messages.scrollTop = messages.scrollHeight;
}

async function saveUserProfile(user, data = {}) {
    await initializeFirebase();
    const phone = normalizePhone(data.phone || "");
    if (configured && db && auth && firebaseFirestoreModule) {
        await firebaseFirestoreModule.setDoc(firebaseFirestoreModule.doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: data.displayName || user.displayName || "",
            phone,
            about: data.about || "Available",
            updatedAt: firebaseFirestoreModule.serverTimestamp()
        }, { merge: true });
        return;
    }

    const state = readState();
    const account = state.accounts.find((entry) => entry.email.toLowerCase() === (user.email || "").toLowerCase());
    if (!account) return;
    Object.assign(account, {
        displayName: data.displayName || account.displayName || "",
        phone: data.phone || account.phone || "",
        about: data.about || account.about || "Available"
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
    const phone = normalizePhone(`${document.getElementById("countryCode").value}${document.getElementById("phone").value.trim()}`);

    if (!name || !email || !password || !phone) {
        showError("Please complete the form.");
        return;
    }

    if (configured && auth && firebaseAuthModule) {
        try {
            const result = await firebaseAuthModule.createUserWithEmailAndPassword(auth, email, password);
            await firebaseAuthModule.updateProfile(result.user, { displayName: name });
            await saveUserProfile(result.user, { displayName: name, phone });
            window.location.href = "chats.html";
        } catch (error) {
            showError(error);
        }
        return;
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
    const loginValue = document.getElementById("loginPhone").value.trim();
    const password = document.getElementById("loginPassword").value;
    const countryCode = document.getElementById("loginCountryCode")?.value || "+234";
    const phone = normalizePhone(`${countryCode}${loginValue}`);
    const loginIdentifier = loginValue.includes("@") ? loginValue.toLowerCase() : phone;

    if (!loginValue || !password) {
        showError("Please enter your phone number and password.");
        return;
    }

    if (configured && auth && firebaseAuthModule) {
        try {
            const emailForLogin = loginValue.includes("@") ? loginValue : await resolveLoginEmailFromPhone(phone);
            if (!emailForLogin) {
                throw new Error("No account matched that phone number.");
            }
            const result = await firebaseAuthModule.signInWithEmailAndPassword(auth, emailForLogin, password);
            setCurrentUser({
                id: result.user.uid,
                uid: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName || "",
                phone,
                about: "Available"
            });
            window.location.href = "chats.html";
        } catch (error) {
            showError(error);
        }
        return;
    }

    const state = readState();
    const account = state.accounts.find((entry) => {
        const matchesPhone = entry.phone && normalizePhone(entry.phone) === loginIdentifier;
        const matchesEmail = entry.email && entry.email.toLowerCase() === loginIdentifier.toLowerCase();
        return (matchesPhone || matchesEmail) && entry.password === password;
    });
    if (!account) {
        showError("No account matched those details. Try +2348000000000 / demo123.");
        return;
    }
    setCurrentUser(account);
    window.location.href = "chats.html";
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
            await firebaseFirestoreModule.setDoc(firebaseFirestoreModule.doc(db, "conversations", conversationKey()), {
                participants: [auth.currentUser.uid, localStorage.getItem("currentChatUid") || ""].filter(Boolean),
                updatedAt: firebaseFirestoreModule.serverTimestamp()
            }, { merge: true });
            await firebaseFirestoreModule.addDoc(firebaseFirestoreModule.collection(db, "conversations", conversationKey(), "messages"), {
                text,
                senderId: auth.currentUser.uid,
                createdAt: firebaseFirestoreModule.serverTimestamp()
            });
            input.value = "";
        } catch (error) {
            showError(error);
        }
        return;
    }

    const key = conversationKey();
    const state = readState();
    const list = state.messages[key] || [];
    list.push({
        text,
        senderId: user.id || user.uid || user.email,
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
function openChat(name, uid = "") { localStorage.setItem("currentChat", name); if (uid) localStorage.setItem("currentChatUid", uid); window.location.href = "chat.html"; }
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
function forgotPassword() {
    const email = prompt("Enter your email address:");
    if (!email) return;
    if (configured && auth && firebaseAuthModule) {
        firebaseAuthModule.sendPasswordResetEmail(auth, email).then(() => alert("Password reset email sent.")).catch(showError);
        return;
    }
    alert("Password reset is available once Firebase Auth is configured.");
}
function googleLogin() {
    if (configured && auth && firebaseAuthModule) {
        firebaseAuthModule.signInWithPopup(auth, new firebaseAuthModule.GoogleAuthProvider()).then(() => window.location.href = "chats.html").catch(showError);
        return;
    }
    alert("Google sign-in will work once Firebase Auth is configured.");
}
function editProfileName() { window.location.href = "edit-profile.html"; }
function goTo(page) { window.location.href = page; }
function searchChats() { const value = prompt("Search chats:"); if (value) alert(`Searching for: ${value}`); }
function searchContacts() { const value = prompt("Search contacts:"); if (value) alert(`Searching for: ${value}`); }
function searchCalls() { const value = prompt("Search calls:"); if (value) alert(`Searching for: ${value}`); }
function openMenu() { alert("Menu\n\nNew group\nSettings\nProfile"); }
function newChat() { window.location.href = "new-chat.html"; }
function createGroup() { window.location.href = "new-group.html"; }
function createContact() { alert("Use the demo account or connect Firebase to invite a real contact."); }
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
        if (!displayName) throw new Error("Please enter your name.");
        if (configured && auth && firebaseAuthModule) {
            await firebaseAuthModule.updateProfile(auth.currentUser, { displayName });
        }
        await saveUserProfile(getCurrentUser(), { displayName, about });
        window.location.href = "profile.html";
    } catch (error) {
        showError(error);
    }
}

function hydrateProfilePage() {
    const user = getCurrentUser();
    if (!user) return;
    const displayName = document.getElementById("displayName");
    const profileName = document.getElementById("profileName");
    const profileAbout = document.getElementById("profileAbout");
    const profilePhone = document.querySelector(".profile-phone");

    if (displayName) displayName.textContent = user.displayName || "Your Name";
    if (profileName) profileName.textContent = user.displayName || "Your Name";
    if (profileAbout) profileAbout.textContent = user.about || "Available";
    if (profilePhone) profilePhone.textContent = user.phone || user.email || "";
}

function hydrateEditProfilePage() {
    const user = getCurrentUser();
    if (!user) return;
    const editName = document.getElementById("editName");
    const editAbout = document.getElementById("editAbout");
    const editPhone = document.querySelector("#editProfilePage input[disabled]");
    if (editName) editName.value = user.displayName || "";
    if (editAbout) editAbout.value = user.about || "";
    if (editPhone) editPhone.value = user.phone || user.email || "";
}

function renderChatList() {
    const container = document.getElementById("chatList") || document.querySelector(".chat-list");
    if (!container) return;

    const contacts = [
        { name: "Oluwatosin", uid: "oluwatosin", avatar: "👩🏾", about: "Available" },
        { name: "Abdullahi", uid: "abdullahi", avatar: "👨🏾", about: "Hey there!" },
        { name: "Jane", uid: "jane", avatar: "👩🏾", about: "Busy" },
        { name: "Michael", uid: "michael", avatar: "👨🏾", about: "Available" }
    ];

    const state = readState();
    const html = contacts.map((contact) => {
        const key = conversationKey(contact.uid);
        const messages = state.messages[key] || [];
        const lastMessage = messages[messages.length - 1];
        const preview = lastMessage ? lastMessage.text : contact.about;
        const time = lastMessage ? formatTime(lastMessage.createdAt) : "Now";
        return `
            <div class="chat-item" onclick="openChat('${contact.name}', '${contact.uid}')">
                <div class="avatar">${contact.avatar}</div>
                <div class="chat-details">
                    <div class="chat-top">
                        <h3>${contact.name}</h3>
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

function hydrateChatPage() {
    const headerName = document.querySelector(".chat-profile h3");
    const currentName = localStorage.getItem("currentChat") || "Chat";
    if (headerName) headerName.textContent = currentName;
    if (!configured && !getCurrentUser()) {
        window.location.href = "login.html";
        return;
    }
    renderLocalMessages();
}

async function initializeApp() {
    await initializeFirebase();
    if (!configured) {
        ensureAccountSeed();
    }
    if (!requireAuth()) return;

    if (document.getElementById("signupForm")) {
        document.getElementById("signupForm").addEventListener("submit", handleSignup);
    }
    if (document.getElementById("loginForm")) {
        document.getElementById("loginForm").addEventListener("submit", handleLogin);
    }

    if (document.getElementById("messages")) {
        hydrateChatPage();
    }

    if (document.getElementById("chatList") || document.querySelector(".chat-list")) {
        renderChatList();
    }

    if (document.getElementById("displayName") || document.getElementById("profileName") || document.getElementById("profileAbout")) {
        hydrateProfilePage();
    }

    if (document.getElementById("editName") || document.getElementById("editAbout")) {
        hydrateEditProfilePage();
    }
}

initializeApp().catch(showError);

Object.assign(window, { sendMessage, togglePassword, toggleLoginPassword, handleEnter, openChat, goBack, showEmoji, logout, forgotPassword, googleLogin, editProfileName, saveProfile, goTo, searchChats, searchContacts, searchCalls, openMenu, newChat, createGroup, createContact, startCall, startVideoCall, attachFile, openCamera, sendVoiceMessage, changeProfilePhoto, editAbout, addParticipant, leaveGroup, openPrivacy, openSecurity, openChatSettings, openNotifications, openStorage, openHelp, toggleDarkMode, addStatus, viewStatus });
