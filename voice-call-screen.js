(()=>{
 const icons={mute:'<svg viewBox="0 0 24 24"><path d="M12 3a4 4 0 0 0-4 4v5a4 4 0 0 0 7.2 2.4M17 10v2a5 5 0 0 1-9.9 1M12 19v3M9 22h6M4 4l16 16"/></svg>',speaker:'<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6l-5 4H4zM17 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12"/></svg>',end:'<svg viewBox="0 0 24 24"><path d="M5 13c3-3 11-3 14 0l-1 4-4-1-1-3H11l-1 3-4 1-1-4z"/></svg>',accept:'<svg viewBox="0 0 24 24"><path d="M6.5 4 9 3l2 5-2 1.7a14 14 0 0 0 5.3 5.3L16 13l5 2 .5 2.5c.2 1-.5 2-1.5 2.2A16.5 16.5 0 0 1 4.3 5.5C4.5 4.7 5.2 4.2 6.5 4z"/></svg>'};
 function openVoiceCallScreen({name='Contact',avatar='',status='Calling…',incoming=false}={}){
  window.__sheCallActive=true;window.__sheCallName=name;window.__sheCallStatus=status;
  let s=document.getElementById('voiceCallScreen');
  if(!s){s=document.createElement('div');s.id='voiceCallScreen';s.innerHTML=`<div class="she-call-top"><span class="she-call-type">Voice call</span><button class="she-call-min" type="button" aria-label="Minimize">⌄</button></div><div class="she-call-person"><div class="she-call-avatar"></div><h2 class="she-call-name"></h2><div class="she-call-status"></div><div class="she-call-timer">00:00</div></div><div class="she-call-controls"></div>`;document.body.appendChild(s);s.querySelector('.she-call-min').onclick=()=>{s.classList.remove('is-open');window.sheShowMiniCall?.()};}
  s.dataset.incoming=incoming?'1':'0';s.querySelector('.she-call-name').textContent=name;s.querySelector('.she-call-status').textContent=status;
  const av=s.querySelector('.she-call-avatar');av.innerHTML=avatar?`<img src="${String(avatar).replace(/"/g,'&quot;')}" alt="">`:'<span>👤</span>';
  const controls=s.querySelector('.she-call-controls');
  if(incoming&&status==='Incoming call') controls.innerHTML=`<button class="she-call-control she-call-accept" data-action="accept">${icons.accept}<small>Accept</small></button><button class="she-call-control she-call-end" data-action="decline">${icons.end}<small>Decline</small></button><button class="she-call-control" disabled style="visibility:hidden"></button>`;
  else controls.innerHTML=`<button class="she-call-control" data-action="mute">${icons.mute}<small>Mute</small></button><button class="she-call-control" data-action="speaker">${icons.speaker}<small>Speaker</small></button><button class="she-call-control she-call-end" data-action="end">${icons.end}<small>End</small></button>`;
  controls.querySelector('[data-action="mute"]')?.addEventListener('click',e=>{e.currentTarget.classList.toggle('active');window.dispatchEvent(new CustomEvent('she:toggle-mute',{detail:{muted:e.currentTarget.classList.contains('active')}}))});
  controls.querySelector('[data-action="speaker"]')?.addEventListener('click',e=>{e.currentTarget.classList.toggle('active');window.dispatchEvent(new CustomEvent('she:toggle-speaker',{detail:{speaker:e.currentTarget.classList.contains('active')}}))});
  controls.querySelector('[data-action="end"]')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('she:end-voice-call')));
  controls.querySelector('[data-action="decline"]')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('she:decline-voice-call')));
  controls.querySelector('[data-action="accept"]')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('she:accept-voice-call')));
  s.classList.add('is-open');window.dispatchEvent(new CustomEvent('she:call-status',{detail:{name,status}}));
 }
 window.openVoiceCallScreen=openVoiceCallScreen;
})();