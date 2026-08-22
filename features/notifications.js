/*
 * She notifications feature module.
 *
 * This module is intentionally self-contained so notification behavior can be
 * migrated out of app.js without changing the existing UI in one risky step.
 */

const shownNotificationIds = new Set();

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export function canNotify() {
  return "Notification" in window && Notification.permission === "granted";
}

export function showMessageNotification({ senderName, messagePreview, senderUid, onClick }) {
  if (!canNotify()) return null;

  const currentUid = localStorage.getItem("currentChatUid");
  if (currentUid === senderUid) return null;

  const messageKey = `${senderUid}:${messagePreview}`;
  if (shownNotificationIds.has(messageKey)) return null;
  shownNotificationIds.add(messageKey);

  const preview = String(messagePreview || "");
  const body = preview.length > 100 ? `${preview.substring(0, 97)}...` : preview;

  const notification = new Notification(senderName || "New message", {
    body,
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23078b59%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2250%22 fill=%22white%22>💬</text></svg>",
    badge: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23078b59%22 width=%22100%22 height=%22100%22/></svg>",
    tag: `message_${senderUid}`
  });

  const closeTimer = window.setTimeout(() => notification.close(), 6000);

  notification.onclick = () => {
    window.clearTimeout(closeTimer);
    window.focus();
    if (typeof onClick === "function") onClick();
  };

  return notification;
}

export function clearNotificationHistory() {
  shownNotificationIds.clear();
}
