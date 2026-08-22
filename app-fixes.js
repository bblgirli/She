// Stability fixes layered on top of the legacy runtime.
// Fixes: reliable New Chat user discovery, clean account switching,
// and connection-aware presence that expires stale "Online" states.
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
let presenceRenderTimer = null;
let authUnsubscribe = null;
let newChatLoadTimer = null;
let newChatInputHandler = null;

async function waitForFirebaseApp() {
    const { getApps, getApp, initializeApp } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
    for (let i = 0; i < 100; i++) {
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

async function waitForAuthUser(timeoutMs = 10000) {
    if (!fixAuth) return null;
    try {
        if (typeof fixAuth.authStateReady === "function") {
            await Promise.race([
                fixAuth.authStateReady(),
                new Promise(resolve => setTimeout(resolve, timeoutMs))
            ]);
        } else {
            await new Promise(resolve => setTimeout(resolve, Math.min(timeoutMs, 1000)));
        }
    } catch (_) {}
    return fixAuth.currentUser || null;
}

async function writePresence(online) {
    const user = fixAuth?.currentUser;
    if (!user || !fixDb) return false;
    try {
        const { doc, setDoc, serverTimestamp } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
        await setDoc(doc(fixDb, "users", user.uid), {
            uid: user.uid,
            online: !!online,
            lastActive: serverTimestamp(),
            ...(online ? {} : { lastSeen: serverTimestamp() })
        }, { merge: true });
        return true;
    } catch (error) {
        console.debug("Presence update deferred:", error?.code || error?.message || error);
        return false;
    }
}

function toDate(value) {
    if (!value) return null;
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatLastSeen(value) {
    const date = toDate(value);
    if (!date) return "Offline";
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

    const activeDate = toDate(userData?.lastActive);
    const fresh = !!activeDate && (Date.now() - activeDate.getTime()) < PRESENCE_STALE_MS;

    if (userData?.online === true && fresh && navigator.onLine !== false) {
        statusEl.textContent = "Online";
    } else {
        // If the other device disappeared without sending an offline write,
        // lastActive is still a trustworthy last-seen boundary.
        statusEl.textContent = formatLastSeen(userData?.lastSeen || userData?.lastActive);
    }
}

async function startPresence() {
    if (!fixReady) return;

    const user = await waitForAuthUser();
    if (!user) {
        // Firebase may still be restoring the session while legacy-app.js boots.
        // Retry briefly instead of giving up permanently.
        setTimeout(() => startPresence(), 1000);
        return;
    }

    await writePresence(true);
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = setInterval(() => {
        if (document.visibilityState !== "hidden" && navigator.onLine !== false) writePresence(true);
    }, PRESENCE_INTERVAL_MS);

    window.setCurrentUserPresence = writePresence;

    window.addEventListener("online", () => writePresence(true));
    window.addEventListener("offline", () => {
        // A browser cannot reliably write Firestore after the network is gone.
        // Other clients use lastActive + the 45s stale threshold to show Last seen.
    });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && navigator.onLine !== false) writePresence(true);
    });
    window.addEventListener("pagehide", () => writePresence(false));

    const bindChatPresence = async () => {
        const chatUid = localStorage.getItem("currentChatUid");
        if (!chatUid || !document.querySelector(".chat-profile p")) return;
        const { doc, onSnapshot } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
        if (presenceUnsubscribe) presenceUnsubscribe();
        presenceUnsubscribe = onSnapshot(doc(fixDb, "users", chatUid), snapshot => {
            observedPresence = snapshot.data() || {};
            applyPresenceToChat(observedPresence);
        }, error => console.debug("Presence listener:", error?.code || error?.message || error));
        if (presenceRenderTimer) clearInterval(presenceRenderTimer);
        presenceRenderTimer = setInterval(() => {
            if (observedPresence) applyPresenceToChat(observedPresence);
        }, 5000);
    };

    await bindChatPresence();
}

