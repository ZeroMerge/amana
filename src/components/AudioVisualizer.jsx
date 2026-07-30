import React, { useRef, useEffect } from 'react';

export function AudioVisualizer({ features, thresholdRms, isConditionMet }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#F0F2F5';
    ctx.fillRect(0, 0, width, height);

    if (!features) return;

    // Draw RMS level bar
    const rms = features.rms || 0;
    const rmsHeight = Math.min(height, rms * height * 2.5);

    ctx.fillStyle = isConditionMet ? '#E53E3E' : '#4A6FA5';
    ctx.fillRect(20, height - rmsHeight, 40, rmsHeight);

    // RMS text
    ctx.fillStyle = '#1A1A1A';
    ctx.font = '12px sans-serif';
    ctx.fillText(`RMS: ${rms.toFixed(2)}`, 20, 20);

    // Threshold Line
    const threshY = height - Math.min(height, thresholdRms * height * 2.5);
    ctx.strokeStyle = '#D69E2E';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(10, threshY);
    ctx.lineTo(width - 10, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#975A16';
    ctx.fillText(`Threshold: ${thresholdRms.toFixed(2)}`, 70, threshY - 4);

    // 2-4kHz band energy bar
    const bandEnergy = features.band_2k_4k_energy || 0;
    const bandHeight = Math.min(height, bandEnergy * height * 3);
    ctx.fillStyle = '#38A169';
    ctx.fillRect(width - 60, height - bandHeight, 40, bandHeight);

    ctx.fillStyle = '#1A1A1A';
    ctx.fillText(`2-4kHz: ${bandEnergy.toFixed(2)}`, width - 110, 20);
  }, [features, thresholdRms, isConditionMet]);

  return (
    <canvas
      ref={canvasRef}
      className="visualizer-canvas"
      width={400}
      height={120}
    />
  );
}
