/**
 * Amana Audio Analysis & Recording Engine
 * Real Web Audio API feature extraction (RMS, 2-4kHz band energy, spectral centroid, ZCR)
 * Post-calibration adaptive trigger thresholding & MediaRecorder audio packaging.
 */

let audioContext = null;
let analyserNode = null;
let mediaStream = null;
let micSource = null;
let animFrameId = null;

let isMonitoring = false;
let isRecording = false;

// Calibration defaults & baseline
let calibrationData = {
  ambient_rms: 0.05,
  ambient_2k4k: 0.02,
  threshold_rms: 0.20,
  threshold_2k4k: 0.15,
  isCalibrated: false
};

// Sustained detection tracking
let sustainedStartTime = null;
let lastTriggerTimestamp = 0;
const MIN_SUSTAINED_MS = 500;
const COOLDOWN_MS = 8000;

// Callbacks
let onFrameCallback = null;
let onTriggerCallback = null;

export function getCalibrationData() {
  return { ...calibrationData };
}

export function getAnalyserNode() {
  return analyserNode;
}

/**
 * Re-encode any audio Blob to a 16kHz Mono PCM WAV Blob with complete RIFF headers.
 * Eliminates WebM container header chunking issues for reliable Gemini STT audio decoding.
 */
export async function blobTo16kHzWav(blob) {
  if (!blob) return null;

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);

    const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();
    tempCtx.close().catch(() => {});

    return encodeAudioBufferToWav(renderedBuffer);
  } catch (err) {
    console.warn('WAV re-encode fallback:', err);
    return blob;
  }
}

function encodeAudioBufferToWav(audioBuffer) {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = channelData.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // Write RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function setCalibrationData(data) {
  calibrationData = {
    ...calibrationData,
    ...data,
    threshold_rms: Math.max(0.20, data.ambient_rms + 0.35),
    threshold_2k4k: Math.max(0.15, data.ambient_2k4k * 4.0),
    isCalibrated: true
  };
}

/**
 * Initialize AudioContext & Microphone Stream
 */
export async function initAudioEngine() {
  if (audioContext && audioContext.state === 'running') return true;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioCtx();

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  });

  micSource = audioContext.createMediaStreamSource(mediaStream);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048;
  analyserNode.smoothingTimeConstant = 0.8;

  micSource.connect(analyserNode);

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  return true;
}

/**
 * Extract audio features from the current AnalyserNode frame
 */
export function extractFrameFeatures() {
  if (!analyserNode || !audioContext) return null;

  const bufferLength = analyserNode.frequencyBinCount; // 1024
  const freqData = new Uint8Array(bufferLength);
  const timeData = new Uint8Array(analyserNode.fftSize);

  analyserNode.getByteFrequencyData(freqData);
  analyserNode.getByteTimeDomainData(timeData);

  const sampleRate = audioContext.sampleRate || 48000;
  const binResolution = sampleRate / analyserNode.fftSize; // ~23.4Hz per bin

  // 1. RMS (Root Mean Square) calculation
  let sumSquare = 0;
  let zeroCrossings = 0;
  for (let i = 0; i < timeData.length; i++) {
    const normalized = (timeData[i] - 128) / 128;
    sumSquare += normalized * normalized;

    if (i > 0) {
      const prevNorm = (timeData[i - 1] - 128) / 128;
      if ((normalized >= 0 && prevNorm < 0) || (normalized < 0 && prevNorm >= 0)) {
        zeroCrossings++;
      }
    }
  }
  const rms = Math.sqrt(sumSquare / timeData.length);
  const zeroCrossingRate = zeroCrossings / timeData.length;

  // 2. Dominant Frequency & Spectral Centroid & 2-4kHz Band Energy
  const bin2k = Math.floor(2000 / binResolution); // ~85
  const bin4k = Math.floor(4000 / binResolution); // ~171

  let maxMag = -1;
  let maxBinIndex = 0;
  let weightedFreqSum = 0;
  let totalMagSum = 0;
  let band2k4kSum = 0;
  let band2k4kCount = 0;

  for (let i = 0; i < bufferLength; i++) {
    const mag = freqData[i] / 255; // 0.0 to 1.0

    if (mag > maxMag) {
      maxMag = mag;
      maxBinIndex = i;
    }

    const freqHz = i * binResolution;
    weightedFreqSum += freqHz * mag;
    totalMagSum += mag;

    if (i >= bin2k && i <= bin4k) {
      band2k4kSum += mag;
      band2k4kCount++;
    }
  }

  const dominantFreqHz = Math.round(maxBinIndex * binResolution);
  const spectralCentroid = totalMagSum > 0 ? Math.round(weightedFreqSum / totalMagSum) : 0;
  const band2k4kEnergy = band2k4kCount > 0 ? band2k4kSum / band2k4kCount : 0;

  return {
    rms,
    dominant_frequency_hz: dominantFreqHz,
    spectral_centroid: spectralCentroid,
    zero_crossing_rate: parseFloat(zeroCrossingRate.toFixed(4)),
    band_2k_4k_energy: band2k4kEnergy,
    timestamp: Date.now()
  };
}

