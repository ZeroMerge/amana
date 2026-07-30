import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPinIcon } from '@heroicons/react/24/solid';

export function IncidentMap({ gpsTrail = [], height = '160px', interactive = false }) {
  const mapRef = useRef(null);
  const leafletInstance = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const defaultCenter = [8.9969, 7.3195];
    const center = (gpsTrail && gpsTrail.length > 0)
      ? [gpsTrail[0].lat, gpsTrail[0].lng]
      : defaultCenter;

    if (!leafletInstance.current) {
      const map = L.map(mapRef.current, {
        center,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
        dragging: interactive,
        touchZoom: interactive,
        scrollWheelZoom: false,
        doubleClickZoom: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      leafletInstance.current = map;
    } else {
      leafletInstance.current.setView(center, 14);
    }

    const map = leafletInstance.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    if (gpsTrail && gpsTrail.length > 0) {
      const latLngs = gpsTrail.map(p => [p.lat, p.lng]);

      if (latLngs.length > 1) {
        L.polyline(latLngs, {
          color: '#1f1f23',
          weight: 3,
          opacity: 0.7,
          dashArray: '5, 5'
        }).addTo(map);
      }

      L.circleMarker(latLngs[0], {
        radius: 7,
        fillColor: '#dc2626',
        color: '#f3f3f5',
        weight: 2,
        fillOpacity: 1
      }).addTo(map);

      if (latLngs.length > 1) {
        L.circleMarker(latLngs[latLngs.length - 1], {
          radius: 6,
          fillColor: '#16a34a',
          color: '#f3f3f5',
          weight: 2,
          fillOpacity: 1
        }).addTo(map);
      }

      if (latLngs.length > 1) {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [20, 20] });
      }
    } else {
      L.circleMarker(defaultCenter, {
        radius: 6,
        fillColor: '#1f1f23',
        color: '#52525b',
        weight: 2,
        fillOpacity: 1
      }).addTo(map);
    }
  }, [gpsTrail, interactive]);

  const firstPoint = (gpsTrail && gpsTrail.length > 0) ? gpsTrail[0] : null;

  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', border: 'none' }}>
      <div ref={mapRef} style={{ width: '100%', height }} />

      {firstPoint && (
        <div style={{ background: 'var(--bg-card)', padding: '0.6rem 0.85rem', fontSize: '0.75rem', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MapPinIcon style={{ width: '13px', height: '13px', color: '#52525b' }} /> {gpsTrail.length} waypoints recorded
          </span>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {firstPoint.lat.toFixed(4)}° N, {firstPoint.lng.toFixed(4)}° E
          </span>
        </div>
      )}
    </div>
  );
}
