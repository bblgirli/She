/* She app navigation: fast, stateful, touch-friendly and history-aware. */
(function(){
  'use strict';
  const routes={chats:'chats.html',calls:'calls.html',status:'status.html',contacts:'contacts.html'};
  const current=location.pathname.split('/').pop()||'chats.html';
  const key='she_nav_last_route';
  function routeFor(url){return Object.keys(routes).find(k=>routes[k]===url)||null}
  function markActive(){
    const r=routeFor(current)||'chats';
    document.querySelectorAll('.bottom-nav .nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route===r));
  }
  function prefetch(url){
    if(!url||url===current||document.querySelector('link[rel="prefetch"][href="'+url+'"]'))return;
    const l=document.createElement('link');l.rel='prefetch';l.as='document';l.href=url;document.head.appendChild(l);
  }
  function go(url){
    if(!url||url===current)return;
    sessionStorage.setItem(key,url);
    document.documentElement.classList.add('nav-loading');
    if(document.startViewTransition){document.startViewTransition(()=>{location.assign(url)});}else location.assign(url);
  }
  window.SheNavigate=go;
  window.goTo=go;
  window.SheNav={routes,go,markActive};
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.bottom-nav .nav-item').forEach((b,i)=>{
      const r=b.dataset.route||Object.keys(routes)[i];
      b.dataset.route=r;b.setAttribute('aria-current',routeFor(current)===r?'page':'false');
      b.onclick=e=>{e.preventDefault();go(routes[r]);};
      prefetch(routes[r]);
    });
    markActive();
    // Warm the two most likely destinations without blocking first paint.
    setTimeout(()=>{prefetch('chats.html');prefetch('contacts.html')},1200);
  });
})();
