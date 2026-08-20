(()=>{
const input=()=>document.getElementById('messageInput');
window.getSheReplyTarget=()=>{const i=input();if(!i)return null;const id=i.dataset.replyTo||i.getAttribute('data-reply-to');return id?{id,text:i.dataset.replyText||i.getAttribute('data-reply-text')||''}:null};
window.addEventListener('sheReplyToMessage',e=>{const d=e.detail||{},i=input();if(!i||!d.id)return;i.dataset.replyTo=d.id;i.dataset.replyText=d.text||'';i.setAttribute('data-reply-to',d.id);i.setAttribute('data-reply-text',d.text||'')});
const load=()=>import('./reply-complete.js?v=2').catch(e=>console.warn('reply-complete load:',e));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();