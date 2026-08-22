/* Stable chat presence UI. One timestamp source; never rewrites last-seen from client time. */
(function () {
  "use strict";
  let unsubscribe = null, timer = null, data = null;
  const stamp = v => v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : Number(new Date(v)) || 0;
  function relative(ms) {
    const diff = Math.max(0, Date.now() - ms), sec=Math.floor(diff/1000), min=Math.floor(sec/60), hr=Math.floor(min/60), day=Math.floor(hr/24);
    if (sec < 60) return "just now";
    if (min < 60) return `${min} minute${min===1?'':'s'} ago`;
    if (hr < 24) return `${hr} hour${hr===1?'':'s'} ago`;
    if (day < 7) return `${day} day${day===1?'':'s'} ago`;
    return new Date(ms).toLocaleDateString([], {day:'numeric',month:'short',year:'numeric'});
  }
  function render() {
    const el=document.getElementById('chatPresence') || document.querySelector('.chat-profile p');
    if(!el||!data)return;
    const active=stamp(data.lastActiveAt), fresh=active>0 && Date.now()-active<75000;
    if(data.online===true && fresh){el.textContent='Online';return;}
    const seen=stamp(data.lastSeen);
    el.textContent=seen>0 ? `Last seen ${relative(seen)}` : 'Offline';
  }
  function attach(){
    const rt=window.SheFirebase, uid=localStorage.getItem('currentChatUid');
    if(!rt?.db||!rt?.firestore||!uid)return false;
    unsubscribe?.(); clearInterval(timer);
    unsubscribe=rt.firestore.onSnapshot(rt.firestore.doc(rt.db,'users',uid),s=>{data=s.data()||{};render()},()=>{data=null;render()});
    timer=setInterval(render,15000); return true;
  }
  if(!attach()) window.addEventListener('she:firebase-ready',attach,{once:true});
  window.addEventListener('storage',e=>{if(e.key==='currentChatUid')attach()});
  window.addEventListener('pagehide',()=>{unsubscribe?.();clearInterval(timer)});
})();
