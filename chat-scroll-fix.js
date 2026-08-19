/* Keep chat at the real bottom without stealing the user's scroll position. */
(() => {
  'use strict';
  const getBox = () => document.getElementById('messages');
  let userScrolledUp = false;
  let initialSettled = false;
  let lastMutationAt = 0;

  function atBottom(el, tolerance = 80) {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance;
  }

  function scrollBottom(behavior = 'auto') {
    const el = getBox();
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  function settleInitial() {
    const el = getBox();
    if (!el || initialSettled) return;
    initialSettled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => scrollBottom('auto')));
  }

  function onScroll() {
    const el = getBox();
    if (!el) return;
    userScrolledUp = !atBottom(el);
  }

  function observe() {
    const el = getBox();
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });

    const observer = new MutationObserver(() => {
      const wasAtBottom = atBottom(el);
      lastMutationAt = Date.now();
      if (!initialSettled) {
        settleInitial();
        return;
      }
      // New messages keep the user at the bottom only when they were already there.
      // If they deliberately scrolled up, never drag them back down.
      if (wasAtBottom && !userScrolledUp) {
        requestAnimationFrame(() => scrollBottom('auto'));
      }
    });
    observer.observe(el, { childList: true, subtree: true });

    // Firebase/cache rendering can happen in several batches.
    [0, 80, 250, 600, 1200].forEach(ms => setTimeout(() => {
      if (!userScrolledUp) scrollBottom('auto');
    }, ms));

    window.addEventListener('pageshow', () => {
      userScrolledUp = false;
      initialSettled = false;
      settleInitial();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !userScrolledUp) {
        requestAnimationFrame(() => scrollBottom('auto'));
      }
    });

    // Expose an intentional bottom-scroll function for sendMessage/other modules.
    window.scrollChatToBottom = () => {
      userScrolledUp = false;
      scrollBottom('auto');
    };

    // Restore focus without visualViewport.scrollIntoView(), which can move the whole page.
    const input = document.getElementById('messageInput');
    input?.addEventListener('focus', () => {
      requestAnimationFrame(() => {
        const box = getBox();
        if (box && !userScrolledUp) scrollBottom('auto');
      });
    }, { passive: true });
  }

  function start() {
    if (getBox()) observe();
    else setTimeout(start, 50);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
