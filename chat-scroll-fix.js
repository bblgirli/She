/* Keep chat at the newest message without forcing the page or keyboard to move. */
(() => {
  'use strict';
  const getBox = () => document.getElementById('messages');
  let userMovedUp = false;
  let started = false;

  function isAtBottom(el, tolerance = 24) {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance;
  }

  function goBottom() {
    const el = getBox();
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function markScrollState() {
    const el = getBox();
    if (!el) return;
    userMovedUp = !isAtBottom(el);
  }

  function start() {
    const el = getBox();
    if (!el || started) return;
    started = true;

    el.addEventListener('scroll', markScrollState, { passive: true });

    // Only establish the initial position once. Never use focus/viewport scrolling.
    requestAnimationFrame(() => requestAnimationFrame(goBottom));

    const observer = new MutationObserver(() => {
      // Capture the position BEFORE Firebase changes the DOM.
      const wasAtBottom = isAtBottom(el);
      if (wasAtBottom && !userMovedUp) {
        requestAnimationFrame(goBottom);
      }
    });
    observer.observe(el, { childList: true, subtree: true });

    // Explicit hook for sending a message.
    window.scrollChatToBottom = () => {
      userMovedUp = false;
      goBottom();
    };

    // Do NOT scroll the messages box on input focus. The browser keyboard
    // should resize the available viewport; it must not change the chat position.
    window.addEventListener('pageshow', () => {
      requestAnimationFrame(() => {
        if (!userMovedUp) goBottom();
      });
    });
  }

  function wait() {
    if (getBox()) start();
    else setTimeout(wait, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wait, { once: true });
  } else {
    wait();
  }
})();
