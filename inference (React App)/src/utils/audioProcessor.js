// src/utils/audioProcessor.js

import FFT from 'fft.js';
import { melFilterbank } from "./mel_filterbank";

// Decode file
export async function decodeAudio(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
        const buffer = await audioCtx.decodeAudioData(e.target.result);
        const length = buffer.length;
        const mono = new Float32Array(length);

        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const data = buffer.getChannelData(ch);
          for (let i = 0; i < length; i++) mono[i] += data[i];
        }

        for (let i = 0; i < length; i++) mono[i] /= buffer.numberOfChannels;

        resolve({ audioBuffer: buffer, rawData: mono });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// Split into chunks
export function intoChunks(waveform, sampleRate, duration = 1.0, step = 0.5, normalize = true) {
  const chunkLen = Math.floor(duration * sampleRate);
  const stepLen = Math.floor(step * sampleRate);
  const chunks = [];

  for (let i = 0; i + chunkLen <= waveform.length; i += stepLen) {
    let chunk = waveform.slice(i, i + chunkLen);

    if (normalize) {
      const maxAbs = Math.max(...chunk.map(Math.abs)) || 1e-6;
      chunk = chunk.map((v) => v / maxAbs);
    }

    chunks.push(chunk);
  }

  return chunks;
}

// Hann window
function hannWindow(N) {
  return Float32Array.from({ length: N }, (_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1))));
}

// Convert waveform chunk → transposed mel spectrogram [nMels][frames]
export function generateSpectrogram(chunk, nFFT = 2048, hop = 1024, nMels = 128) {
  const window = hannWindow(nFFT);
  const fft = new FFT(nFFT);
  const spec = [];

  const frames = Math.floor((chunk.length - nFFT) / hop) + 1;
  for (let i = 0; i < frames; i++) {
    const frame = chunk.slice(i * hop, i * hop + nFFT).map((v, j) => v * window[j]);
    const input = Array.from(frame);
    const output = new Array(nFFT).fill(0);

    fft.realTransform(output, input);
    fft.completeSpectrum(output);

    const power = [];
    for (let k = 0; k <= nFFT / 2; k++) {
      const re = output[2 * k], im = output[2 * k + 1];
      power.push(re * re + im * im);
    }

    const melBands = melFilterbank.map((row) =>
      10 * Math.log10(row.reduce((sum, w, i) => sum + w * power[i], 0) + 1e-10)
    );

    spec.push(melBands);
  }

  return Array.from({ length: nMels }, (_, m) => spec.map((f) => f[m]));
}

// Downsample samples into [min, max] pairs for waveform display
export function samplePeaks(samples, totalBins) {
  const binSize = Math.floor(samples.length / totalBins);
  const result = [];

  for (let i = 0; i < totalBins; i++) {
    const start = i * binSize;
    const end = i === totalBins - 1 ? samples.length : (i + 1) * binSize;

    let min = 1.0, max = -1.0;
    for (let j = start; j < end; j++) {
      const val = samples[j];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    result.push([min, max]);
  }

  return result;
}
