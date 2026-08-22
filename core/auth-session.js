/* She — centralized auth/session boundary.
 * This module is intentionally small: it owns the current Firebase user
 * snapshot and exposes race-safe account transitions for feature modules.
 */
(function () {
  'use strict';

  const listeners = new Set();
  let currentUser = null;
  let transitionId = 0;

  function emit(user) {
    listeners.forEach((fn) => {
      try { fn(user); } catch (err) { console.error('[She auth-session]', err); }
    });
  }

  function setUser(user) {
    currentUser = user || null;
    emit(currentUser);
    return currentUser;
  }

  window.SheAuthSession = {
    get currentUser() { return currentUser; },
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      fn(currentUser);
      return () => listeners.delete(fn);
    },
    beginTransition() { transitionId += 1; return transitionId; },
    isCurrentTransition(id) { return id === transitionId; },
    setUser,
    clear() { return setUser(null); }
  };

  // Attach once to the shared Firebase runtime when available.
  function attach() {
    const runtime = window.SheFirebase;
    if (!runtime || !runtime.auth || typeof runtime.auth.onAuthStateChanged !== 'function') return false;
    runtime.auth.onAuthStateChanged((user) => setUser(user));
    return true;
  }

  if (!attach()) {
    window.addEventListener('she:firebase-ready', attach, { once: true });
  }
})();
