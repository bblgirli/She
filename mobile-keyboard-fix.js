/* Mobile keyboard/composer fix for Android + iPhone Safari. */
(function () {
  'use strict';

  function syncViewport() {
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    const offsetTop = vv ? vv.offsetTop : 0;
    const root = document.documentElement;

    root.style.setProperty('--mobile-vv-height', `${height}px`);
    root.style.setProperty('--mobile-vv-offset-top', `${offsetTop}px`);

    document.body.classList.toggle('keyboard-open', !!vv && vv.height < window.innerHeight - 80);
  }

  syncViewport();
  window.addEventListener('resize', syncViewport, { passive: true });
  window.visualViewport?.addEventListener('resize', syncViewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncViewport, { passive: true });

  document.addEventListener('focusin', function (event) {
    if (event.target?.id !== 'messageInput') return;
    syncViewport();
    setTimeout(syncViewport, 50);
    setTimeout(syncViewport, 250);
    setTimeout(function () {
      event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      syncViewport();
    }, 350);
  }, { passive: true });

  document.addEventListener('focusout', function (event) {
    if (event.target?.id !== 'messageInput') return;
    setTimeout(syncViewport, 100);
    setTimeout(syncViewport, 350);
  }, { passive: true });
})();
