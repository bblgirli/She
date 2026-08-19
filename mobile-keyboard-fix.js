/* Lightweight mobile viewport sync for the chat composer. */
(function () {
  'use strict';

  function sync() {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    root.style.setProperty('--mobile-vv-height', height + 'px');

    const footer = document.querySelector('.message-footer');
    if (footer) root.style.setProperty('--composer-height', footer.offsetHeight + 'px');

    document.body.classList.toggle('keyboard-open', !!vv && vv.height < window.innerHeight - 80);
  }

  function focusInput(input) {
    if (!input) return;
    requestAnimationFrame(sync);
    setTimeout(sync, 120);
    setTimeout(sync, 300);
  }

  sync();
  window.addEventListener('resize', sync, { passive: true });
  window.visualViewport?.addEventListener('resize', sync, { passive: true });

  document.addEventListener('focusin', function (e) {
    if (e.target && e.target.id === 'messageInput') focusInput(e.target);
  }, { passive: true });

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'messageInput') requestAnimationFrame(sync);
  }, { passive: true });
})();
