(()=>{
const FIREBASE_APP='https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
const FIREBASE_AUTH='https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
const FIREBASE_FS='https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const S={db:null,auth:null,fs:null,docs:[],cid:null};
let decorateTimer=0;

async function fb(){
  if(S.db&&S.auth)return S;
  const cfg=await import('./firebase-config.js');
  const appm=await import(FIREBASE_APP), authm=await import(FIREBASE_AUTH), fs=await import(FIREBASE_FS);
  const apps=appm.getApps();
  const app=apps.length?apps[0]:appm.initializeApp(cfg.firebaseConfig);
  S.auth=authm.getAuth(app); S.db=fs.getFirestore(app); S.fs=fs; return S;
}

async function loadDocs(){
  const x=await fb(),uid=x.auth.currentUser?.uid,other=localStorage.getItem('currentChatUid');
  if(!uid||!other)return[];
  S.cid=[uid,other].sort().join('_');
  const {collection,query,orderBy,getDocs}=x.fs;
  const snap=await getDocs(query(collection(x.db,'conversations',S.cid,'messages'),orderBy('createdAt','asc')));
  S.docs=snap.docs; return S.docs;
}

function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}

async function decorate(){
  try{
    const docs=await loadDocs();
    const els=[...document.querySelectorAll('#messages .message')];
    els.forEach((el,i)=>{
      const d=docs[i]; if(!d)return;
      const m=d.data();
      el.dataset.messageId=d.id;
      el.dataset.messageIndex=String(i);
      el.querySelector('.message-reaction-badge')?.remove();
      el.querySelector('.message-reply-preview')?.remove();
      el.querySelector('.message-edited-label')?.remove();
      if(m.deleted){
        const b=el.querySelector('.message-body');
        if(b)b.innerHTML='<p class="she-deleted-text">This message was deleted</p>';
        el.classList.add('she-deleted');
      }else{
        el.classList.remove('she-deleted');
      }
      if(m.edited&&!m.deleted){
        const meta=el.querySelector('.message-meta');
        if(meta){const x=document.createElement('span');x.className='message-edited-label';x.textContent='edited';meta.insertBefore(x,meta.firstChild)}
      }
      if(m.reactions){
        const counts={}; Object.values(m.reactions).forEach(e=>{if(e)counts[e]=(counts[e]||0)+1});
        const txt=Object.entries(counts).map(([e,n])=>e+(n>1?' '+n:'')).join(' ');
        if(txt){const r=document.createElement('div');r.className='message-reaction-badge';r.textContent=txt;el.appendChild(r)}
      }
      if(m.replyTo){
        const r=document.createElement('div');r.className='message-reply-preview';
        r.innerHTML='<b>↩ Reply</b><span>'+esc(m.replyTo.text||'Message')+'</span>';
        el.querySelector('.message-body')?.prepend(r);
      }
    });
  }catch(e){console.warn('Message action sync failed',e)}
}

async function findMessage(element,id){
  const docs=S.docs.length?S.docs:await loadDocs();
  const idx=Number(element?.dataset?.messageIndex);
  if(Number.isInteger(idx)&&docs[idx])return docs[idx];
  return docs.find(d=>d.id===id)||null;
}

async function react(e){
  try{
    const x=await fb(),d=await findMessage(e.detail?.element,e.detail?.id); if(!d)return;
    const uid=x.auth.currentUser?.uid; if(!uid)return;
    const {updateDoc,serverTimestamp}=x.fs;
    const current=d.data().reactions||{};
    const value=current[uid]===e.detail.emoji?null:e.detail.emoji;
    const patch={}; patch['reactions.'+uid]=value; patch.updatedAt=serverTimestamp();
    await updateDoc(d.ref,patch);
    await decorate();
  }catch(err){console.error('Reaction failed',err)}
}

async function del(e){
  try{
    const x=await fb(),d=await findMessage(e.detail?.element,e.detail?.id); if(!d)return;
    await x.fs.updateDoc(d.ref,{deleted:true,text:'This message was deleted',updatedAt:x.fs.serverTimestamp()});
  }catch(err){console.error('Delete failed',err)}
}

function setReply(e){
  const d=e.detail||{};
  window.__sheReplyTo={id:d.id||d.element?.dataset?.messageId||'',text:d.text||'',element:d.element||null};
  const i=document.getElementById('messageInput');
  if(i){i.dataset.replyTo=window.__sheReplyTo.id;i.placeholder='Replying to: '+(window.__sheReplyTo.text||'message')}
}

function setEdit(e){
  const id=e.detail?.id||e.detail?.element?.dataset?.messageId||'';
  window.__sheEditingId=id;
  const i=document.getElementById('messageInput');
  if(i){i.dataset.editingId=id;i.dataset.editingMode='1';i.placeholder='Edit message'}
}

async function editSend(){
  const i=document.getElementById('messageInput'),id=window.__sheEditingId||i?.dataset?.editingId;
  if(!i||!id)return false;
  const text=i.value.trim(); if(!text)return true;
  const x=await fb(),d=await findMessage(document.querySelector('#messages .message[data-message-id="'+CSS.escape(id)+'"]'),id);
  if(!d)return false;
  await x.fs.updateDoc(d.ref,{text,edited:true,updatedAt:x.fs.serverTimestamp()});
  i.value=''; delete i.dataset.editingId; delete i.dataset.editingMode; window.__sheEditingId=null; i.placeholder='Type a message';
  return true;
}

async function replySend(text){
  const r=window.__sheReplyTo; if(!r||!text)return false;
  const x=await fb(),uid=x.auth.currentUser?.uid,other=localStorage.getItem('currentChatUid');
  if(!uid||!other)return false;
  const d=await findMessage(r.element,r.id),m=d?.data()||{};
  const {collection,addDoc,setDoc,doc,serverTimestamp}=x.fs;
  await addDoc(collection(x.db,'conversations',S.cid,'messages'),{
    senderId:uid,receiverId:other,text,
    replyTo:{id:r.id,text:r.text||m.text||'',senderId:m.senderId||''},
    createdAt:serverTimestamp(),status:'sent'
  });
  await setDoc(doc(x.db,'conversations',S.cid),{participants:[uid,other],lastMessage:text,lastMessageSenderId:uid,lastMessageTime:serverTimestamp(),updatedAt:serverTimestamp(),unreadBy:[other]},{merge:true});
  const i=document.getElementById('messageInput');
  if(i){i.value='';delete i.dataset.replyTo;i.placeholder='Type a message'}
  window.__sheReplyTo=null;
  return true;
}

function interceptSending(){
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('#sendMessageButton'); if(!btn)return;
    const i=document.getElementById('messageInput'),text=i?.value?.trim()||'';
    if(window.__sheEditingId||i?.dataset?.editingId){e.preventDefault();e.stopImmediatePropagation();await editSend();return}
    if(window.__sheReplyTo){e.preventDefault();e.stopImmediatePropagation();if(text)await replySend(text);return}
  },true);
  document.addEventListener('keydown',async e=>{
    if(e.key!=='Enter'||e.shiftKey)return;
    const i=e.target.closest?.('#messageInput');if(!i)return;
    const text=i.value.trim();
    if(window.__sheEditingId||i.dataset.editingId){e.preventDefault();e.stopImmediatePropagation();await editSend();return}
    if(window.__sheReplyTo){e.preventDefault();e.stopImmediatePropagation();if(text)await replySend(text);return}
  },true);
}

function init(){
  const st=document.createElement('style');
  st.textContent='.message{position:relative}.message-reaction-badge{position:absolute;bottom:-9px;left:8px;background:#fff;border-radius:12px;padding:2px 6px;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.18);z-index:3}.message.sent .message-reaction-badge{left:auto;right:8px}.message-reply-preview{display:flex;flex-direction:column;gap:2px;margin-bottom:6px;padding:6px 8px;border-left:3px solid #078b59;background:rgba(7,139,89,.08);border-radius:6px;font-size:12px}.message-reply-preview span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}.message-edited-label{font-size:10px;opacity:.6;margin-right:4px}.she-deleted-text{font-style:italic;opacity:.6}.message.she-deleted{opacity:.75}';
  document.head.appendChild(st);
  window.addEventListener('sheReactToMessage',react);
  window.addEventListener('sheDeleteMessage',del);
  window.addEventListener('sheReplyToMessage',setReply);
  window.addEventListener('sheEditMessage',setEdit);
  interceptSending();
  const root=document.getElementById('messages');
  if(root){
    const mo=new MutationObserver(()=>{clearTimeout(decorateTimer);decorateTimer=setTimeout(decorate,120)});
    mo.observe(root,{childList:true,subtree:true});
    decorate();
  }
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();