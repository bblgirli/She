/* Preserve the user's position while Firebase replaces message DOM. */
(() => {
  'use strict';
  let box = null;
  let started = false;
  let userScrolledUp = false;
  let wasAtBottom = true;
  let mutationFrame = 0;

  const getBox = () => document.getElementById('messages');
  const isBottom = (el, tolerance = 32) => el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance;
  const updateArrow = () => window.updateChatScrollArrow?.();

  function goBottom(behavior = 'auto') {
    if (!box) return;
    userScrolledUp = false;
    wasAtBottom = true;
    box.scrollTo({ top: box.scrollHeight, behavior });
    updateArrow();
  }

  function onScroll() {
    if (!box) return;
    wasAtBottom = isBottom(box);
    userScrolledUp = !wasAtBottom;
    updateArrow();
  }

  function start() {
    box = getBox();
    if (!box || started) return;
    started = true;

    box.addEventListener('scroll', onScroll, { passive: true });

    // Firebase/cache can render in several passes. Follow the newest message only
    // during initial loading, never after the user deliberately scrolls upward.
    const settle = () => {
      if (!box) return;
      if (!userScrolledUp && !wasAtBottom) wasAtBottom = isBottom(box);
      if (!userScrolledUp) goBottom('auto');
    };
    requestAnimationFrame(() => requestAnimationFrame(settle));

    const observer = new MutationObserver(() => {
      // wasAtBottom is the state BEFORE this DOM mutation. Do not calculate it
      // after Firebase has already changed scrollHeight.
      if (wasAtBottom && !userScrolledUp) {
        cancelAnimationFrame(mutationFrame);
        mutationFrame = requestAnimationFrame(() => {
          if (box && !userScrolledUp) goBottom('auto');
        });
      }
    });
    observer.observe(box, { childList: true, subtree: true });

    window.scrollChatToBottom = () => goBottom('smooth');
  }

  function wait() {
    const el = getBox();
    if (el) start();
    else setTimeout(wait, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait, { once: true });
  else wait();
})();
