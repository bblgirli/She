(()=>{
  const NativeNotification=window.Notification;
  if(NativeNotification&&!window.__shePageNotificationsSuppressed){
    const SilentNotification=function(){return{close(){},onclick:null,onshow:null,onerror:null,onclose:null}};
    Object.defineProperties(SilentNotification,{permission:{get:()=>NativeNotification.permission},requestPermission:{value:(...args)=>NativeNotification.requestPermission(...args)},maxActions:{get:()=>NativeNotification.maxActions}});
    window.Notification=SilentNotification;
    window.__shePageNotificationsSuppressed=true;
  }
  const VAPID_PUBLIC_KEY='BOO7jaXg1FQ4fgnb08wiIdeA8x4s01z9Ufq-b1c4IBpCoAv5obcv69rSlxeVh1gzJV0axaBeZJjtT8xzhb0QcwY';let pushReady=false,booting=false;
  async function firebase(){const A=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');const U=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');const F=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');const{firebaseConfig}=await import('./firebase-config.js');const app=A.getApps().length?A.getApps()[0]:A.initializeApp(firebaseConfig);return{auth:U.getAuth(app),db:F.getFirestore(app),F,U}}
  function key(b){const p='='.repeat((4-b.length%4)%4),s=(b+p).replace(/-/g,'+').replace(/_/g,'/'),r=atob(s);return Uint8Array.from(r,c=>c.charCodeAt(0))}
  async function waitUser(auth){if(auth.currentUser)return auth.currentUser;return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{if(!done){done=true;unsub();reject(Error('AUTH_TIMEOUT'))}},30000);const unsub=auth.onAuthStateChanged(u=>{if(u&&!done){done=true;clearTimeout(timer);unsub();resolve(u)}})})}
  async function register(requestPermission=false){if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)||!window.isSecureContext)throw Error('UNSUPPORTED');const{auth,db,F}=await firebase();const u=await waitUser(auth);const reg=await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=13',{scope:'/'});await navigator.serviceWorker.ready;let permission=Notification.permission;if(requestPermission&&permission==='default')permission=await NativeNotification.requestPermission();if(permission!=='granted')return false;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key(VAPID_PUBLIC_KEY)});const json=sub.toJSON();await F.setDoc(F.doc(db,'pushSubscriptions',u.uid),{uid:u.uid,subscription:json,endpoint:json.endpoint,updatedAt:F.serverTimestamp()},{merge:true});pushReady=true;return true}
  async function boot(){if(pushReady||booting)return;booting=true;try{await register(false)}catch(_){}finally{booting=false}}
  window.shePush={register:()=>register(false)};
  window.enableCallNotifications=async()=>{pushReady=false;return register(true)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();