// Safe fixes layered on top of the legacy runtime.
// Fixes: account switching, new-chat user discovery, and robust presence.
import { firebaseConfig } from "./firebase-config.js";

const FIREBASE_VERSION = "10.12.2";
const PRESENCE_INTERVAL_MS = 15000;
const PRESENCE_STALE_MS = 45000;

let fixAuth = null;
let fixDb = null;
let fixReady = false;
let presenceTimer = null;
let presenceUnsubscribe = null;
let observedPresence = null;

async function waitForFirebaseApp() {
    const { getApps, getApp, initializeApp } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
    for (let i = 0; i < 80; i++) {
        const apps = getApps();
        if (apps.length) return getApp();
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return initializeApp(firebaseConfig);
}

async function initFixRuntime() {
    if (fixReady) return true;
    try {
        const app = await waitForFirebaseApp();
        const { getAuth } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`);
        const { getFirestore } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
        fixAuth = getAuth(app);
        fixDb = getFirestore(app);
        fixReady = true;
        return true;
    } catch (error) {
        console.warn("She fixes could not initialize:", error);
        return false;
    }
}

async function waitForAuthUser(timeoutMs = 8000) {
    if (!fixAuth) return null;
    try {
        await Promise.race([
            fixAuth.authStateReady?.() || Promise.resolve(),
            new Promise(resolve => setTimeout(resolve, timeoutMs))
        ]);
    } catch (_) {}
    return fixAuth.currentUser || null;
}

async function writePresence(online) {
    const user = fixAuth?.currentUser;
    if (!user || !fixDb) return;
    try {
        const { doc, setDoc, serverTimestamp } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
        await setDoc(doc(fixDb, "users", user.uid), {
            uid: user.uid,
            online: !!online,
            lastActive: serverTimestamp(),
            ...(online ? {} : { lastSeen: serverTimestamp() })
        }, { merge: true });
    } catch (error) {
        // A lost connection is expected to fail here. The heartbeat on other
        // clients will mark this user offline once lastActive becomes stale.
        console.debug("Presence update deferred:", error?.code || error?.message || error);
    }
}

function formatLastSeen(value) {
    if (!value) return "Offline";
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "Offline";
    const diff = Math.max(0, Date.now() - date.getTime());
    if (diff < 60000) return "Last seen just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Last seen ${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Last seen ${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `Last seen ${days} day${days === 1 ? "" : "s"} ago`;
}

function applyPresenceToChat(userData) {
    const statusEl = document.querySelector(".chat-profile p");
    if (!statusEl) return;

    const activeValue = userData?.lastActive;
    const activeDate = activeValue?.toDate?.() || (activeValue ? new Date(activeValue) : null);
    const fresh = activeDate && !Number.isNaN(activeDate.getTime()) && (Date.now() - activeDate.getTime()) < PRESENCE_STALE_MS;

    if (userData?.online === true && fresh) {
        statusEl.textContent = "Online";
    } else {
        statusEl.textContent = formatLastSeen(userData?.lastSeen || userData?.lastActive);
    }
}

async function startPresence() {
    const user = await waitForAuthUser();
    if (!user) return;

    await writePresence(true);
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = setInterval(() => writePresence(true), PRESENCE_INTERVAL_MS);

    window.addEventListener("online", () => writePresence(true));
    window.addEventListener("offline", () => writePresence(false));
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") writePresence(true);
    });

    window.addEventListener("pagehide", () => writePresence(false));

    const chatUid = localStorage.getItem("currentChatUid");
    if (chatUid && document.querySelector(".chat-profile p")) {
        const { doc, onSnapshot } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
        if (presenceUnsubscribe) presenceUnsubscribe();
        presenceUnsubscribe = onSnapshot(doc(fixDb, "users", chatUid), snapshot => {
            observedPresence = snapshot.data() || {};
            applyPresenceToChat(observedPresence);
        }, error => console.debug("Presence listener:", error?.code || error?.message || error));

        setInterval(() => {
            if (observedPresence) applyPresenceToChat(observedPresence);
        }, 5000);
    }
}

function renderUsers(users) {
    const container = document.getElementById("newChatResults");
    if (!container) return;

    if (!users.length) {
        container.innerHTML = '<div class="message received"><p>No other users have registered yet.</p></div>';
        return;
    }

    container.innerHTML = users.map(user => {
        const name = String(user.displayName || "User");
        const phone = user.phone ? ` • ${String(user.phone)}` : "";
        const email = String(user.email || "");
        const photo = user.photoData
            ? `<img src="${String(user.photoData)}" alt="Profile photo">`
            : "👤";
        const encodedUid = encodeURIComponent(String(user.uid));
        const encodedName = encodeURIComponent(name);
        return `
            <div class="contact-item" data-user-uid="${encodedUid}" data-user-name="${encodedName}">
                <div class="contact-avatar">${photo}</div>
                <div class="contact-info">
                    <h3>${escapeHTML(name)}</h3>
                    <p>${escapeHTML(email + phone)}</p>
                </div>
            </div>`;
    }).join("");

    container.querySelectorAll(".contact-item[data-user-uid]").forEach(item => {
        item.addEventListener("click", () => {
            const uid = decodeURIComponent(item.dataset.userUid || "");
            const name = decodeURIComponent(item.dataset.userName || "User");
            window.startChatWithUser?.(uid, name);
        });
    });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
}

let cachedUsers = [];

async function loadAllChatUsers(searchTerm = "") {
    if (!fixReady || !fixAuth?.currentUser || !fixDb) return;
    const container = document.getElementById("newChatResults");
    if (!container) return;
    try {
        if (!cachedUsers.length) {
            const { collection, getDocs } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
            const snapshot = await getDocs(collection(fixDb, "users"));
            cachedUsers = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
        const term = String(searchTerm || "").trim().toLowerCase();
        const users = cachedUsers
            .filter(user => user.uid && user.uid !== fixAuth.currentUser.uid)
            .filter(user => !term ||
                String(user.displayName || "").toLowerCase().includes(term) ||
                String(user.phone || "").toLowerCase().includes(term) ||
                String(user.email || "").toLowerCase().includes(term))
            .sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));
        renderUsers(users);
    } catch (error) {
        console.error("Could not load users for New Chat:", error);
        container.innerHTML = '<div class="message received"><p>Could not load users. Check your connection and try again.</p></div>';
    }
}

function installNewChatFix() {
    const page = window.location.pathname.split("/").pop();
    if (page !== "new-chat.html") return;

    window.searchContactsInput = event => {
        const term = event?.target?.value || "";
        loadAllChatUsers(term);
    };
    window.searchContacts = () => document.getElementById("newChatSearch")?.focus();

    const input = document.getElementById("newChatSearch");
    input?.addEventListener("input", event => loadAllChatUsers(event.target.value));
    loadAllChatUsers("");
}

async function fixAccountSwitching() {
    const page = window.location.pathname.split("/").pop();
    if (page !== "login.html") return;

    // The old login page immediately redirected when she_current_user existed,
    // which made switching accounts unreliable. The login page is now a clean
    // account boundary: restore Firebase, then explicitly sign out the previous
    // session before allowing the next sign-in.
    try {
        const user = await waitForAuthUser(5000);
        if (user) await writePresence(false);
        if (user) await fixAuth.signOut();
        localStorage.removeItem("she_current_user");
        localStorage.removeItem("currentChatUid");
        localStorage.removeItem("currentChatName");
    } catch (error) {
        console.warn("Account switch cleanup:", error);
        localStorage.removeItem("she_current_user");
        localStorage.removeItem("currentChatUid");
        localStorage.removeItem("currentChatName");
    }
}

async function bootFixes() {
    if (!(await initFixRuntime())) return;
    await fixAccountSwitching();

    const page = window.location.pathname.split("/").pop();
    if (page !== "login.html" && page !== "signup.html" && page !== "forgot-password.html" && page !== "reset-password.html") {
        await startPresence();
    }

    if (page === "new-chat.html") installNewChatFix();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootFixes, { once: true });
} else {
    bootFixes();
}
