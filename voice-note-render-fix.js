(() => {
  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
  }

  function fixAudio(audio) {
    if (!audio) return;
    const source = audio.querySelector("source");
    if (source) {
      const src = source.getAttribute("src");
      if (src && !audio.dataset.voiceSrcFixed) {
        // Set src directly so browsers such as iOS Safari are not forced to
        // trust a stale hard-coded MIME type from an older voice-note message.
        audio.dataset.voiceSrcFixed = "1";
        audio.src = src;
        audio.load();
      }
    }

    const id = audio.id || "";
    const messageId = id.replace(/^audio-/, "");
    const durationEl = messageId ? document.getElementById(`duration-${messageId}`) : null;
    if (!durationEl) return;

    const update = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        durationEl.textContent = formatDuration(audio.duration);
      }
    };

    audio.addEventListener("loadedmetadata", update, { once: true });
    audio.addEventListener("durationchange", update);
    update();
  }

  window.updateAudioDuration = function (messageId) {
    fixAudio(document.getElementById(`audio-${messageId}`));
  };

  function scan(root = document) {
    root.querySelectorAll?.("audio.audio-player").forEach(fixAudio);
  }

  document.addEventListener("DOMContentLoaded", () => {
    scan();
    const messages = document.getElementById("messages");
    if (!messages) return;
    new MutationObserver(() => scan(messages)).observe(messages, {
      childList: true,
      subtree: true
    });
  });
})();