/**
 * Perform 15-second Ambient Calibration
 */
export async function calibrateAmbient(onProgress) {
  await initAudioEngine();

  const startTime = Date.now();
  const DURATION_MS = 15000;
  const rmsSamples = [];
  const band2k4kSamples = [];

  return new Promise((resolve) => {
    function sampleFrame() {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / DURATION_MS);

      const features = extractFrameFeatures();
      if (features) {
        rmsSamples.push(features.rms);
        band2k4kSamples.push(features.band_2k_4k_energy);
      }

      if (onProgress) {
        onProgress({ progress, elapsed, features });
      }

      if (elapsed < DURATION_MS) {
        requestAnimationFrame(sampleFrame);
      } else {
        const ambient_rms = rmsSamples.reduce((a, b) => a + b, 0) / (rmsSamples.length || 1);
        const ambient_2k4k = band2k4kSamples.reduce((a, b) => a + b, 0) / (band2k4kSamples.length || 1);

        const newCal = {
          ambient_rms: parseFloat(ambient_rms.toFixed(4)),
          ambient_2k4k: parseFloat(ambient_2k4k.toFixed(4)),
          threshold_rms: parseFloat(Math.max(0.20, ambient_rms + 0.35).toFixed(4)),
          threshold_2k4k: parseFloat(Math.max(0.15, ambient_2k4k * 4.0).toFixed(4)),
          isCalibrated: true
        };

        setCalibrationData(newCal);
        resolve(newCal);
      }
    }

    sampleFrame();
  });
}

/**
 * Start Live Monitoring Loop
 */
export function startAudioMonitoring({ onFrame, onTrigger }) {
  if (!analyserNode) return;
  isMonitoring = true;
  onFrameCallback = onFrame;
  onTriggerCallback = onTrigger;

  function loop() {
    if (!isMonitoring) return;

    const features = extractFrameFeatures();
    if (features) {
      const now = Date.now();
      const isRmsExceeded = features.rms > calibrationData.threshold_rms;
      const isBandExceeded = features.band_2k_4k_energy > calibrationData.threshold_2k4k;
      const isConditionMet = isRmsExceeded && isBandExceeded;

      if (isConditionMet) {
        if (!sustainedStartTime) {
          sustainedStartTime = now;
        }
        const sustainedMs = now - sustainedStartTime;

        if (sustainedMs >= MIN_SUSTAINED_MS && (now - lastTriggerTimestamp >= COOLDOWN_MS)) {
          lastTriggerTimestamp = now;
          sustainedStartTime = null;

          // Trigger detected!
          if (onTriggerCallback) {
            onTriggerCallback({
              trigger_type: 'audio',
              sustained_duration_ms: sustainedMs,
              features
            });
          }
        }
      } else {
        sustainedStartTime = null;
      }

      if (onFrameCallback) {
        onFrameCallback({
          features,
          isConditionMet,
          threshold_rms: calibrationData.threshold_rms,
          threshold_2k4k: calibrationData.threshold_2k4k
        });
      }
    }

    animFrameId = requestAnimationFrame(loop);
  }

  loop();
}

/**
 * Stop Audio Monitoring Loop
 */
