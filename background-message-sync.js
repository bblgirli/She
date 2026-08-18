(()=>{
  // Background message sync for every conversation. This is intentionally
  // independent from chat.html's current-conversation listener.
  const FIREBASE_APP='https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
  const FIREBASE_AUTH='https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
  const FIREBASE_FS='https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
  const CACHE_KEY='she_background_messages_v1';
  let started=false;
  let unsubConversations=null;
  const messageUnsubs=new Map();
  const seen=new Set();
  const cached=(()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')}catch(_){return {}}})();

  async function boot(){
    if(started)return;
    if(document.visibilityState==='hidden' && !navigator.onLine)return;
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
      const conversations=query(collection(F.getFirestore(app),'conversations'),where('participants','array-contains',user.uid));
      unsubConversations=onSnapshot(conversations,snap=>{
        const active=new Set();
        snap.docs.forEach(docSnap=>{
          const c=docSnap.data()||{};
          const cid=docSnap.id;
          active.add(cid);
          if(!messageUnsubs.has(cid)){
            const q=query(collection(F.getFirestore(app),'conversations',cid,'messages'),orderBy('createdAt','asc'));
            const unsub=onSnapshot(q,msgSnap=>{
              const list=[];
              msgSnap.docs.forEach(m=>{
                const d=m.data()||{};
                const item={id:m.id,...d};
                list.push(item);
                cached[cid]=list;
                const key=cid+'_'+m.id;
                if(!seen.has(key)){
                  seen.add(key);
                  // Only notify for genuinely incoming messages. Existing
                  // history is cached silently on the first snapshot.
                  if(d.senderId && d.senderId!==user.uid && !msgSnap.metadata.fromCache){
                    notifyIncoming(cid,c,item,user);
                  }
                }
              });
              try{localStorage.setItem(CACHE_KEY,JSON.stringify(cached))}catch(_){/* quota */}
            },err=>console.warn('BACKGROUND MESSAGE LISTENER',cid,err));
            messageUnsubs.set(cid,unsub);
          }
        });
        for(const [cid,unsub] of messageUnsubs){if(!active.has(cid)){unsub();messageUnsubs.delete(cid)}}
      },err=>console.warn('BACKGROUND CONVERSATION LISTENER',err));
      console.log('BACKGROUND MESSAGE SYNC ON');
    }catch(e){console.warn('BACKGROUND MESSAGE SYNC',e)}
  }

  function notifyIncoming(conversationId,conversation,message,user){
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    const current=localStorage.getItem('currentChatUid');
    const other=(conversation.participants||[]).find(x=>x!==user.uid);
    if(current===other)return;
    const body=message.text|| (message.audioData?'🎤 Voice message':'📎 New message');
    const name=conversation.otherDisplayName||conversation.senderName||'New message';
    const n=new Notification(name,{body:String(body).slice(0,120),tag:'she-msg-'+conversationId,renotify:true});
    n.onclick=()=>{window.focus();if(other&&typeof window.startChatWithUser==='function')window.startChatWithUser(other,name)};
    setTimeout(()=>n.close(),6000);
  }

  window.sheBackgroundSync={start:boot,getCached:()=>cached};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')boot()});
  window.addEventListener('online',boot);
})();
