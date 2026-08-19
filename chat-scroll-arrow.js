/* WhatsApp-style scroll-to-bottom button. It never controls normal chat scrolling. */
(() => {
  'use strict';
  let box, button, userAway = false;
  const getBox = () => document.getElementById('messages');
  const atBottom = () => !box || box.scrollHeight - box.scrollTop - box.clientHeight <= 28;
  function update(){ if(!button) return; button.classList.toggle('visible', !atBottom()); }
  function goBottom(){ if(!box) return; userAway=false; box.scrollTo({top:box.scrollHeight,behavior:'smooth'}); update(); }
  function start(){
    box=getBox(); if(!box || button) return;
    button=document.createElement('button');
    button.id='chatScrollBottomButton';
    button.type='button';
    button.setAttribute('aria-label','Scroll to latest message');
    button.innerHTML='<span aria-hidden="true">↓</span>';
    Object.assign(button.style,{position:'absolute',right:'14px',bottom:'88px',width:'42px',height:'42px',border:'0',borderRadius:'50%',background:'#fff',color:'#078b59',boxShadow:'0 2px 10px rgba(0,0,0,.18)',zIndex:'15',display:'none',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:'700',cursor:'pointer',touchAction:'manipulation'});
    const style=document.createElement('style'); style.textContent='#chatScrollBottomButton.visible{display:flex!important}#chatScrollBottomButton span{line-height:1}'; document.head.appendChild(style);
    box.parentElement?.appendChild(button);
    button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();goBottom();});
    box.addEventListener('scroll',()=>{userAway=!atBottom();update();},{passive:true});
    new MutationObserver(()=>{
      // Never change scrollTop here. Firebase/new messages must not yank the user around.
      update();
    }).observe(box,{childList:true,subtree:true});
    update();
  }
  const wait=()=>{if(getBox())start();else setTimeout(wait,50)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wait,{once:true});else wait();
})();
