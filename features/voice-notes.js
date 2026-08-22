/* She voice-note feature boundary. */

let mediaRecorder = null;
let audioChunks = [];
let stream = null;
let recordingStartedAt = 0;
let recordingTimer = null;
let locked = false;
let audioContext = null;
let analyser = null;
let animationFrame = null;

export const voiceNoteState = {
  get recording() { return !!mediaRecorder && mediaRecorder.state === "recording"; },
  get locked() { return locked; }
};

export function isVoiceNoteSupported() {
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

export async function beginVoiceNote({ onLevel, onTime } = {}) {
  if (voiceNoteState.recording || !isVoiceNoteSupported()) return false;

  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
  audioChunks = [];
  locked = false;
  recordingStartedAt = Date.now();

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  audioContext.createMediaStreamSource(stream).connect(analyser);

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";
  mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = event => {
    if (event.data.size) audioChunks.push(event.data);
  };

  mediaRecorder.start();
  recordingTimer = setInterval(() => {
    onTime?.(Date.now() - recordingStartedAt);
  }, 100);

  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    if (!voiceNoteState.recording) return;
    analyser.getByteFrequencyData(data);
    let total = 0;
    for (const value of data) total += value;
    onLevel?.(Math.min(100, (total / data.length / 255) * 120));
    animationFrame = requestAnimationFrame(tick);
  };
  tick();

  return true;
}

export function lockVoiceNote() {
  if (!voiceNoteState.recording) return false;
  locked = true;
  return true;
}

export function unlockVoiceNote() {
  locked = false;
}

export async function finishVoiceNote() {
  if (!mediaRecorder) return null;

  const recorder = mediaRecorder;
  const result = await new Promise(resolve => {
    recorder.addEventListener("stop", () => {
      resolve(new Blob(audioChunks, { type: recorder.mimeType || "audio/webm" }));
    }, { once: true });
    recorder.stop();
  });

  cleanupVoiceNote();
  return result;
}

export function cancelVoiceNote() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  cleanupVoiceNote();
}

function cleanupVoiceNote() {
  clearInterval(recordingTimer);
  recordingTimer = null;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  if (audioContext) audioContext.close().catch(() => {});
  audioContext = null;
  analyser = null;
  mediaRecorder = null;
  audioChunks = [];
  locked = false;
  recordingStartedAt = 0;
}
