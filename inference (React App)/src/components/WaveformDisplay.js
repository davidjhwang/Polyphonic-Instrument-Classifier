import React, { useRef, useEffect } from "react";

const WaveformDisplay = ({
  samples,
  melChunks,
  cellWidth,
  labelOffset,
  borderWidth,
  chunkCount,
  cursorX,
  onSeek,
}) => {
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);

  const waveformHeight = 80;
  const melHeight = 64;
  const totalHeight = melHeight + waveformHeight;
  const width = labelOffset + chunkCount * cellWidth + borderWidth;

useEffect(() => {
  if (!canvasRef.current || samples.length === 0 || melChunks.length === 0) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = totalHeight;
  ctx.clearRect(0, 0, width, totalHeight);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, totalHeight);

  // // === WAVEFORM ===
  const peaksPerCell = 7;
  const peakSpacing = cellWidth / peaksPerCell;
  const totalPeaks = chunkCount * peaksPerCell;

  ctx.strokeStyle = "#1976d2";
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < totalPeaks; i++) {
    const [min, max] = samples[i] || [0, 0];
    const x = labelOffset + i * peakSpacing + peakSpacing / 2;
    const yMin = waveformHeight / 2 - min * waveformHeight / 2;
    const yMax = waveformHeight / 2 - max * waveformHeight / 2;

    ctx.moveTo(x, yMin);
    ctx.lineTo(x, yMax);
  }

  ctx.stroke();

// === MEL SPECTROGRAM ===
function fireColor(norm) {
  const clamped = Math.max(0, Math.min(1, norm));
  const adjusted = Math.pow(clamped, 0.4); // nonlinear

  let r = 0, g = 0, b = 0;

  if (adjusted < 0.05) {
    // Deep black → dark blue
    const t = adjusted / 0.05;
    r = 0;
    g = 0;
    b = Math.round(40 + 60 * t); // 40 → 100
  } else if (adjusted < 0.15) {
    // Dark blue → purple
    const t = (adjusted - 0.05) / 0.1;
    r = Math.round(80 * t);     // 0 → 80
    g = 0;
    b = 100 + Math.round(80 * t); // 100 → 180
  } else if (adjusted < 0.3) {
    // Purple → Magenta
    const t = (adjusted - 0.15) / 0.15;
    r = 80 + Math.round(100 * t); // 80 → 180
    g = 0;
    b = 180 - Math.round(60 * t); // 180 → 120
  } else if (adjusted < 0.6) {
    // Magenta → Red
    const t = (adjusted - 0.3) / 0.3;
    r = 180 + Math.round(60 * t); // 180 → 240
    g = 0;
    b = 120 - Math.round(120 * t); // 120 → 0
  } else if (adjusted < 0.85) {
    // Red → Orange → Yellow
    const t = (adjusted - 0.6) / 0.25;
    r = 240;
    g = Math.round(160 * t); // 0 → 160
    b = 0;
  } else {
    // Yellow → Soft white
    const t = (adjusted - 0.85) / 0.15;
    r = 230 + Math.round(10 * t);  // 230 → 240
    g = 160 + Math.round(95 * t);  // 160 → 255
    b = Math.round(235 * t);       // 0 → 235
  }

  return `rgb(${r}, ${g}, ${b})`;
}

const evenChunks = melChunks;
const nMels = evenChunks[0].length;
const framesPerChunk = evenChunks[0][0].length;
const frameWidth = cellWidth / framesPerChunk;
const melStep = 4;
let x = labelOffset;

const minDb = -100;
const maxDb = 50;

for (let chunk of evenChunks) {
  for (let frame = 0; frame < framesPerChunk; frame++) {
    for (let mel = 0; mel < nMels; mel += melStep) {
      const dB = Math.min(chunk[mel][frame], maxDb);
      const power = Math.pow(10, dB / 10);
      const norm = Math.max(0, Math.min(1, power / 1000)); 
      const curved = Math.pow(norm, 0.7); // curve

      ctx.fillStyle = fireColor(curved);

      const y = waveformHeight + melHeight - ((mel + melStep) * melHeight) / nMels;
      const bandHeight = (melStep * melHeight) / nMels;
      ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(frameWidth), Math.ceil(bandHeight));
    }
    x += frameWidth;
  }
}

  }, [samples, melChunks, cellWidth, labelOffset, borderWidth, chunkCount]);

  // === PLAYBACK CURSOR ===
  useEffect(() => {
    if (!cursorRef.current) return;

    const canvas = cursorRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = totalHeight;

    ctx.clearRect(0, 0, width, totalHeight);

    if (cursorX !== null && !isNaN(cursorX)) {
      const x = labelOffset + cursorX;
      ctx.beginPath();
      ctx.strokeStyle = "red";
      ctx.lineWidth = 1;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, waveformHeight);
      ctx.stroke();
    }
  }, [cursorX, labelOffset, width, totalHeight]);

  // Use Effect
  useEffect(() => {
    const canvas = cursorRef.current;
    if (!canvas || !onSeek) return;

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - labelOffset;

      if (x >= 0) {
        const totalWidth = chunkCount * cellWidth;
        const ratio = x / totalWidth;
        const clampedRatio = Math.min(Math.max(ratio, 0), 1);
        onSeek(clampedRatio);
      }
    };

    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [chunkCount, cellWidth, labelOffset, onSeek]);

  return (
    <div style={{ position: "relative", height: totalHeight }}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", left: 0, top: 0, zIndex: 0, pointerEvents: "none" }}
      />
      <canvas
        ref={cursorRef}
        style={{ position: "absolute", left: 0, top: 0, zIndex: 1, cursor: "pointer" }}
      />
    </div>
  );
};

export default WaveformDisplay; 