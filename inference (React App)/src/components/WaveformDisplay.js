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
      const adjusted = Math.pow(Math.max(0, Math.min(1, norm)), 0.4);
      let r = 0, g = 0, b = 0;

      if (adjusted < 0.05) { // Black => Dark Blue
        const t = adjusted / 0.05;
        b = 40 + 60 * t;
      } else if (adjusted < 0.15) { // Dark Blue => Purple
        const t = (adjusted - 0.05) / 0.1;
        r = 80 * t;
        b = 100 + 80 * t;
      } else if (adjusted < 0.3) { // Purple => Magenta
        const t = (adjusted - 0.15) / 0.15;
        r = 80 + 100 * t;
        b = 180 - 60 * t;
      } else if (adjusted < 0.6) { // Magenta => Red
        const t = (adjusted - 0.3) / 0.3;
        r = 180 + 60 * t;
        b = 120 - 120 * t;
      } else if (adjusted < 0.85) { // Red => Yellow
        const t = (adjusted - 0.6) / 0.25;
        r = 240;
        g = 160 * t;
      } else { // Yellow => White
        const t = (adjusted - 0.85) / 0.15;
        r = 230 + 10 * t;
        g = 160 + 95 * t;
        b = 235 * t;
      }

      return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    const evenChunks = melChunks;
    const nMels = evenChunks[0].length;
    const framesPerChunk = evenChunks[0][0].length;
    const frameWidth = cellWidth / framesPerChunk;
    const melStep = 4;
    let x = labelOffset;
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

  useEffect(() => {
    // === PLAYBACK CURSOR ===
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

  useEffect(() => {
    // === SEEKING INTERACTION ===
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
