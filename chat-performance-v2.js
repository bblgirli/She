import { firebaseConfig } from "./firebase-config.js";

const CHAT_CACHE_PREFIX = "she_chats_cache_v2_";
const PROFILE_CACHE_PREFIX = "she_profile_cache_v2_";
let perfAuth = null;
let perfDb = null;
let unsubscribeChats = null;
let latestChats = [];
let currentUid = null;
let rendering = false;

const cacheKey = uid => `${CHAT_CACHE_PREFIX}${uid}`;
const profileKey = uid => `${PROFILE_CACHE_PREFIX}${uid}`;
function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }
function writeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function escapeHTML(value) { const d = document.createElement("div"); d.textContent = value == null ? "" : String(value); return d.innerHTML; }
function otherUid(chat, uid) { return chat.participants?.find(id => id !== uid) || ""; }
function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  const n = new Date(value).getTime(); return Number.isFinite(n) ? n : 0;
}
function formatListTime(value) {
  const ms = timestampMs(value); if (!ms) return "";
  const d = new Date(ms), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
  const y = new Date(now); y.setDate(now.getDate()-1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {day:"2-digit", month:"2-digit", year:"2-digit"});
}
function previewText(chat, uid) {
  const text = chat.lastMessage || "No messages yet";
  return chat.lastMessage && chat.lastMessageSenderId === uid ? `You: ${text}` : text;
}
function installStyles() {
  if (document.getElementById("chatPerformanceV2Styles")) return;
  const s = document.createElement("style"); s.id = "chatPerformanceV2Styles";
  s.textContent = `
#chatList.chat-list{background:#fff;padding-bottom:90px}
#chatList .chat-item{min-height:72px;padding:9px 15px;border-bottom:1px solid #edf0ee;background:#fff;border-left:0;cursor:pointer}
#chatList .chat-item:active{background:#f0f2f5}
#chatList .chat-avatar{width:52px;height:52px;margin-right:13px;flex:none}
#chatList .chat-info{min-width:0;flex:1}
#chatList .chat-top{min-width:0;gap:8px}
#chatList .chat-top h3{margin:0;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#chatList .message-time{flex:none;font-size:11px}
#chatList .chat-bottom{margin-top:4px;min-width:0}
#chatList .chat-bottom p{margin:0;max-width:none;flex:1;min-width:0;font-size:13px;color:#66706c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#chatList .chat-item.unread .chat-bottom p{color:#1f2925;font-weight:600}
#chatList .unread-badge{flex:none;min-width:20px;width:auto;height:20px;padding:0 5px;margin-left:8px;font-size:11px}
#chatList .empty-chats{padding:50px 20px;text-align:center;color:#777}`;
  document.head.appendChild(s);
}
function renderChats(items, uid, save=true) {
  const container = document.getElementById("chatList"); if (!container) return;
  rendering = true;
  const sorted = [...items].sort((a,b)=>timestampMs(b.lastMessageTime||b.updatedAt)-timestampMs(a.lastMessageTime||a.updatedAt));
  if(save) writeJSON(cacheKey(uid), sorted);
  if(!sorted.length){container.innerHTML='<div class="empty-chats">No chats yet. Start a new chat!</div>';rendering=false;return;}
  container.innerHTML = sorted.map(chat=>{
    const id=otherUid(chat,uid); if(!id) return "";
    const profile=readJSON(profileKey(id),{})||{};
    const name=profile.displayName||chat.otherDisplayName||"User";
    const photo=profile.photoData||chat.otherPhotoData||"";
    const unread=Array.isArray(chat.unreadBy)&&chat.unreadBy.includes(uid);
    const count=Number(chat.unreadCount?.[uid]|| (unread?1:0));
    const avatar=photo?`<img src="${escapeHTML(photo)}" alt="Profile photo">`:"👤";
    return `<div class="chat-item ${unread?"unread":""}" data-chat-uid="${escapeHTML(id)}"><div class="avatar chat-avatar">${avatar}</div><div class="chat-info"><div class="chat-top"><h3>${escapeHTML(name)}</h3><span class="message-time">${formatListTime(chat.lastMessageTime||chat.updatedAt)}</span></div><div class="chat-bottom"><p>${escapeHTML(previewText(chat,uid))}</p>${unread?`<span class="unread-badge">${count}</span>`:""}</div></div></div>`;
  }).join("");
  container.querySelectorAll(".chat-item[data-chat-uid]").forEach(el=>el.addEventListener("click",()=>fastOpenChat(el.dataset.chatUid)));
  requestAnimationFrame(()=>{rendering=false;});
}
function renderCached(uid){const cached=readJSON(cacheKey(uid),[]);if(Array.isArray(cached)&&cached.length)renderChats(cached,uid,false);}
async function refreshProfiles(chats,uid){
  try{
    const {doc,getDoc}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const ids=[...new Set(chats.map(c=>otherUid(c,uid)).filter(Boolean))];
    await Promise.all(ids.map(async id=>{try{const snap=await getDoc(doc(perfDb,"users",id));if(snap.exists())writeJSON(profileKey(id),snap.data());}catch{}}));
    renderChats(chats,uid,true);
  }catch{}
}
function watchForOldRenderer(){
  const list=document.getElementById("chatList"); if(!list) return;
  const observer=new MutationObserver(()=>{
    if(rendering || !currentUid || !latestChats.length) return;
    clearTimeout(window.__sheChatPerfRepairTimer);
    window.__sheChatPerfRepairTimer=setTimeout(()=>{
      if(!rendering) renderChats(latestChats,currentUid,false);
    },0);
  });
  observer.observe(list,{childList:true,subtree:true});
}
async function start(){
  try{
    const [{getApps},authMod,fs]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);
    let tries=0;
    while(!getApps().length && tries++<100) await new Promise(r=>setTimeout(r,50));
    const apps=getApps();
    if(!apps.length) throw new Error("Firebase is not initialized yet");
    const app=apps[0];
    perfAuth=authMod.getAuth(app); perfDb=fs.getFirestore(app);
    authMod.onAuthStateChanged(perfAuth,user=>{
      if(!user)return;
      currentUid=user.uid;
      renderCached(currentUid);
      const q=fs.query(fs.collection(perfDb,"conversations"),fs.where("participants","array-contains",currentUid));
      if(unsubscribeChats)unsubscribeChats();
      unsubscribeChats=fs.onSnapshot(q,snapshot=>{
        latestChats=snapshot.docs.map(d=>({id:d.id,...d.data()}));
        renderChats(latestChats,currentUid,true);
        refreshProfiles(latestChats,currentUid);
      },err=>console.warn("Chat list sync error",err));
    });
    watchForOldRenderer();
  }catch(error){console.warn("Chat performance layer unavailable",error);}
}
function fastOpenChat(uid){
  if(!uid)return;
  const profile=readJSON(profileKey(uid),{})||{};
  localStorage.setItem("currentChatUid",uid);
  if(profile.displayName)localStorage.setItem("currentChatName",profile.displayName);
  window.location.assign("chat.html");
}
window.openChat=fastOpenChat;
installStyles();
start();