export function stopAudioMonitoring() {
  isMonitoring = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

let activeRecorder = null;

export function cancelActiveCapture() {
  if (activeRecorder && activeRecorder.state === 'recording') {
    try { activeRecorder.stop(); } catch (e) {}
  }
}

/**
 * Capture 10-Second Audio Clip via MediaRecorder & Compute SHA-256 Hash
 */
export async function captureAudioClip(durationMs = 10000) {
  if (!mediaStream) {
    await initAudioEngine().catch(err => console.warn('Mic auto-init warning:', err));
  }
  if (!mediaStream) {
    console.warn('Microphone stream unavailable, returning fallback audio clip.');
    const dummyBlob = new Blob(['SILENT_AUDIO_FALLBACK'], { type: 'audio/webm' });
    return {
      audio_blob: dummyBlob,
      local_hash: 'fallback_hash_' + Date.now(),
      mime_type: 'audio/webm'
    };
  }

  // Determine supported mime type
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg'
  ];

  let selectedMimeType = '';
  for (const type of mimeTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      selectedMimeType = type;
      break;
    }
  }

  // 1. Dual Audio Stream Separation: Clone media stream for MediaRecorder to prevent AudioContext locking on mobile
  const recordStream = mediaStream.clone();

  return new Promise((resolve, reject) => {
    try {
      const recorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const recorder = new MediaRecorder(recordStream, recorderOptions);
      activeRecorder = recorder;
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        activeRecorder = null;
        // Clean up cloned stream tracks
        recordStream.getTracks().forEach(t => t.stop());

        const audioBlob = new Blob(chunks, { type: selectedMimeType || 'audio/webm' });
        
        // Compute SHA-256 Hash using Web Crypto API
        const arrayBuffer = await audioBlob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        resolve({
          audio_blob: audioBlob,
          local_hash: hashHex,
          mime_type: selectedMimeType || 'audio/webm'
        });
      };

      recorder.onerror = () => {
        activeRecorder = null;
        recordStream.getTracks().forEach(t => t.stop());
      };

      recorder.start();

      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, durationMs);
    } catch (err) {
      activeRecorder = null;
      recordStream.getTracks().forEach(t => t.stop());
      reject(err);
    }
  });
}

let liveSpeechRecognizer = null;
let currentLiveTranscript = '';
let isSpeechActive = false;

export function startLiveSpeechRecognition() {
  if (typeof window === 'undefined') return;
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return;

  if (isSpeechActive && liveSpeechRecognizer) return;

  try {
    liveSpeechRecognizer = new SpeechRec();
    liveSpeechRecognizer.continuous = true;
    liveSpeechRecognizer.interimResults = true;
    liveSpeechRecognizer.lang = 'en-NG';
    isSpeechActive = true;

    liveSpeechRecognizer.onresult = (e) => {
      let accumulatedStr = '';
      for (let i = 0; i < e.results.length; i++) {
        const text = e.results[i][0]?.transcript || '';
        if (text) accumulatedStr += ' ' + text;
      }
      if (accumulatedStr.trim()) {
        currentLiveTranscript = (currentLiveTranscript + ' ' + accumulatedStr.trim()).trim();
      }
    };

    liveSpeechRecognizer.onerror = (err) => {
      if (err?.error !== 'no-speech') {
        console.warn('SpeechRecognition error:', err?.error);
      }
    };

    liveSpeechRecognizer.onend = () => {
      isSpeechActive = false;
      if (isMonitoring) {
        setTimeout(() => {
          try {
            if (liveSpeechRecognizer) {
              liveSpeechRecognizer.start();
              isSpeechActive = true;
            }
          } catch (e) {}
        }, 200);
      }
    };

    liveSpeechRecognizer.start();
  } catch (e) {
    isSpeechActive = false;
    console.warn('SpeechRecognition init error:', e);
  }
}

export function getLiveSpeechTranscript() {
  const text = currentLiveTranscript;
  currentLiveTranscript = '';
  return text;
}

/**
 * Clean up AudioContext & MediaStream
 */
export function cleanupAudioEngine() {
  stopAudioMonitoring();

  if (liveSpeechRecognizer) {
    try { liveSpeechRecognizer.stop(); } catch (e) {}
    liveSpeechRecognizer = null;
  }

  if (micSource) {
    micSource.disconnect();
    micSource = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}
