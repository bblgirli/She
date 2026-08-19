/* Real Chats-screen renderer/polish. Runs after app.js and only transforms #chatList. */
(() => {
  'use strict';
  const VERSION='chats-screen-v2';
  let currentFilter='all';
  let searchTerm='';
  let observer=null;
  let refreshTimer=0;
  let firebaseCache=null;

  const getUidFromRow=row=>row?.dataset?.chatUid || row?.dataset?.uid || (row?.getAttribute('onclick')||'').match(/openChat\(['"]([^'"]+)['"]\)/)?.[1] || '';
  const getList=()=>document.getElementById('chatList');
  const getStoredUser=()=>{try{return JSON.parse(localStorage.getItem('she_current_user')||'null')}catch{return null}};

  function installStyle(){
    if(document.getElementById('sheChatsScreenV2Style')) return;
    const s=document.createElement('style'); s.id='sheChatsScreenV2Style';
    s.textContent=`
      #chatList{position:relative;width:100%;box-sizing:border-box;overflow-x:hidden}
      #chatList .she-date-separator{display:flex;justify-content:center;align-items:center;padding:10px 0 7px;font-size:11px;font-weight:700;letter-spacing:.04em;color:#6d7773;text-transform:uppercase}
      #chatList .chat-item{position:relative;display:flex!important;align-items:center!important;width:100%!important;box-sizing:border-box!important;padding:10px max(15px,env(safe-area-inset-right)) 10px max(15px,env(safe-area-inset-left))!important;gap:0!important}
      #chatList .chat-avatar{flex:0 0 52px!important;width:52px!important;height:52px!important;margin-right:13px!important}
      #chatList .chat-info{min-width:0!important;flex:1 1 auto!important;width:auto!important}
      #chatList .chat-top,#chatList .chat-bottom{display:flex!important;align-items:center!important;min-width:0!important;width:100%!important}
      #chatList .chat-top h3{min-width:0!important;flex:1 1 auto!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #chatList .she-right-meta{flex:0 0 66px;width:66px;min-width:66px;height:40px;margin-left:8px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:3px}
      #chatList .she-time{font-size:11px;line-height:15px;white-space:nowrap;color:#66706c}
      #chatList .she-unread{width:20px;height:20px;min-width:20px;padding:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#078b59;color:#fff;font-size:11px;font-weight:700;line-height:20px}
      #chatList .she-unread.is-hidden{visibility:hidden}
      #chatList .she-preview{min-width:0!important;flex:1 1 auto!important;display:flex!important;align-items:center!important;overflow:hidden!important}
      #chatList .she-preview-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #chatList .she-ticks{flex:0 0 auto;margin-right:5px;font-size:13px;line-height:18px;letter-spacing:-2px;color:#7a8580}
      #chatList .she-ticks.read{color:#168cff}
      #sheChatsSearchBar{display:none;position:fixed;left:12px;right:12px;top:calc(58px + env(safe-area-inset-top));z-index:100;padding:8px;background:rgba(255,255,255,.98);border-radius:12px;box-shadow:0 3px 16px rgba(0,0,0,.14)}
      #sheChatsSearchBar.open{display:flex;gap:7px}
      #sheChatsSearchInput{flex:1;min-width:0;border:0;outline:0;background:#f0f2f1;border-radius:10px;padding:10px 12px;font-size:15px}
      #sheChatsSearchClose{border:0;background:transparent;font-size:20px;padding:0 8px}
      @media(prefers-color-scheme:dark){#sheChatsSearchBar{background:#151a18}#sheChatsSearchInput{background:#222927;color:#fff}}
    `;
    document.head.appendChild(s);
  }

  async function getFirebase(){
    if(firebaseCache) return firebaseCache;
    try{
      const appMod=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const authMod=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      const fs=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const apps=appMod.getApps();
      if(!apps.length) return null;
      const app=appMod.getApp();
      firebaseCache={auth:authMod.getAuth(app),db:fs.getFirestore(app),...fs};
      return firebaseCache;
    }catch(e){console.warn('Chats V2 Firebase access unavailable',e);return null}
  }

  function toDate(value){
    if(!value)return null;
    if(value.toDate)return value.toDate();
    if(value.seconds)return new Date(value.seconds*1000);
    const d=new Date(value);return Number.isNaN(d.getTime())?null:d;
  }
  function dayKey(d){return d?new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime():0}
  function separatorLabel(d){
    if(!d)return '';
    const now=new Date(),diff=Math.round((dayKey(now)-dayKey(d))/86400000);
    if(diff===0)return 'Today';if(diff===1)return 'Yesterday';
    return d.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric',year:d.getFullYear()!==now.getFullYear()?'numeric':undefined});
  }

  async function decorateRow(row){
    if(!row||row.dataset.sheV2==='1')return;
    const uid=getUidFromRow(row);if(!uid)return;
    row.dataset.chatUid=uid;
    const timeEl=row.querySelector('.message-time');
    const badge=row.querySelector('.unread-badge');
    const info=row.querySelector('.chat-info');
    if(!info)return;

    let right=row.querySelector('.she-right-meta');
    if(!right){
      right=document.createElement('div');right.className='she-right-meta';
      const time=document.createElement('span');time.className='she-time';time.textContent=timeEl?.textContent||'';
      const unread=document.createElement('span');unread.className='she-unread';
      if(badge){unread.textContent=badge.textContent.trim();badge.remove()}else{unread.textContent='';unread.classList.add('is-hidden')}
      right.append(time,unread);row.appendChild(right);
    }
    if(timeEl)timeEl.remove();

    const bottom=row.querySelector('.chat-bottom');
    if(bottom){
      const p=bottom.querySelector('p');
      if(p&&!p.parentElement.classList.contains('she-preview')){
        const wrap=document.createElement('div');wrap.className='she-preview';
        p.parentNode.insertBefore(wrap,p);wrap.appendChild(p);p.classList.add('she-preview-text');
      }
    }
    row.dataset.sheV2='1';
  }

  function addDateSeparators(rows){
    document.querySelectorAll('#chatList .she-date-separator').forEach(e=>e.remove());
    let previous='';
    rows.forEach(row=>{
      const d=toDate(row.dataset.activityDate);
      const key=d?dayKey(d):'';
      if(!key||key===previous)return;
      previous=key;
      const sep=document.createElement('div');sep.className='she-date-separator';sep.textContent=separatorLabel(d);row.before(sep);
    });
  }

  async function hydrateStatuses(rows){
    const f=await getFirebase();if(!f||!f.auth.currentUser)return;
    const uid=f.auth.currentUser.uid;
    for(const row of rows){
      const other=getUidFromRow(row);if(!other)continue;
      try{
        const cid=[uid,other].sort().join('_');
        const q=f.query(f.collection(f.db,'conversations',cid,'messages'),f.orderBy('createdAt','desc'),f.limit(1));
        const snap=await f.getDocs(q);const last=snap.docs[0]?.data();
        if(!last)continue;
        const bottom=row.querySelector('.she-preview');if(!bottom)continue;
        let ticks=bottom.querySelector('.she-ticks');
        if(last.senderId===uid){
          if(!ticks){ticks=document.createElement('span');ticks.className='she-ticks';bottom.prepend(ticks)}
          const status=last.status||'sent';ticks.textContent=status==='sent'?'✓':'✓✓';ticks.classList.toggle('read',status==='read');
        }else if(ticks){ticks.remove()}
        const unread=row.querySelector('.she-unread');
        if(unread&&row.classList.contains('unread')){
          const uq=f.query(f.collection(f.db,'conversations',cid,'messages'),f.orderBy('createdAt','desc'),f.limit(50));
          const us=await f.getDocs(uq);let count=0;
          us.forEach(d=>{const m=d.data();if(m.senderId!==uid&&m.status!=='read')count++});
          unread.textContent=String(Math.max(1,count));unread.classList.remove('is-hidden');
        }
      }catch(e){/* Keep the existing chat row if a status query is unavailable. */}
    }
  }

  function applyFilters(){
    const term=searchTerm.toLowerCase();
    document.querySelectorAll('#chatList > .chat-item').forEach(row=>{
      const name=row.querySelector('h3')?.textContent?.toLowerCase()||'';
      const msg=row.querySelector('.she-preview-text')?.textContent?.toLowerCase()||'';
      const unread=row.classList.contains('unread');
      const match=!term||name.includes(term)||msg.includes(term);
      const filter=currentFilter==='all'||(currentFilter==='unread'&&unread)||currentFilter==='favorites';
      row.style.display=match&&filter?'':'none';
    });
  }

  function openSearch(){
    let bar=document.getElementById('sheChatsSearchBar');
    if(!bar){
      bar=document.createElement('div');bar.id='sheChatsSearchBar';
      bar.innerHTML='<input id="sheChatsSearchInput" type="search" placeholder="Search chats"><button id="sheChatsSearchClose" type="button">×</button>';
      document.body.appendChild(bar);
      bar.querySelector('input').addEventListener('input',e=>{searchTerm=e.target.value.trim();applyFilters()});
      bar.querySelector('button').addEventListener('click',()=>{searchTerm='';bar.classList.remove('open');bar.querySelector('input').value='';applyFilters()});
    }
    bar.classList.add('open');setTimeout(()=>bar.querySelector('input').focus(),0);
  }

  function bindTabs(){
    document.querySelectorAll('.chat-tabs button').forEach(btn=>{
      if(btn.dataset.sheBound)return;btn.dataset.sheBound='1';
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.chat-tabs button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
        currentFilter=(btn.textContent||'All').trim().toLowerCase();applyFilters();
      });
    });
    const searchBtn=document.querySelector('.header-actions button');
    if(searchBtn&&!searchBtn.dataset.sheSearchBound){searchBtn.dataset.sheSearchBound='1';searchBtn.addEventListener('click',e=>{e.preventDefault();openSearch()})}
  }

  async function decorateRows(){
    const list=getList();if(!list)return;
    const rows=[...list.querySelectorAll(':scope > .chat-item')];
    for(const row of rows){
      const uid=getUidFromRow(row);if(uid)row.dataset.chatUid=uid;
      const time=row.querySelector('.message-time');
      if(time&&!row.dataset.activityDate){
        const text=time.textContent.trim();
        const parsed=/^\d{1,2}:\d{2}/.test(text)?new Date():null;
        if(parsed)row.dataset.activityDate=parsed.toISOString();
      }
      await decorateRow(row);
    }
    addDateSeparators(rows);applyFilters();await hydrateStatuses(rows);
  }

  function boot(){
    if(location.pathname.split('/').pop()!=='chats.html')return;
    installStyle();bindTabs();
    const list=getList();if(!list)return;
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(decorateRows,40)});
    observer.observe(list,{childList:true,subtree:true});
    setTimeout(decorateRows,120);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
