/* Mobile chat viewport alignment: keep the app composer flush with the visible screen. */
(function () {
  'use strict';
  let raf = 0;
  function sync() {
    raf = 0;
    const vv = window.visualViewport;
    const root = document.documentElement;
    const h = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    const keyboardOpen = !!vv && vv.height < window.innerHeight - 80;
    root.style.setProperty('--mobile-vv-height', h + 'px');
    root.style.setProperty('--mobile-vv-top', top + 'px');
    const footer = document.querySelector('.message-footer');
    if (footer) root.style.setProperty('--composer-height', footer.offsetHeight + 'px');
    document.body.classList.toggle('keyboard-open', keyboardOpen);
    document.body.classList.toggle('mobile-keyboard-open', keyboardOpen);
    if (footer && keyboardOpen && vv) {
      const keyboardTop = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
      footer.style.bottom = keyboardTop + 'px';
    } else if (footer) {
      footer.style.bottom = '0px';
    }
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(sync);
  }
  sync();
  window.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('focusin', e => { if (e.target?.id === 'messageInput') schedule(); }, { passive: true });
  document.addEventListener('input', e => { if (e.target?.id === 'messageInput') schedule(); }, { passive: true });
})();
