// Shared account/session boundary.
const CURRENT_USER_KEY = "she_current_user";
const CHAT_KEYS = ["currentChatUid", "currentChatName", "currentChatId"];

export function getStoredUser() {
    try {
        const value = localStorage.getItem(CURRENT_USER_KEY);
        return value ? JSON.parse(value) : null;
    } catch (_) {
        return null;
    }
}

export function saveStoredUser(user) {
    if (user) localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function clearAccountScopedState() {
    localStorage.removeItem(CURRENT_USER_KEY);
    CHAT_KEYS.forEach(key => localStorage.removeItem(key));
}

export function clearCurrentChat() {
    CHAT_KEYS.forEach(key => localStorage.removeItem(key));
}
