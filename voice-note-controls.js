/* Voice-note locked controls + app no-copy behavior. */
(() => {
  const ICONS = {
    cancel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14"/></svg>',
    continue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/></svg>'
  };

  function styleAndFixControls() {
    const ui = document.getElementById('voiceRecordingUI');
    if (!ui || ui.style.display === 'none') return;

    const del = ui.querySelector('.vn-delete');
    const play = ui.querySelector('.vn-play');
    const pause = ui.querySelector('.vn-pause');
    const send = ui.querySelector('.vn-send');
    if (!del || !play || !pause || !send) return;

    del.innerHTML = ICONS.cancel;
    play.innerHTML = ICONS.play;
    pause.innerHTML = ICONS.pause;
    send.innerHTML = ICONS.send;

    let cont = ui.querySelector('.vn-continue');
    if (!cont) {
      cont = document.createElement('button');
      cont.className = 'vn-continue';
      cont.type = 'button';
      cont.setAttribute('aria-label', 'Continue recording');
      cont.innerHTML = ICONS.continue;
      cont.addEventListener('click', () => pause.click());
      pause.insertAdjacentElement('afterend', cont);
    }

    const state = window.__voiceRecorderState;
    // The recorder object is private, so infer state from the pause button and recording dot.
    const paused = pause.dataset.paused === 'true';
    cont.style.display = paused ? 'inline-flex' : 'none';
    pause.style.display = paused ? 'none' : 'inline-flex';
  }

  function installStateObserver() {
    const ui = document.getElementById('voiceRecordingUI');
    if (!ui) return;

    const observer = new MutationObserver(() => {
      const pause = ui.querySelector('.vn-pause');
      if (pause) {
        const text = pause.textContent.trim();
        pause.dataset.paused = text === '▶' ? 'true' : 'false';
      }
      styleAndFixControls();
    });
    observer.observe(ui, { childList: true, subtree: true, characterData: true, attributes: true });
    styleAndFixControls();
  }

  function installNoCopy() {
    const editable = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'].forEach((eventName) => {
      document.addEventListener(eventName, (e) => {
        if (!editable(e.target)) e.preventDefault();
      }, true);
    });

    document.addEventListener('keydown', (e) => {
      if (editable(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    }, true);
  }

  function install() {
    installNoCopy();
    const root = document.getElementById('voiceRecordingUI');
    if (root) installStateObserver();
    const bodyObserver = new MutationObserver(() => {
      if (document.getElementById('voiceRecordingUI')) styleAndFixControls();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
