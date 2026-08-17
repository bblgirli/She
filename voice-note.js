/* WhatsApp-style voice note controller: hold to record, release to send, swipe up to lock. */
(() => {
  let recorder = null;
  let chunks = [];
  let stream = null;
  let timer = null;
  let raf = null;
  let audioContext = null;
  let analyser = null;
  let audio = null;
  let audioUrl = null;
  let audioBlob = null;
  let locked = false;
  let pressing = false;
  let lockRequested = false;
  let pendingSend = false;
  let recordingStartedAt = 0;
  let recordedMs = 0;
  let mimeType = "";

  const $ = (s) => document.querySelector(s);
  const byId = (id) => document.getElementById(id);
  const footer = () => $(".message-footer");
  const standard = () => $(".message-input-container");
  const mic = () => byId("micButton");
  const ui = () => byId("voiceRecordingUI");

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
  }

  function setTime() {
    const el = byId("recordingTime");
    if (!el) return;
    let total = recordedMs;
    if (recorder?.state === "recording" && recordingStartedAt) {
      total += Date.now() - recordingStartedAt;
    }
    el.textContent = formatTime(total);
  }

  function startTimer() {
    clearInterval(timer);
    setTime();
    timer = setInterval(setTime, 100);
  }

  function stopTimer() {
    clearInterval(timer);
    timer = null;
    setTime();
  }

  function setup() {
    const x = ui();
    if (!x) return;

    x.innerHTML = `
      <button class="vn-delete" type="button" aria-label="Delete">✕</button>
      <button class="vn-play" type="button" aria-label="Play preview">▶</button>
      <div class="vn-main">
        <div><span class="vn-dot"></span><span id="recordingTime">0:00</span></div>
        <div class="vn-wave">${Array(28).fill("<i></i>").join("")}</div>
      </div>
      <button class="vn-pause" type="button" aria-label="Pause recording">Ⅱ</button>
      <button class="vn-send" type="button" aria-label="Send voice message">➤</button>
    `;

    x.querySelector(".vn-delete").onclick = discard;
    x.querySelector(".vn-play").onclick = togglePreview;
    x.querySelector(".vn-pause").onclick = togglePause;
    x.querySelector(".vn-send").onclick = send;
  }

  function showRecordingUI() {
    setup();
    if (ui()) ui().style.display = "flex";
  }

  function showLocked() {
    locked = true;
    showRecordingUI();
    footer()?.classList.add("voice-locked");
    if (standard()) standard().style.display = "none";
    if (mic()) mic().style.display = "none";
    if (ui()) ui().style.display = "flex";
  }

  function hideRecordingUI() {
    footer()?.classList.remove("voice-locked");
    if (standard()) standard().style.display = "";
    if (mic()) {
      mic().style.display = "";
      mic().classList.remove("recording");
    }
    if (ui()) ui().style.display = "none";
  }

  function wave() {
    if (!analyser || !recorder || recorder.state !== "recording") return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const average = data.length ? data.reduce((a, b) => a + b, 0) / data.length : 0;
    const n = Math.max(1, Math.round((average / 255) * 28));
    $(".vn-wave")?.querySelectorAll("i").forEach((bar, i) => {
      bar.classList.toggle("active", i < n);
    });
    raf = requestAnimationFrame(wave);
  }

  function stopWave() {
    cancelAnimationFrame(raf);
    raf = null;
  }

  function makePreviewBlob() {
    if (!chunks.length) return null;
    return new Blob(chunks, { type: mimeType || recorder?.mimeType || "audio/webm" });
  }

  function preparePreview() {
    const previewBlob = makePreviewBlob();
    if (!previewBlob || !previewBlob.size) return false;

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(previewBlob);
    audio = new Audio(audioUrl);
    audio.preload = "metadata";
    audio.onplay = () => {
      const p = $(".vn-play");
      if (p) p.textContent = "Ⅱ";
    };
    audio.onpause = () => {
      const p = $(".vn-play");
      if (p) p.textContent = "▶";
    };
    audio.onended = () => {
      const p = $(".vn-play");
      if (p) p.textContent = "▶";
    };
    return true;
  }

  async function togglePreview() {
    if (!audio) preparePreview();
    if (!audio) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (e) {
      console.warn("Voice preview failed:", e);
    }
  }

  async function begin() {
    if (recorder && recorder.state !== "inactive") return;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // The user may have released the button while the permission prompt was open.
      if (!pressing && !lockRequested) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
        return;
      }

      const preferred = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4"
      ];
      mimeType = preferred.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mimeType = recorder.mimeType || mimeType || "audio/webm";
      chunks = [];
      audioBlob = null;
      recordedMs = 0;
      recordingStartedAt = Date.now();
      pendingSend = false;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };

      recorder.onpause = () => {
        if (recordingStartedAt) {
          recordedMs += Date.now() - recordingStartedAt;
          recordingStartedAt = 0;
        }
        stopWave();
        preparePreview();
        setTime();
      };

      recorder.onresume = () => {
        recordingStartedAt = Date.now();
        if (audio) audio.pause();
        wave();
      };

      recorder.onstop = async () => {
        if (recordingStartedAt) {
          recordedMs += Date.now() - recordingStartedAt;
          recordingStartedAt = 0;
        }
        stopTimer();
        stopWave();
        audioBlob = new Blob(chunks, { type: mimeType || recorder?.mimeType || "audio/webm" });
        preparePreview();

        stream?.getTracks().forEach((t) => t.stop());
        stream = null;
        audioContext?.close();
        audioContext = null;
        analyser = null;

        const shouldSend = pendingSend;
        pendingSend = false;
        if (shouldSend && audioBlob.size) {
          await uploadVoiceMessage();
        }
      };

      recorder.start(100);
      startTimer();
      showRecordingUI();
      if (mic()) mic().classList.add("recording");

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      wave();

      if (lockRequested) {
        lockRequested = false;
        showLocked();
      }

      // If the user released while getUserMedia was resolving, finish now.
      if (!pressing && !locked) release();
    } catch (e) {
      console.error("Voice recording failed:", e);
      lockRequested = false;
      pressing = false;
      window.showError?.("Microphone access denied");
    }
  }

  function release() {
    if (!recorder || recorder.state === "inactive") return;
    locked = false;
    pendingSend = true;
    if (recorder.state === "recording" && recordingStartedAt) {
      recordedMs += Date.now() - recordingStartedAt;
      recordingStartedAt = 0;
    }
    recorder.stop();
    if (mic()) mic().classList.remove("recording");
  }

  function lock() {
    if (!recorder || recorder.state === "inactive") {
      lockRequested = true;
      return;
    }
    showLocked();
    if (mic()) mic().classList.remove("recording");
  }

  function togglePause() {
    if (!recorder || recorder.state === "inactive") return;

    if (recorder.state === "recording") {
      recorder.pause();
      const btn = $(".vn-pause");
      if (btn) btn.textContent = "▶";
      if ($(".vn-dot")) $(".vn-dot").style.background = "#999";
    } else if (recorder.state === "paused") {
      recorder.resume();
      const btn = $(".vn-pause");
      if (btn) btn.textContent = "Ⅱ";
      if ($(".vn-dot")) $(".vn-dot").style.background = "#e33";
    }
  }

  function send() {
    if (!recorder || recorder.state === "inactive") {
      if (audioBlob?.size) uploadVoiceMessage();
      return;
    }
    pendingSend = true;
    if (recorder.state === "recording" && recordingStartedAt) {
      recordedMs += Date.now() - recordingStartedAt;
      recordingStartedAt = 0;
    }
    recorder.stop();
  }

  async function uploadVoiceMessage() {
    const blob = audioBlob;
    if (!blob || !blob.size) {
      window.showError?.("Voice message is empty");
      resetAfterSend();
      return;
    }

    const durationMs = Math.max(1, Math.round(recordedMs));
    const currentMime = blob.type || mimeType || "audio/webm";

    try {
      const { firebaseConfig } = await import("./firebase-config.js");
      const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      const { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);
      const other = localStorage.getItem("currentChatUid");
      if (!auth.currentUser || !other) throw new Error("Chat session unavailable");

      const conversationId = [auth.currentUser.uid, other].sort().join("_");
      const reader = new FileReader();

      await new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const data = reader.result;
            await addDoc(collection(db, "conversations", conversationId, "messages"), {
              senderId: auth.currentUser.uid,
              receiverId: other,
              audioData: data,
              audioMimeType: currentMime,
              durationMs,
              text: "[Voice message]",
              status: "sent",
              createdAt: serverTimestamp()
            });

            await setDoc(doc(db, "conversations", conversationId), {
              participants: [auth.currentUser.uid, other],
              lastMessage: "[Voice message]",
              lastMessageSenderId: auth.currentUser.uid,
              lastMessageTime: serverTimestamp(),
              updatedAt: serverTimestamp(),
              unreadBy: [other]
            }, { merge: true });
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(reader.error || new Error("Could not read voice recording"));
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Voice send failed:", e);
      window.showError?.("Failed to send voice message");
    } finally {
      resetAfterSend();
    }
  }

  function resetAfterSend() {
    locked = false;
    pressing = false;
    lockRequested = false;
    pendingSend = false;
    stopTimer();
    stopWave();
    if (audio) audio.pause();
    audio = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
    audioBlob = null;
    chunks = [];
    recordedMs = 0;
    hideRecordingUI();
  }

  function discard() {
    pendingSend = false;
    pressing = false;
    lockRequested = false;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try { recorder.stop(); } catch (_) {}
    }
    recorder = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    stopTimer();
    stopWave();
    audioContext?.close();
    audioContext = null;
    analyser = null;
    if (audio) audio.pause();
    audio = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
    audioBlob = null;
    chunks = [];
    recordedMs = 0;
    locked = false;
    hideRecordingUI();
  }

  function handlePointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    pressing = true;
    lockRequested = false;
    try { mic()?.setPointerCapture?.(e.pointerId); } catch (_) {}
    begin();
  }

  function handlePointerMove(e) {
    if (!pressing || locked) return;
    if (e.clientY && window.__voiceStartY !== undefined && window.__voiceStartY - e.clientY > 55) {
      pressing = false;
      lock();
    }
  }

  function handlePointerUp(e) {
    e.preventDefault();
    if (locked) return;
    if (!pressing) return;
    pressing = false;
    release();
    try { mic()?.releasePointerCapture?.(e.pointerId); } catch (_) {}
  }

  function handlePointerCancel() {
    if (locked) return;
    pressing = false;
    discard();
  }

  const b = mic();
  if (b) {
    b.style.touchAction = "none";
    b.onpointerdown = (e) => {
      window.__voiceStartY = e.clientY;
      handlePointerDown(e);
    };
    b.onpointermove = handlePointerMove;
    b.onpointerup = handlePointerUp;
    b.onpointercancel = handlePointerCancel;
    b.oncontextmenu = (e) => e.preventDefault();
  }
})();