import React, { useRef, useEffect } from "react";

const WaveformViewer = ({
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

  // === WAVEFORM ===
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
    const curved = Math.pow(clamped, 2.5); // nonlinear ramp

    let r = 0, g = 0, b = 0;

    if (curved < 0.2) {
      b = Math.round(50 * (curved / 0.2));
    } else if (curved < 0.4) {
      r = Math.round(150 * ((curved - 0.2) / 0.2));
      b = 80 - Math.round(40 * ((curved - 0.2) / 0.2));
    } else if (curved < 0.7) {
      r = 150 + Math.round(80 * ((curved - 0.4) / 0.3));
      g = Math.round(50 * ((curved - 0.4) / 0.3));
    } else {
      // dimmed yellow-white
      r = 220;
      g = 70 + Math.round(155 * ((curved - 0.7) / 0.3));
      b = Math.round(60 * ((curved - 0.7) / 0.3));
    }

    return `rgb(${r}, ${g}, ${b})`;
  }

  const evenChunks = melChunks;
  const nMels = evenChunks[0].length;
  const framesPerChunk = evenChunks[0][0].length;
  const frameWidth = cellWidth / framesPerChunk;
  const melStep = 8;
  let x = labelOffset;

  for (let chunk of evenChunks) {
    for (let frame = 0; frame < framesPerChunk; frame++) {
      for (let mel = 0; mel < nMels; mel += melStep) {
        const dB = chunk[mel][frame];
        const norm = Math.max(0, Math.min(1, (dB + 80) / 80));
        ctx.fillStyle = fireColor(norm);

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

export default WaveformViewer; 