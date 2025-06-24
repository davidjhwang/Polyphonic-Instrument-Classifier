// src/components/AudioUploader.js

import React, { useState } from "react";
import {
  decodeAudioFile,
  sliceIntoChunks,
  generateMelSpectrogram
} from "../utils/audioProcessor";
import { runModelOnSpectrogram } from "../utils/runInference";

const AudioUploader = () => {
  const [status, setStatus] = useState("Waiting for file...");
  const [waveform, setWaveform] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("Decoding...");

    try {
      const data = await decodeAudioFile(file);
      setWaveform(data);
      setStatus(`Loaded audio with ${data.length} samples`);

      const chunks = sliceIntoChunks(data, 44100);
      setStatus(`Sliced into ${chunks.length} chunks, generating mel spectrograms...`);

      const melSpectrograms = chunks.map(generateMelSpectrogram);
      setStatus(`Generated ${melSpectrograms.length} mel spectrograms. Running inference...`);

      const allPredictions = [];

      for (let i = 0; i < melSpectrograms.length; i++) {
        const prediction = await runModelOnSpectrogram(melSpectrograms[i]);
        allPredictions.push({
          time: (i * 0.5).toFixed(2),
          instruments: prediction
        });

        if (i % 50 === 0) {
          setStatus(`Running inference... (${i}/${melSpectrograms.length})`);
          await new Promise((res) => setTimeout(res, 10));
        }
      }

      console.log("Timeline predictions:", allPredictions);

      const summary = allPredictions
        .slice(0, 5)
        .map(({ time, instruments }) => {
          const active = instruments.filter(p => p.active).map(p => p.name).join(", ") || "None";
          return `${time}s: ${active}`;
        })
        .join("\n");

      setStatus(`Finished! Predicted instruments per chunk:\n${summary}`);
    } catch (err) {
      console.error("Error decoding or processing audio:", err);
      setStatus("Failed during processing");
    }
  };

  return (
    <div className="p-4 border rounded-xl">
      <h2 className="text-lg font-semibold mb-2">Upload Audio File</h2>
      <input type="file" accept="audio/*" onChange={handleFileChange} />
      <p className="mt-2 text-sm whitespace-pre-line">{status}</p>
    </div>
  );
};

export default AudioUploader;
