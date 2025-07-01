import React, { useState, useRef, useEffect, useCallback } from "react";
import { decodeAudio, intoChunks, generateSpectrogram, samplePeaks} from "./utils/audioProcessor";
import { runModel } from "./utils/runInference";
import WaveformDisplay from "./components/WaveformDisplay.js";
import PredictionTable from "./components/PredictionTable";

const INSTRUMENTS = ['Piano', 'Guitar', 'Bass', 'Strings', 'Drums'];

function App() {
  // File
  const [file, setFile] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [audioCtx, setAudioCtx] = useState(null);
  const [sourceNode, setSourceNode] = useState(null);

  // UI
  const [waveform, setWaveform] = useState([]);
  const [melChunks, setMelChunks] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [timeLabels, setTimeLabels] = useState([]);
  const [status, setStatus] = useState("Waiting for file.");

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [startRatio, setStartRatio] = useState(0);
  const [cursorX, setCursorX] = useState(null);
  const animationRef = useRef(null);

  // Layout
  const [cellWidth, setCellWidth] = useState(50);
  const [labelOffset, setLabelOffset] = useState(120);
  const [cellBorderWidth, setCellBorderWidth] = useState(0);
  const firstCellRef = useRef(null);
  const labelCellRef = useRef(null);

  // Acquire timeline render parameters 
  useEffect(() => {
    if (firstCellRef.current && labelCellRef.current) {
      const cellRect = firstCellRef.current.getBoundingClientRect();
      const labelRect = labelCellRef.current.getBoundingClientRect();
      const borderWidth = parseFloat(getComputedStyle(firstCellRef.current).borderLeftWidth);
      setCellWidth(cellRect.width);
      setCellBorderWidth(borderWidth);
      setLabelOffset(labelRect.width);
    }
  }, [timeline]);

  // Handle audio upload
  const handleUpload = async () => {
    if (!file) return;

    // reset
    stopAudio();
    setStatus("Decoding...");
    setTimeline([]);
    setTimeLabels([]);
    setWaveform([]);
    setCursorX(null);
    setStartRatio(0);

    try {
      // decode
      const { audioBuffer, rawData } = await decodeAudio(file);
      setAudioBuffer(audioBuffer);
      setStatus(`Loaded audio with ${rawData.length} samples`);

      // downsample
      const totalPeaks = 7 * Math.ceil(rawData.length / 44100);
      setWaveform(samplePeaks(rawData, totalPeaks));

      // slice
      const rawChunks = intoChunks(rawData, 44100, 1.0, 1.0, false);
      const normChunks = intoChunks(rawData, 44100, 1.0, 1.0);
      setStatus(`Sliced into ${rawChunks.length} chunks. Generating spectrograms...`);

      // transform
      const melVisuals = rawChunks.map(chunk => generateSpectrogram(chunk));
      const melInputs = normChunks.map(chunk => generateSpectrogram(chunk));
      setMelChunks(melVisuals);

      // predict
      setStatus("Running inference...");
      const predictions = [];
      for (let i = 0; i < melInputs.length; i++) {
        const result = await runModel(melInputs[i]);
        predictions.push({
          time: (i * 1.0).toFixed(2),
          instruments: result
        });

        if (i % 50 === 0) {
          setStatus(`Inference... (${i}/${melInputs.length})`);
          await new Promise(res => setTimeout(res, 10)); 
        }
      }

      // store
      const matrix = INSTRUMENTS.map(() => Array(predictions.length).fill(false));
      const times = predictions.map(p => p.time);

      predictions.forEach((chunk, i) => {
        chunk.instruments.forEach((pred, j) => {
          if (pred.active) matrix[j][i] = true;
        });
      });

      setTimeline(matrix);
      setTimeLabels(times);
      setCursorX(0);
      setStartRatio(0);
      setStatus("Done!");
    } 
    catch (err) {
      console.error("Failed during processing", err);
      setStatus("Failed during processing");
    }
  };

  const stopAudio = () => {
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch {}
      setSourceNode(null);
    }

    if (audioCtx) {
      audioCtx.close();
      setAudioCtx(null);
    }

    cancelAnimationFrame(animationRef.current);
    setIsPlaying(false);
  };

  const playAudio = useCallback((customRatio) => {
    if (!audioBuffer) return;

    const ratio = customRatio ?? startRatio;
    const offset = Math.min(audioBuffer.duration * ratio, audioBuffer.duration - 0.01);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createBufferSource();

    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    src.start(0, offset);

    const startTime = ctx.currentTime;
    setAudioCtx(ctx);
    setSourceNode(src);
    setIsPlaying(true);

    const totalWidth = timeLabels.length * cellWidth;

    const animate = () => {
      const elapsed = ctx.currentTime - startTime;
      const progress = offset + elapsed;

      if (progress >= audioBuffer.duration) {
        setCursorX(null);
        cancelAnimationFrame(animationRef.current);
        setIsPlaying(false);
        return;
      }

      setCursorX((progress / audioBuffer.duration) * totalWidth);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [audioBuffer, startRatio, timeLabels.length, cellWidth]);

  const pauseAudio = useCallback(() => {
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch (err) {
        if (!(err instanceof DOMException)) throw err;
      }
      setSourceNode(null);
    }

    if (audioCtx) {
      audioCtx.close();
      setAudioCtx(null);
    }

    cancelAnimationFrame(animationRef.current);
    setIsPlaying(false);

    const x = startRatio * timeLabels.length * cellWidth;
    setCursorX(x);
  }, [sourceNode, audioCtx, startRatio, timeLabels.length, cellWidth]);

  const handleSeek = (ratio) => {
    const clamped = Math.max(0, Math.min(0.999, ratio));
    setStartRatio(clamped);

    if (isPlaying) {
      pauseAudio();
      setTimeout(() => playAudio(clamped), 0);
    } else {
      setCursorX(clamped * timeLabels.length * cellWidth);
    }
  };

  // Spacebar toggle
  useEffect(() => {
    const keyHandler = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        isPlaying ? pauseAudio() : playAudio();
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [isPlaying, playAudio, pauseAudio]);

  return (
    <div style={{ padding: "4rem", fontFamily: "sans-serif", fontSize: "1.5rem" }}>
      <h2 style={{ fontSize: "2.4rem", marginBottom: "2rem" }}>
        Polyphonic Instrument Classifier
      </h2>

      <input
        type="file"
        accept="audio/*"
        onChange={(e) => setFile(e.target.files[0])}
        style={{
          fontSize: "1.2rem",
          padding: "0.8rem 1.2rem",
          borderRadius: "0.5rem",
          border: "2px solid #555",
        }}
      />
      <br /><br />

      <button
        onClick={handleUpload}
        style={{
          fontSize: "1.4rem",
          padding: "0.8rem 1.5rem",
          cursor: "pointer",
          backgroundColor: "#0f0f0f",
          color: "white",
          border: "none",
          borderRadius: "0.5rem",
          marginTop: "1rem",
        }}
      >
        Upload & Analyze
      </button>

      <p style={{ fontSize: "1.3rem", marginTop: "1.5rem" }}>{status}</p>

      {timeline.length > 0 && (
        <div
          style={{
            marginTop: "3rem",
            overflowX: "auto",
            border: "3px solid #999",
            padding: "0rem",
          }}
        >
          <WaveformDisplay
            samples={waveform}
            melChunks={melChunks}
            samplesPerChunk={44100}
            chunkCount={timeLabels.length}
            cellWidth={cellWidth}
            labelOffset={labelOffset}
            borderWidth={cellBorderWidth}
            cursorX={cursorX}
            onSeek={handleSeek}
          />
          <PredictionTable
            timeline={timeline}
            timeLabels={timeLabels}
            cellWidth={cellWidth}
            labelOffset={labelOffset}
            firstCellRef={firstCellRef}
            labelCellRef={labelCellRef}
          />
        </div>
      )}
    </div>
  );
}

export default App;
