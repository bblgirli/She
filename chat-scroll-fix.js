/* Single-owner mobile chat scroll controller. Never scrolls on DOM updates. */
(() => {
  'use strict';
  let box = null;
  let started = false;
  let userScrolledUp = false;
  let initialisedAtBottom = false;

  const getBox = () => document.getElementById('messages');
  const isBottom = (el, tolerance = 32) => el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance;

  function updateArrow() {
    window.updateChatScrollArrow?.();
  }

  function scrollLatest(behavior = 'auto') {
    if (!box) return;
    userScrolledUp = false;
    box.scrollTo({ top: box.scrollHeight, behavior });
    updateArrow();
  }

  function onScroll() {
    if (!box) return;
    userScrolledUp = !isBottom(box);
    updateArrow();
  }

  function start() {
    box = getBox();
    if (!box || started) return;
    started = true;

    box.addEventListener('scroll', onScroll, { passive: true });

    // One initial positioning only. No focus, Firebase, resize, or mutation auto-scroll.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!initialisedAtBottom) {
          scrollLatest('auto');
          initialisedAtBottom = true;
        }
      });
    });

    // Expose an explicit action for the send handler if it wants to follow a sent message.
    window.scrollChatToBottom = () => scrollLatest('auto');

    // Intentionally no MutationObserver, no pageshow scrolling, and no visualViewport scrolling.
    // Firebase message rendering must never change the user's scroll position.
  }

  function wait() {
    const el = getBox();
    if (el) start();
    else setTimeout(wait, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait, { once: true });
  else wait();
})();
