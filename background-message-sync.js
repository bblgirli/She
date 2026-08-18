(()=>{
  // Silent background cache for every conversation. Notifications are handled
  // only by the server push pipeline/service worker so each new message is
  // delivered once instead of once per page/listener.
  const FIREBASE_APP='https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
  const FIREBASE_AUTH='https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
  const FIREBASE_FS='https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
  const CACHE_KEY='she_background_messages_v1';
  let started=false;
  const messageUnsubs=new Map();
  const cached=(()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')}catch(_){return {}}})();

  async function boot(){
    if(started)return;
    try{
      const [A,U,F,C]=await Promise.all([
        import(FIREBASE_APP),import(FIREBASE_AUTH),import(FIREBASE_FS),import('./firebase-config.js')
      ]);
      const app=A.getApps().length?A.getApps()[0]:A.initializeApp(C.firebaseConfig);
      const auth=U.getAuth(app);
      await U.setPersistence(auth,U.browserLocalPersistence).catch(()=>{});
      let user=auth.currentUser;
      if(!user){
        user=await new Promise(resolve=>{
          let done=false;
          const timer=setTimeout(()=>{if(!done){done=true;unsub?.();resolve(null)}},12000);
          const unsub=U.onAuthStateChanged(auth,u=>{if(u&&!done){done=true;clearTimeout(timer);unsub();resolve(u)}});
        });
      }
      if(!user)return;
      started=true;
      const {collection,query,where,onSnapshot,orderBy}=F;
      const db=F.getFirestore(app);
      const conversations=query(collection(db,'conversations'),where('participants','array-contains',user.uid));
      onSnapshot(conversations,snap=>{
        const active=new Set();
        snap.docs.forEach(docSnap=>{
          const cid=docSnap.id;
          active.add(cid);
          if(messageUnsubs.has(cid))return;
          const q=query(collection(db,'conversations',cid,'messages'),orderBy('createdAt','asc'));
          const unsub=onSnapshot(q,msgSnap=>{
            const list=msgSnap.docs.map(m=>({id:m.id,...(m.data()||{})}));
            cached[cid]=list;
            try{localStorage.setItem(CACHE_KEY,JSON.stringify(cached))}catch(_){/* quota */}
          },err=>console.warn('BACKGROUND MESSAGE LISTENER',cid,err));
          messageUnsubs.set(cid,unsub);
        });
        for(const [cid,unsub] of messageUnsubs){if(!active.has(cid)){unsub();messageUnsubs.delete(cid)}}
      },err=>console.warn('BACKGROUND CONVERSATION LISTENER',err));
      console.log('BACKGROUND MESSAGE CACHE SYNC ON');
    }catch(e){console.warn('BACKGROUND MESSAGE SYNC',e)}
  }

  window.sheBackgroundSync={start:boot,getCached:()=>cached};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('online',boot);
})();
