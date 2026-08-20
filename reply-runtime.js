(()=>{
  const FIREBASE_VERSION='10.12.2';
  const input=()=>document.getElementById('messageInput');
  let replyTarget=null;

  function rememberReply(detail){
    if(!detail?.id)return;
    replyTarget={id:String(detail.id),text:String(detail.text||'')};
    const i=input();
    if(!i)return;
    i.dataset.replyTo=replyTarget.id;
    i.dataset.replyText=replyTarget.text;
    i.setAttribute('data-reply-to',replyTarget.id);
    i.setAttribute('data-reply-text',replyTarget.text);
    i.focus();
  }

  function clearReply(){
    replyTarget=null;
    const i=input();
    if(i){delete i.dataset.replyTo;delete i.dataset.replyText;i.removeAttribute('data-reply-to');i.removeAttribute('data-reply-text');i.placeholder='Type a message';}
  }

  function getText(){
    const i=input();
    return (i?.innerText||'').replace(/\u00a0/g,' ').trim();
  }

  async function sendReplyMessage(e){
    if(!replyTarget)return false;
    const text=getText();
    if(!text)return false;
    const uid=localStorage.getItem('she_current_user');
    let currentUser=null;
    try{currentUser=uid?JSON.parse(uid):null}catch{}
    const other=localStorage.getItem('currentChatUid');
    if(!currentUser?.uid||!other)return false;

    try{
      const [cfg,appMod,authMod,fs]=await Promise.all([
        import('./firebase-config.js'),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
      ]);
      const apps=appMod.getApps();
      const app=apps.length?apps[0]:appMod.initializeApp(cfg.firebaseConfig);
      const auth=authMod.getAuth(app);
      const db=fs.getFirestore(app);
      const sender=auth.currentUser?.uid||currentUser.uid;
      const conversationId=[sender,other].sort().join('_');
      const {collection,addDoc,serverTimestamp,doc,updateDoc}=fs;
      const messageRef=await addDoc(collection(db,'conversations',conversationId,'messages'),{
        senderId:sender,
        text,
        status:'sent',
        createdAt:serverTimestamp(),
        replyToId:replyTarget.id,
        replyToText:replyTarget.text
      });
      try{
        await updateDoc(doc(db,'conversations',conversationId),{
          lastMessage:text,
          lastMessageSenderId:sender,
          lastMessageTime:serverTimestamp(),
          updatedAt:serverTimestamp(),
          unreadBy:[other]
        });
      }catch{}
      const i=input();
      if(i){i.textContent='';i.dispatchEvent(new Event('input',{bubbles:true}));}
      clearReply();
      window.dispatchEvent(new CustomEvent('sheMessagesChanged'));
      return !!messageRef;
    }catch(err){
      console.error('Reply send failed:',err);
      return false;
    }
  }

  window.addEventListener('sheReplyToMessage',e=>rememberReply(e.detail||{}));
  document.addEventListener('click',async e=>{
    const button=e.target.closest('#sendMessageButton');
    if(!button||!replyTarget)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    await sendReplyMessage(e);
  },true);
  document.addEventListener('keydown',async e=>{
    const i=input();
    if(!i||document.activeElement!==i||!replyTarget||e.key!=='Enter'||e.shiftKey)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    await sendReplyMessage(e);
  },true);
  window.cancelSheReply=clearReply;
})();
