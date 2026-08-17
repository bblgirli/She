/* Voice-note locked controls + app no-copy behavior. */
(() => {
  const ICONS = {
    cancel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14"/></svg>',
    continue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/></svg>'
  };

  function addStyles() {
    if (document.getElementById('voice-controls-style')) return;
    const s = document.createElement('style');
    s.id = 'voice-controls-style';
    s.textContent = `
      #voiceRecordingUI .vn-delete,
      #voiceRecordingUI .vn-play,
      #voiceRecordingUI .vn-pause,
      #voiceRecordingUI .vn-continue,
      #voiceRecordingUI .vn-send {
        width: 40px !important;
        height: 40px !important;
        min-width: 40px !important;
        padding: 8px !important;
        border: 0 !important;
        background: transparent !important;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 40px;
        cursor: pointer;
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      #voiceRecordingUI .vn-delete svg,
      #voiceRecordingUI .vn-play svg,
      #voiceRecordingUI .vn-pause svg,
      #voiceRecordingUI .vn-continue svg,
      #voiceRecordingUI .vn-send svg {
        width: 22px;
        height: 22px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
      }
      #voiceRecordingUI .vn-delete { color: #d33; }
      #voiceRecordingUI .vn-send { color: #fff; background: #078b59 !important; border-radius: 50%; }
      #voiceRecordingUI .vn-continue { color: #078b59; }
    `;
    document.head.appendChild(s);
  }

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

    const paused = pause.dataset.paused === 'true';
    pause.innerHTML = ICONS.pause;
    pause.setAttribute('aria-label', 'Pause recording');
    cont.innerHTML = ICONS.continue;
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
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'a'].includes(e.key.toLowerCase())) e.preventDefault();
    }, true);
  }

  function install() {
    addStyles();
    installNoCopy();
    if (document.getElementById('voiceRecordingUI')) installStateObserver();
    const bodyObserver = new MutationObserver(() => {
      const ui = document.getElementById('voiceRecordingUI');
      if (ui && !ui.dataset.voiceObserver) {
        ui.dataset.voiceObserver = '1';
        installStateObserver();
      }
      styleAndFixControls();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
