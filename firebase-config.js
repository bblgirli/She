// Firebase configuration.
// Legacy in-page notifications are intentionally disabled: message syncing
// should update the app silently. Real push notifications are handled by the
// service worker/server and are not affected by this guard.
const NativeNotification = typeof window !== "undefined" ? window.Notification : null;
if (NativeNotification && !window.__sheLegacyNotificationsBlocked) {
    window.__sheLegacyNotificationsBlocked = true;
    class SilentNotification {
        static get permission() {
            return NativeNotification.permission;
        }
        static requestPermission(...args) {
            return NativeNotification.requestPermission(...args);
        }
        constructor() {
            this.onclick = null;
            this.close = () => {};
        }
    }
    window.Notification = SilentNotification;
}

export const firebaseConfig = {
    apiKey: "AIzaSyBzuctjdTAHT3kxdrIZz9aGe5mGLsiGwx4",
    authDomain: "m3ss3nger-50a21.firebaseapp.com",
    projectId: "m3ss3nger-50a21",
    storageBucket: "m3ss3nger-50a21.appspot.com",
    messagingSenderId: "245814154474",
    appId: "1:245814154474:web:0d59fafb4b03baa296f393"
};
