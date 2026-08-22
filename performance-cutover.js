/* She performance cutover: cached-first pages + one live chat listener. */
(() => {
  "use strict";
  const USER_KEY = "she_current_user";
  const CHAT_CACHE = uid => `she_chats_dom_v2_${uid}`;
  let unsubscribe = null;
  let activeUid = null;
  function user() { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } }
  function restoreChats(uid) { const list = document.getElementById("chatList"); if (!list || !uid) return; try { const html = localStorage.getItem(CHAT_CACHE(uid)); if (html) list.innerHTML = html; } catch {} }
  function escape(value) { return String(value ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
  function preview(value) { const text = value || "No messages yet"; return escape(text.length > 30 ? text.slice(0, 30) + "..." : text); }
  function time(value) { if (!value) return ""; try { const d = value.toDate ? value.toDate() : new Date(value.seconds ? value.seconds * 1000 : value); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return ""; } }
  async function liveLoad() {
    const uid = user()?.uid; if (!uid) return;
    for (let i = 0; i < 100 && !(window.SheFirebase?.auth && window.SheFirebase?.db); i++) await new Promise(r => setTimeout(r, 50));
    const fb = window.SheFirebase; if (!fb || activeUid !== uid) return;
    if (unsubscribe) unsubscribe();
    const { collection, query, where, onSnapshot, doc, getDoc } = fb.firestore;
    const q = query(collection(fb.db, "conversations"), where("participants", "array-contains", uid));
    unsubscribe = onSnapshot(q, async snapshot => {
      if (activeUid !== uid) return;
      const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.updatedAt?.seconds || b.lastMessageTime?.seconds || 0) - (a.updatedAt?.seconds || a.lastMessageTime?.seconds || 0));
      const data = await Promise.all(rows.map(async chat => {
        const otherUid = chat.participants?.find(x => x !== uid); if (!otherUid) return null;
        try { const snap = await getDoc(doc(fb.db, "users", otherUid)); return { chat, user: snap.exists() ? snap.data() : {} }; } catch { return { chat, user: {} }; }
      }));
      const list = document.getElementById("chatList"); if (!list || activeUid !== uid) return;
      const html = data.filter(Boolean).map(({chat, user}) => {
        const otherUid = chat.participants.find(x => x !== uid);
        const unread = Array.isArray(chat.unreadBy) && chat.unreadBy.includes(uid);
        const avatar = user.photoData ? `<img src="${escape(user.photoData)}" alt="Profile photo">` : "👤";
        return `<div class="chat-item ${unread ? "unread" : ""}" data-chat-uid="${escape(otherUid)}" onclick="openChat('${escape(otherUid)}')"><div class="avatar chat-avatar">${avatar}</div><div class="chat-info"><div class="chat-top"><h3>${escape(user.displayName || "User")}</h3><span class="message-time">${time(chat.lastMessageTime || chat.updatedAt)}</span></div><div class="chat-bottom"><p>${preview(chat.lastMessage)}</p>${unread ? `<span class="unread-badge">${Array.isArray(chat.unreadBy) ? chat.unreadBy.length : 1}</span>` : ""}</div></div></div>`;
      }).join("");
      if (html) list.innerHTML = html;
    }, error => console.warn("She chat listener:", error));
  }
  function install() { const uid = user()?.uid; if (!uid) return; activeUid = uid; restoreChats(uid); window.loadChats = liveLoad; }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true }); else install();
})();
