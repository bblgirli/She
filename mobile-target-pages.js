/* Mobile-first target marker; safe no-op except loading the shared stylesheet. */
(function(){
  if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
    var l=document.createElement('link'); l.rel='stylesheet'; l.href='./mobile-stability.css?v=1'; document.head.appendChild(l);
  }
})();
