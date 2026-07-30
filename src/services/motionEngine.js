/**
 * Amana Motion Spike Detection Engine
 * Accelerometer magnitude analysis via DeviceMotionEvent (Android Chrome & mobile supported browsers).
 */

let isListening = false;
let lastMotionTriggerTime = 0;
const MOTION_THRESHOLD = 15.0; // 15 m/s² (~1.5g jolt)
const MOTION_COOLDOWN_MS = 8000;
let onMotionCallback = null;

let motionHistory = [];

export function isMotionSupported() {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

export function startMotionMonitoring({ onMotion }) {
  if (!isMotionSupported()) {
    console.warn('DeviceMotionEvent is not supported on this device/browser.');
    return false;
  }

  onMotionCallback = onMotion;
  isListening = true;

  window.addEventListener('devicemotion', handleDeviceMotion, true);
  return true;
}

function handleDeviceMotion(event) {
  if (!isListening) return;

  const accel = event.acceleration || event.accelerationIncludingGravity;
  if (!accel || accel.x === null) return;

  const magnitude = Math.sqrt(
    (accel.x || 0) ** 2 +
    (accel.y || 0) ** 2 +
    (accel.z || 0) ** 2
  );

  const now = Date.now();
  motionHistory.push({ time: now, mag: magnitude });
  if (motionHistory.length > 50) motionHistory.shift();

  const isSpike = magnitude > MOTION_THRESHOLD;

  if (isSpike && (now - lastMotionTriggerTime >= MOTION_COOLDOWN_MS)) {
    lastMotionTriggerTime = now;
    if (onMotionCallback) {
      onMotionCallback({
        trigger_type: 'motion',
        peak_accel: parseFloat(magnitude.toFixed(2)),
        pattern: 'irregular_jolt',
        timestamp: now
      });
    }
  }
}

export function getLatestMotionData() {
  if (motionHistory.length === 0) return { mag: 0, isSpike: false };
  const latest = motionHistory[motionHistory.length - 1];
  return {
    mag: parseFloat(latest.mag.toFixed(2)),
    isSpike: latest.mag > MOTION_THRESHOLD
  };
}

export function stopMotionMonitoring() {
  isListening = false;
  window.removeEventListener('devicemotion', handleDeviceMotion, true);
}