function renderUsers(users) {
    const container = document.getElementById("newChatResults");
    if (!container) return;

    if (!users.length) {
        container.innerHTML = '<div class="message received"><p>No other users have registered yet.</p></div>';
        return;
    }

    container.innerHTML = users.map(user => {
        const name = String(user.displayName || user.name || "User");
        const phone = user.phone ? ` • ${String(user.phone)}` : "";
        const email = String(user.email || "");
        const photo = user.photoData || user.photoURL || user.photoUrl
            ? `<img src="${escapeHTML(user.photoData || user.photoURL || user.photoUrl)}" alt="Profile photo">`
            : "👤";
        const encodedUid = encodeURIComponent(String(user.uid));
        const encodedName = encodeURIComponent(name);
        return `
            <div class="contact-item" data-user-uid="${encodedUid}" data-user-name="${encodedName}" role="button" tabindex="0">
                <div class="contact-avatar">${photo}</div>
                <div class="contact-info">
                    <h3>${escapeHTML(name)}</h3>
                    <p>${escapeHTML(email + phone)}</p>
                </div>
            </div>`;
    }).join("");

    container.querySelectorAll(".contact-item[data-user-uid]").forEach(item => {
        const open = () => {
            const uid = decodeURIComponent(item.dataset.userUid || "");
            const name = decodeURIComponent(item.dataset.userName || "User");
            if (typeof window.startChatWithUser === "function") window.startChatWithUser(uid, name);
        };
        item.addEventListener("click", open);
        item.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
        });
    });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
}

let cachedUsers = [];
let usersCacheUid = null;

async function loadAllChatUsers(searchTerm = "", forceRefresh = false) {
    if (!fixReady || !fixAuth || !fixDb) return false;
    const container = document.getElementById("newChatResults");
    if (!container) return false;

    const currentUser = await waitForAuthUser();
    if (!currentUser) {
        container.innerHTML = '<div class="message received"><p>Loading users…</p></div>';
        setTimeout(() => loadAllChatUsers(searchTerm, forceRefresh), 800);
        return false;
    }

    try {
        if (forceRefresh || usersCacheUid !== currentUser.uid || !cachedUsers.length) {
            const { collection, getDocs } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
            const snapshot = await getDocs(collection(fixDb, "users"));
            cachedUsers = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            usersCacheUid = currentUser.uid;
        }

        const term = String(searchTerm || "").trim().toLowerCase();
        const users = cachedUsers
            .filter(user => String(user.uid || user.id) !== String(currentUser.uid))
            .filter(user => !term ||
                String(user.displayName || user.name || "").toLowerCase().includes(term) ||
                String(user.phone || "").toLowerCase().includes(term) ||
                String(user.email || "").toLowerCase().includes(term))
            .sort((a, b) => String(a.displayName || a.name || "").localeCompare(String(b.displayName || b.name || "")));
        renderUsers(users);
        return true;
    } catch (error) {
        console.error("Could not load users for New Chat:", error);
        container.innerHTML = '<div class="message received"><p>Could not load users. Check your connection and try again.</p></div>';
        return false;
    }
}

function installNewChatFix() {
    const page = window.location.pathname.split("/").pop();
    if (page !== "new-chat.html") return;

    window.searchContactsInput = event => loadAllChatUsers(event?.target?.value || "");
    window.searchContacts = () => document.getElementById("newChatSearch")?.focus();

    const input = document.getElementById("newChatSearch");
    if (input && !newChatInputHandler) {
        newChatInputHandler = event => loadAllChatUsers(event.target.value || "");
        input.addEventListener("input", newChatInputHandler);
    }

    const refresh = () => loadAllChatUsers(input?.value || "", true);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);

    // Do not depend on Firebase finishing before DOMContentLoaded.
    loadAllChatUsers("");
    if (newChatLoadTimer) clearInterval(newChatLoadTimer);
    newChatLoadTimer = setInterval(() => {
        const container = document.getElementById("newChatResults");
        if (container && !container.querySelector(".contact-item")) loadAllChatUsers(input?.value || "");
    }, 1500);
}

async function fixAccountSwitching() {
    const page = window.location.pathname.split("/").pop();
    if (page !== "login.html") return;

    // A login page is always a hard account boundary. Clear the restored
    // Firebase session and account-scoped local state before the user signs in.
    try {
        const user = await waitForAuthUser(5000);
        if (user) await writePresence(false);
        if (user) await fixAuth.signOut();
    } catch (error) {
        console.warn("Account switch cleanup:", error);
    } finally {
        localStorage.removeItem("she_current_user");
        localStorage.removeItem("currentChatUid");
        localStorage.removeItem("currentChatName");
        localStorage.removeItem("currentChatId");
        cachedUsers = [];
        usersCacheUid = null;
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
