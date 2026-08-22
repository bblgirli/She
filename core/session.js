// Shared session boundary for the staged architecture migration.
// Keeps account-scoped state in one place and makes account changes explicit.

const CURRENT_USER_KEY = "she_current_user";
const CHAT_UID_KEY = "currentChatUid";
const CHAT_NAME_KEY = "currentChatName";
const CHAT_ID_KEY = "currentChatId";

export function getStoredUser() {
    try {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

export function saveStoredUser(user) {
    if (!user) return;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function clearAccountScopedState() {
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(CHAT_UID_KEY);
    localStorage.removeItem(CHAT_NAME_KEY);
    localStorage.removeItem(CHAT_ID_KEY);
}

export function clearCurrentChat() {
    localStorage.removeItem(CHAT_UID_KEY);
    localStorage.removeItem(CHAT_NAME_KEY);
    localStorage.removeItem(CHAT_ID_KEY);
}
