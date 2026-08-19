/* Chats V2 data polish: real activity dates, pin/mute markers, and Favorites filtering. */
(()=>{
  'use strict';
  let db=null,auth=null,fs=null;
  const list=()=>document.getElementById('chatList');
  const uidOf=r=>r?.dataset?.chatUid||(r?.getAttribute('onclick')||'').match(/openChat\(['"]([^'"]+)['"]\)/)?.[1]||'';
  const dateOf=v=>{if(!v)return null;if(v.toDate)return v.toDate();if(v.seconds)return new Date(v.seconds*1000);const d=new Date(v);return isNaN(d)?null:d};
  const day=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  const label=d=>{const n=new Date(),diff=Math.round((day(n)-day(d))/86400000);if(diff===0)return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});if(diff===1)return 'Yesterday';if(diff<7)return d.toLocaleDateString([], {weekday:'long'});return d.toLocaleDateString([], {month:'short',day:'numeric',year:d.getFullYear()!==n.getFullYear()?'numeric':undefined});};
  const separator=d=>{const n=new Date(),diff=Math.round((day(n)-day(d))/86400000);if(diff===0)return 'Today';if(diff===1)return 'Yesterday';return d.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric',year:d.getFullYear()!==n.getFullYear()?'numeric':undefined});};
  async function firebase(){if(db)return {db,auth,fs};try{const a=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),au=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');fs=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');if(!a.getApps().length)return null;const app=a.getApp();auth=au.getAuth(app);db=fs.getFirestore(app);return {db,auth,fs}}catch{return null}}
  async function apply(){const f=await firebase(),l=list();if(!f||!l||!f.auth.currentUser)return;const rows=[...l.querySelectorAll(':scope > .chat-item')],me=f.auth.currentUser.uid;let meta=[];
    for(const r of rows){const other=uidOf(r);if(!other)continue;try{const cid=[me,other].sort().join('_');const snap=await f.fs.getDoc(f.fs.doc(f.db,'conversations',cid));const c=snap.data()||{};const d=dateOf(c.lastMessageTime||c.updatedAt);r.dataset.activityDate=d?d.toISOString():'';const t=r.querySelector('.she-time');if(t&&d)t.textContent=label(d);if(c.pinned){r.classList.add('she-pinned');const n=r.querySelector('.chat-top h3');if(n&&!n.querySelector('.she-pin')){const i=document.createElement('span');i.className='she-pin';i.textContent='📌';n.appendChild(i)}}if(c.muted){r.classList.add('she-muted');const n=r.querySelector('.chat-top h3');if(n&&!n.querySelector('.she-mute')){const i=document.createElement('span');i.className='she-mute';i.textContent='🔕';n.appendChild(i)}}meta.push({r,d})}catch{}}
    document.querySelectorAll('#chatList .she-date-separator').forEach(e=>e.remove());let last=0;for(const {r,d} of meta){if(!d)continue;const k=day(d);if(k===last)continue;last=k;const s=document.createElement('div');s.className='she-date-separator';s.textContent=separator(d);r.before(s)}
    window.__sheChatsMeta=meta;
  }
  function bindFavorites(){document.querySelectorAll('.chat-tabs button').forEach(b=>{if(b.dataset.sheFavBound)return;b.dataset.sheFavBound='1';b.addEventListener('click',()=>{const mode=(b.textContent||'').trim().toLowerCase();if(mode!=='favorites')return;document.querySelectorAll('#chatList > .chat-item').forEach(r=>r.style.display=r.classList.contains('she-pinned')?'':'none')})})}
  function boot(){if(location.pathname.split('/').pop()!=='chats.html')return;bindFavorites();setTimeout(apply,500);const l=list();if(l)new MutationObserver(()=>setTimeout(apply,150)).observe(l,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
