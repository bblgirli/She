/* WhatsApp-style chat list: one authoritative renderer for chats.html. */
import { firebaseConfig } from "./firebase-config.js";

const CACHE = "she_whatsapp_chat_list_v1_";
const PROFILE = "she_whatsapp_profile_v1_";
let db = null;
let auth = null;
let unsubscribe = null;
let activeUid = null;
let renderToken = 0;

const $ = (s) => document.querySelector(s);
const read = (k, fallback = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const otherUid = (c, uid) => (Array.isArray(c.participants) ? c.participants.find(x => x !== uid) : "") || "";
const ms = (v) => { if (!v) return 0; if (typeof v.toMillis === "function") return v.toMillis(); if (typeof v.seconds === "number") return v.seconds * 1000; if (typeof v === "number") return v; const n = new Date(v).getTime(); return Number.isFinite(n) ? n : 0; };
const esc = (v) => { const d = document.createElement("div"); d.textContent = v == null ? "" : String(v); return d.innerHTML; };
function time(v) { const n = ms(v); if (!n) return ""; const d = new Date(n), now = new Date(); if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}); const y = new Date(now); y.setDate(now.getDate()-1); if (d.toDateString() === y.toDateString()) return "Yesterday"; return d.toLocaleDateString([], {day:"2-digit",month:"2-digit",year:"2-digit"}); }
function cacheKey(uid) { return CACHE + uid; }
function profileKey(uid) { return PROFILE + uid; }
function preview(c, uid) { const t = c.lastMessage || ""; if (!t) return "No messages yet"; return c.lastMessageSenderId === uid ? `You: ${t}` : t; }

function installCSS() {
  if ($("#sheWhatsAppChatCSS")) return;
  const s = document.createElement("style"); s.id = "sheWhatsAppChatCSS";
  s.textContent = `
    .phone-app .chat-list{padding:0 0 92px!important;overflow-x:hidden!important;overflow-y:auto!important;background:#fff!important}
    .phone-app .chat-list .chat-item{box-sizing:border-box!important;width:100%!important;min-height:74px!important;margin:0!important;padding:10px 15px!important;display:flex!important;align-items:center!important;border:0!important;border-bottom:1px solid #edf0ee!important;background:#fff!important;cursor:pointer!important}
    .phone-app .chat-list .chat-item:active{background:#f1f3f2!important}
    .phone-app .chat-list .chat-avatar{width:52px!important;height:52px!important;min-width:52px!important;margin-right:13px!important;border-radius:50%!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:23px!important}
    .phone-app .chat-list .chat-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
    .phone-app .chat-list .chat-info{min-width:0!important;flex:1!important}
    .phone-app .chat-list .chat-top{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;min-width:0!important}
    .phone-app .chat-list .chat-top h3{margin:0!important;min-width:0!important;flex:1!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:16px!important;font-weight:600!important}
    .phone-app .chat-list .message-time{flex:none!important;font-size:11px!important;white-space:nowrap!important;opacity:.7!important}
    .phone-app .chat-list .chat-bottom{display:flex!important;align-items:center!important;min-width:0!important;margin-top:4px!important}
    .phone-app .chat-list .chat-bottom p{margin:0!important;min-width:0!important;flex:1!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:13.5px!important;color:#66706c!important}
    .phone-app .chat-list .chat-item.unread .chat-top h3{font-weight:700!important}
    .phone-app .chat-list .chat-item.unread .chat-bottom p{font-weight:600!important;color:#202925!important}
    .phone-app .chat-list .unread-badge{flex:none!important;min-width:20px!important;height:20px!important;padding:0 5px!important;margin-left:8px!important;border-radius:10px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:11px!important;font-weight:700!important;background:#078b59!important;color:#fff!important}
  `;
  document.head.appendChild(s);
}

function render(items, uid, save = true) {
  const list = $("#chatList") || $(".chat-list"); if (!list) return;
  const sorted = [...items].sort((a,b) => ms(b.lastMessageTime || b.updatedAt) - ms(a.lastMessageTime || a.updatedAt));
  if (save) write(cacheKey(uid), sorted);
  if (!sorted.length) { list.innerHTML = '<div class="message received"><p>No chats yet. Start a new chat!</p></div>'; return; }
  const html = sorted.map(c => {
    const id = otherUid(c, uid); if (!id) return "";
    const p = read(profileKey(id), {}) || {};
    const name = p.displayName || c.otherDisplayName || "User";
    const photo = p.photoData || c.otherPhotoData || "";
    const unread = Array.isArray(c.unreadBy) && c.unreadBy.includes(uid);
    const count = Number((c.unreadCount && c.unreadCount[uid]) || (unread ? 1 : 0));
    const avatar = photo ? `<img src="${esc(photo)}" alt="Profile photo">` : "👤";
    return `<div class="chat-item${unread ? " unread" : ""}" data-chat-uid="${esc(id)}"><div class="avatar chat-avatar">${avatar}</div><div class="chat-info"><div class="chat-top"><h3>${esc(name)}</h3><span class="message-time">${esc(time(c.lastMessageTime || c.updatedAt))}</span></div><div class="chat-bottom"><p>${esc(preview(c, uid))}</p>${unread ? `<span class="unread-badge">${count}</span>` : ""}</div></div></div>`;
  }).join("");
  list.innerHTML = html;
  list.querySelectorAll(".chat-item[data-chat-uid]").forEach(row => row.addEventListener("click", () => openInstant(row.dataset.chatUid), { once: true }));
}

function renderCache(uid) { const c = read(cacheKey(uid), []); if (Array.isArray(c) && c.length) render(c, uid, false); }
function openInstant(uid) { if (!uid) return; localStorage.setItem("currentChatUid", uid); const p = read(profileKey(uid), {}); if (p?.displayName) localStorage.setItem("currentChatName", p.displayName); window.location.href = "chat.html"; }

// Capture before app.js inline onclick handlers so navigation does not wait for Firebase.
document.addEventListener("click", (e) => { const row = e.target.closest?.("#chatList .chat-item[data-chat-uid]"); if (!row) return; e.preventDefault(); e.stopImmediatePropagation(); openInstant(row.dataset.chatUid); }, true);

async function start() {
  installCSS();
  const list = $("#chatList") || $(".chat-list"); if (!list) return;
  // Restore the exact previous visible list immediately.
  const storedUser = read("she_current_user", null);
  if (storedUser?.uid) renderCache(storedUser.uid);
  try {
    const [appMod, authMod, fs] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);
    const apps = appMod.getApps();
    const app = apps.length ? apps[0] : appMod.initializeApp(firebaseConfig);
    auth = authMod.getAuth(app); db = fs.getFirestore(app);
    authMod.onAuthStateChanged(auth, user => {
      if (!user) return;
      activeUid = user.uid;
      renderCache(activeUid);
      const q = fs.query(fs.collection(db, "conversations"), fs.where("participants", "array-contains", activeUid));
      if (unsubscribe) unsubscribe();
      unsubscribe = fs.onSnapshot(q, async snap => {
        const items = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        // Save the conversation data first so the next visit is instant.
        write(cacheKey(activeUid), items);
        const ids = [...new Set(items.map(c => otherUid(c, activeUid)).filter(Boolean))];
        await Promise.all(ids.map(async id => { try { const s = await fs.getDoc(fs.doc(db, "users", id)); if (s.exists()) write(profileKey(id), s.data()); } catch {} }));
        if (activeUid) render(items, activeUid, true);
      }, err => console.warn("Chat list sync error", err));
    });
  } catch (e) { console.warn("WhatsApp chat list unavailable", e); }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true}); else start();
