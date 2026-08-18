// M3ss3nger application loader.
// The full application implementation is restored from the last known-good
// commit while legacy in-page Firestore notifications are disabled.
// Firebase message listeners continue to sync/render messages normally.

const LEGACY_APP_URL = "https://raw.githubusercontent.com/kazeemb308-collab/She/a38c3613a99be485f407d91ee04924d078d20396/app.js";

// Prevent the old `new Notification(...)` path in the restored app from
// replaying notifications whenever Firestore listeners initialize.
if ("Notification" in window) {
    class SilentLegacyNotification {
        static permission = "denied";
        static requestPermission = async () => "denied";
        constructor() {}
        close() {}
    }
    window.Notification = SilentLegacyNotification;
}

window.__sheLegacyNotificationsDisabled = true;

// Top-level await keeps the restored app initialization in the normal module
// lifecycle, so DOMContentLoaded handlers in the original implementation are
// registered before the page finishes loading.
await import(LEGACY_APP_URL);
