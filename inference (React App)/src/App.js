import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  decodeAudioFile,
  sliceIntoChunks,
  generateMelSpectrogram,
  downsamplePeaks
} from "./utils/audioProcessor";
import { runModelOnSpectrogram } from "./utils/runInference";
import WaveformViewer from "./components/WaveformViewer";
import PredictionTable from "./components/PredictionTable";

const INSTRUMENTS = ['Piano', 'Guitar', 'Bass', 'Strings', 'Drums'];

function App() {
  const [file, setFile] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [audioCtx, setAudioCtx] = useState(null);
  const [sourceNode, setSourceNode] = useState(null);
  const [cursorX, setCursorX] = useState(null);
  const animationRef = useRef(null);

  const [timeline, setTimeline] = useState([]);
  const [timeLabels, setTimeLabels] = useState([]);
  const [status, setStatus] = useState("Waiting for file.");
  const [waveform, setWaveform] = useState([]);

  const [cellWidth, setCellWidth] = useState(50);
  const [labelOffset, setLabelOffset] = useState(120);
  const [cellBorderWidth, setCellBorderWidth] = useState(0);

  const firstCellRef = useRef(null);
  const labelCellRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [startRatio, setStartRatio] = useState(0);

  useEffect(() => {
    if (firstCellRef.current && labelCellRef.current) {
      const cell = firstCellRef.current;
      const label = labelCellRef.current;
      
      const cellRect = cell.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      const computed = window.getComputedStyle(cell);
      const borderThickness = parseFloat(computed.borderLeftWidth);
      
      setCellBorderWidth(borderThickness);
      setCellWidth(cellRect.width);
      setLabelOffset(labelRect.width);
    }
  }, [timeline]);

  const handleUpload = async () => {
    if (!file) return;
    setStatus("Decoding...");

    try {
      const { audioBuffer, rawData } = await decodeAudioFile(file);
      setAudioBuffer(audioBuffer); 
      setStatus(`Loaded audio with ${rawData.length} samples`);

      const peakBinsPerCell = 7;
      const totalPeaks = peakBinsPerCell * Math.ceil(rawData.length / 44100 / 0.5);
      const peaks = downsamplePeaks(rawData, totalPeaks);
      setWaveform(peaks);

      const chunks = sliceIntoChunks(rawData, 44100);
      setStatus(`Sliced into ${chunks.length} chunks, generating mel spectrograms...`);

      const melSpectrograms = chunks.map(chunk => generateMelSpectrogram(chunk));
      setStatus(`Generated ${melSpectrograms.length} mel spectrograms. Running inference...`);

      const predictions = [];

      for (let i = 0; i < melSpectrograms.length; i++) {
        const result = await runModelOnSpectrogram(melSpectrograms[i]);
        predictions.push({
          time: (i * 0.5).toFixed(2),
          instruments: result
        });

        if (i % 50 === 0) {
          setStatus(`Running inference... (${i}/${melSpectrograms.length})`);
          await new Promise(res => setTimeout(res, 10));
        }
      }

      const matrix = INSTRUMENTS.map(() => Array(predictions.length).fill(false));
      const times = [];

      predictions.forEach((chunk, i) => {
        times.push(chunk.time);
        chunk.instruments.forEach((pred, j) => {
          if (pred.active) {
            matrix[j][i] = true;
          }
        });
      });

      setTimeline(matrix);
      setTimeLabels(times);
      setStatus("Done!");
      setStartRatio(0); 
      setCursorX(0); 
    } catch (err) {
      console.error("Error during processing:", err);
      setStatus("Failed during processing");
    }
  };

  const playAudio = useCallback((customRatio) => {
    if (!audioBuffer) return;

    const ratio = customRatio ?? startRatio;
    const rawOffset = audioBuffer.duration * ratio;
    const offset = Math.min(rawOffset, audioBuffer.duration - 0.01);

    const context = new (window.AudioContext || window.webkitAudioContext)();
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.start(0, offset);

    const playStartTime = context.currentTime;

    setAudioCtx(context);
    setSourceNode(source);
    setIsPlaying(true);

    const totalWidth = timeLabels.length * cellWidth;

    const update = () => {
      const elapsed = context.currentTime - playStartTime;
      const progress = offset + elapsed;

      if (progress >= audioBuffer.duration) {
        setCursorX(null);
        cancelAnimationFrame(animationRef.current);
        setIsPlaying(false);
        return;
      }

      const x = (progress / audioBuffer.duration) * totalWidth;
      setCursorX(x);
      animationRef.current = requestAnimationFrame(update);
    };

    update();
  }, [audioBuffer, startRatio, timeLabels.length, cellWidth]);

  const pauseAudio = useCallback(() => {
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch (err) {
        if (err instanceof DOMException) {
          console.warn("Audio source already stopped.");
        } else {
          throw err;
        }
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
    const clampedRatio = Math.min(Math.max(ratio, 0), 0.999);
    setStartRatio(clampedRatio);

    if (isPlaying) {
      pauseAudio();
      setTimeout(() => playAudio(clampedRatio), 0);
    } else {
      setCursorX(clampedRatio * timeLabels.length * cellWidth); 
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) {
          pauseAudio();
        } else {
          playAudio();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, playAudio, pauseAudio]);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Polyphonic Instrument Classifier Timeline</h2>
      <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files[0])} />
      <br /><br />
      <button onClick={handleUpload}>Upload & Analyze</button>
      <button onClick={playAudio}>▶️ Play</button>
      <button onClick={pauseAudio}>⏹️ Pause</button>
      <p>{status}</p>

      {timeline.length > 0 && (
        <div style={{ marginTop: "2rem", overflowX: "auto", border: "1px solid #ccc" }}>
          <WaveformViewer
            samples={waveform}
            samplesPerChunk={44100 * 0.5}
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
