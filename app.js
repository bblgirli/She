import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    getAuth,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    addDoc,
    collection,
    doc,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const firebaseApp = configured ? initializeApp(firebaseConfig) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;

function requireFirebase() {
    if (!configured) throw new Error("Firebase is not configured. Add the values in firebase-config.js.");
}

function showError(error) { alert(error?.message || error); }

function conversationId() {
    const contactId = localStorage.getItem("currentChatUid") || `contact-${localStorage.getItem("currentChat") || "unknown"}`;
    return [auth.currentUser.uid, contactId].sort().join("_").replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function saveUserProfile(user, data = {}) {
    await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: data.displayName || user.displayName || "",
        phone: data.phone || "",
        about: data.about || "Available",
        updatedAt: serverTimestamp()
    }, { merge: true });
}

const signupForm = document.getElementById("signupForm");
if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            requireFirebase();
            const result = await createUserWithEmailAndPassword(auth, document.getElementById("email").value.trim(), document.getElementById("password").value);
            const name = document.getElementById("name").value.trim();
            const phone = `${document.getElementById("countryCode").value}${document.getElementById("phone").value.trim()}`;
            await updateProfile(result.user, { displayName: name });
            await saveUserProfile(result.user, { displayName: name, phone });
            window.location.href = "chats.html";
        } catch (error) { showError(error); }
    });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            requireFirebase();
            await signInWithEmailAndPassword(auth, document.getElementById("loginPhone").value.trim(), document.getElementById("loginPassword").value);
            window.location.href = "chats.html";
        } catch (error) { showError(error); }
    });
}

if (auth) onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    if (db) await saveUserProfile(user);
    const messages = document.getElementById("messages");
    if (!messages) return;
    const messagesQuery = query(collection(db, "conversations", conversationId(), "messages"), orderBy("createdAt", "asc"));
    onSnapshot(messagesQuery, (snapshot) => {
        messages.querySelectorAll(".firebase-message").forEach((message) => message.remove());
        snapshot.forEach((messageSnapshot) => {
            const message = messageSnapshot.data();
            const item = document.createElement("div");
            item.className = `message firebase-message ${message.senderId === user.uid ? "sent" : "received"}`;
            item.innerHTML = `<p>${escapeHTML(message.text)}</p><span>${formatTime(message.createdAt)}</span>`;
            messages.appendChild(item);
        });
        messages.scrollTop = messages.scrollHeight;
    }, showError);
});

async function sendMessage() {
    const input = document.getElementById("messageInput");
    if (!input || !input.value.trim()) return;
    try {
        requireFirebase();
        if (!auth.currentUser) throw new Error("Please log in before sending a message.");
        await setDoc(doc(db, "conversations", conversationId()), {
            participants: [auth.currentUser.uid, localStorage.getItem("currentChatUid") || ""].filter(Boolean),
            updatedAt: serverTimestamp()
        }, { merge: true });
        await addDoc(collection(db, "conversations", conversationId(), "messages"), {
            text: input.value.trim(), senderId: auth.currentUser.uid, createdAt: serverTimestamp()
        });
        input.value = "";
    } catch (error) { showError(error); }
}

function formatTime(timestamp) { return timestamp?.toDate ? timestamp.toDate().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Sending..."; }
function escapeHTML(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML; }
function togglePassword(id = "password") { const input = document.getElementById(id); if (input) input.type = input.type === "password" ? "text" : "password"; }
function toggleLoginPassword() { togglePassword("loginPassword"); }
function handleEnter(event) { if (event.key === "Enter") { event.preventDefault(); sendMessage(); } }
function openChat(name, uid = "") { localStorage.setItem("currentChat", name); if (uid) localStorage.setItem("currentChatUid", uid); window.location.href = "chat.html"; }
function goBack() { window.location.href = "chats.html"; }
function showEmoji() { const input = document.getElementById("messageInput"); if (input) { input.value += "😊"; input.focus(); } }
function logout() { if (confirm("Are you sure you want to log out?")) signOut(auth).then(() => { localStorage.clear(); window.location.href = "login.html"; }).catch(showError); }
function forgotPassword() { const email = prompt("Enter your email address:"); if (email) sendPasswordResetEmail(auth, email).then(() => alert("Password reset email sent.")).catch(showError); }
function googleLogin() { try { requireFirebase(); signInWithPopup(auth, new GoogleAuthProvider()).then(() => window.location.href = "chats.html").catch(showError); } catch (error) { showError(error); } }
function editProfileName() { window.location.href = "edit-profile.html"; }
function goTo(page) { window.location.href = page; }
function searchChats() { const value = prompt("Search chats:"); if (value) alert(`Searching for: ${value}`); }
function searchContacts() { const value = prompt("Search contacts:"); if (value) alert(`Searching for: ${value}`); }
function searchCalls() { const value = prompt("Search calls:"); if (value) alert(`Searching for: ${value}`); }
function openMenu() { alert("Menu\n\nNew group\nSettings\nProfile"); }
function newChat() { window.location.href = "new-chat.html"; }
function createGroup() { window.location.href = "new-group.html"; }
function createContact() { alert("Invite a registered Firebase user by sharing their email address."); }
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
        requireFirebase();
        const displayName = document.getElementById("editName").value.trim();
        const about = document.getElementById("editAbout").value.trim();
        if (!displayName) throw new Error("Please enter your name.");
        await updateProfile(auth.currentUser, { displayName });
        await saveUserProfile(auth.currentUser, { displayName, about });
        window.location.href = "profile.html";
    } catch (error) { showError(error); }
}

Object.assign(window, { sendMessage, togglePassword, toggleLoginPassword, handleEnter, openChat, goBack, showEmoji, logout, forgotPassword, googleLogin, editProfileName, saveProfile, goTo, searchChats, searchContacts, searchCalls, openMenu, newChat, createGroup, createContact, startCall, startVideoCall, attachFile, openCamera, sendVoiceMessage, changeProfilePhoto, editAbout, addParticipant, leaveGroup, openPrivacy, openSecurity, openChatSettings, openNotifications, openStorage, openHelp, toggleDarkMode, addStatus, viewStatus });
