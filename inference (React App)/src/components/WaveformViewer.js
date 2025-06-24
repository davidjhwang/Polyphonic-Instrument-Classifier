import React, { useEffect, useRef } from "react";

const WaveformViewer = ({
  samples,
  cellWidth,
  labelOffset,
  borderWidth,
  chunkCount,
  cursorX,
  onSeek,
}) => {
  const waveformRef = useRef(null);  // background (once)
  const cursorRef = useRef(null);    // foreground (every frame)

  const height = 80;
  const width = labelOffset + chunkCount * cellWidth + borderWidth;

  // ✅ Render waveform ONCE
  useEffect(() => {
    if (!waveformRef.current || samples.length === 0) return;

    const canvas = waveformRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    const peaksPerCell = 7;
    const peakSpacing = cellWidth / peaksPerCell;
    const totalPeaks = chunkCount * peaksPerCell;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#1976d2";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < totalPeaks; i++) {
      const [min, max] = samples[i] || [0, 0];
      const x = labelOffset + i * peakSpacing + peakSpacing / 2;
      const yMin = height / 2 - min * height / 2;
      const yMax = height / 2 - max * height / 2;

      ctx.moveTo(x, yMin);
      ctx.lineTo(x, yMax);
    }

    ctx.stroke();
  }, [samples, cellWidth, labelOffset, borderWidth, chunkCount]);

  // ✅ Draw only red line on top canvas
  useEffect(() => {
    if (!cursorRef.current) return;

    const canvas = cursorRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (cursorX !== null && !isNaN(cursorX)) {
      ctx.beginPath();
      ctx.strokeStyle = "red";
      ctx.lineWidth = 1;
      ctx.moveTo(labelOffset + cursorX, 0);
      ctx.lineTo(labelOffset + cursorX, height);
      ctx.stroke();
    }
  }, [cursorX, labelOffset, width, height]);

  // ✅ Click handler
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
    <div style={{ position: "relative", height }}>
      <canvas
        ref={waveformRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          zIndex: 0,
          pointerEvents: "none", 
        }}
      />
      <canvas
        ref={cursorRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          zIndex: 1,
          cursor: "pointer",
        }}
      />
    </div>
  );
};

export default WaveformViewer;
