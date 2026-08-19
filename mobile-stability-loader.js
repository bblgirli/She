/* Loads the mobile stability stylesheet without changing app logic. */
(function(){
  if (document.getElementById('m3-mobile-stability')) return;
  var link=document.createElement('link');
  link.id='m3-mobile-stability';
  link.rel='stylesheet';
  link.href='./mobile-stability.css?v=1';
  document.head.appendChild(link);
})();
