/* Single mobile presence coordinator: preserves last-seen and rejects stale Online. */
(function () {
  "use strict";
  const STALE_MS = 75000;
  let timer = null;
  let ownUnsub = null;
  let contactUnsub = null;
  let lastSeenCache = null;

  function ms(v) {
    if (!v) return 0;
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v.toDate === "function") return v.toDate().getTime();
    if (v.seconds) return v.seconds * 1000;
    const n = new Date(v).getTime();
    return Number.isFinite(n) ? n : 0;
  }
  function time(v) {
    const n = ms(v);
    return n ? `Last seen ${new Date(n).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})}` : "Offline";
  }

  async function start() {
    try {
      const [{getApps,getApp},{getAuth,onAuthStateChanged},{getFirestore,doc,onSnapshot,setDoc,serverTimestamp}] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
      ]);
      if (!getApps().length) return setTimeout(start,500);
      const auth=getAuth(getApp()), db=getFirestore(getApp());

      async function write(online) {
        const u=auth.currentUser; if(!u) return;
        const p={uid:u.uid,online:!!online,updatedAt:serverTimestamp()};
        if(online) p.lastActive=serverTimestamp();
        else {p.lastSeen=serverTimestamp();p.lastActive=null;}
        await setDoc(doc(db,"users",u.uid),p,{merge:true}).catch(()=>{});
      }

      function render(d) {
        const el=document.querySelector(".chat-profile p"); if(!el) return;
        const active=ms(d.lastActive||d.updatedAt);
        el.textContent=(d.online===true && active && Date.now()-active<=STALE_MS) ? "Online" : time(d.lastSeen);
      }

      onAuthStateChanged(auth, async user=>{
        if(timer) clearInterval(timer); timer=null;
        ownUnsub?.(); ownUnsub=null;
        contactUnsub?.(); contactUnsub=null;
        if(!user) return;

        ownUnsub=onSnapshot(doc(db,"users",user.uid),snap=>{
          const d=snap.data()||{};
          const seen=ms(d.lastSeen);
          if(seen) { lastSeenCache=seen; localStorage.setItem("she_last_seen_"+user.uid,String(seen)); }
          else {
            const cached=Number(localStorage.getItem("she_last_seen_"+user.uid)||0);
            if(cached && d.online===true) {
              setDoc(doc(db,"users",user.uid),{lastSeen:new Date(cached)},{merge:true}).catch(()=>{});
            }
          }
        });

        await write(document.visibilityState==="visible");
        timer=setInterval(()=>{if(document.visibilityState==="visible")write(true)},30000);

        const uid=localStorage.getItem("currentChatUid");
        if(uid) contactUnsub=onSnapshot(doc(db,"users",uid),s=>render(s.data()||{}));
      });

      document.addEventListener("visibilitychange",()=>{if(auth.currentUser)write(document.visibilityState==="visible")});
      window.addEventListener("pagehide",()=>{if(auth.currentUser)write(false)});
      setInterval(()=>{
        const el=document.querySelector(".chat-profile p");
        if(el && el.textContent==="Online") {
          const uid=localStorage.getItem("currentChatUid");
          if(uid) getFirestore(getApp());
        }
      },15000);
    } catch(e) { console.warn("Presence v3 unavailable",e); setTimeout(start,1000); }
  }
  start();
})();
