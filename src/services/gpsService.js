/**
 * Amana GPS Service
 * Handles continuous geolocation tracking during an active incident,
 * trail point collection, and reverse geocoding.
 */

let watchId = null;
let currentPosition = null;
let gpsTrail = [];
let onGpsUpdateCallback = null;

export function isGpsSupported() {
  return typeof window !== 'undefined' && 'geolocation' in navigator;
}

export function getCurrentGpsFix() {
  return new Promise((resolve) => {
    if (!isGpsSupported()) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fix = {
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6)),
          accuracy_m: Math.round(pos.coords.accuracy),
          speed_mps: pos.coords.speed ? parseFloat(pos.coords.speed.toFixed(1)) : 0.0,
          timestamp: new Date(pos.timestamp).toISOString()
        };
        currentPosition = fix;
        resolve(fix);
      },
      (err) => {
        console.warn('GPS single fix error:', err.message);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    );
  });
}

export function startGpsTracking(onUpdate) {
  if (!isGpsSupported()) return false;

  onGpsUpdateCallback = onUpdate;
  gpsTrail = [];

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const fix = {
        lat: parseFloat(pos.coords.latitude.toFixed(6)),
        lng: parseFloat(pos.coords.longitude.toFixed(6)),
        accuracy_m: Math.round(pos.coords.accuracy),
        speed_mps: pos.coords.speed ? parseFloat(pos.coords.speed.toFixed(1)) : 0.0,
        timestamp: new Date(pos.timestamp).toISOString()
      };

      currentPosition = fix;
      gpsTrail.push(fix);

      if (onGpsUpdateCallback) {
        onGpsUpdateCallback(fix, [...gpsTrail]);
      }
    },
    (err) => {
      console.warn('GPS Watcher error:', err.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    }
  );

  return true;
}

export function stopGpsTracking() {
  if (watchId !== null && isGpsSupported()) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

export function getLatestGpsFix() {
  return currentPosition;
}

export function getCollectedGpsTrail() {
  return [...gpsTrail];
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error('Geocode fetch failed');
    const data = await res.json();
    return data.place_name || `${lat}, ${lng}`;
  } catch (err) {
    console.warn('Reverse geocode fallback:', err);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
