// src/utils/audioProcessor.js

import FFT from 'fft.js';
import { melFilterbank } from "./mel_filterbank";

export async function decodeAudio(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100,
        });

        const arrayBuffer = event.target.result;
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;

        // Average channels to mono
        const rawData = new Float32Array(length);
        for (let ch = 0; ch < numChannels; ch++) {
          const channelData = audioBuffer.getChannelData(ch);
          for (let i = 0; i < length; i++) {
            rawData[i] += channelData[i];
          }
        }
        for (let i = 0; i < length; i++) {
          rawData[i] /= numChannels;
        }

        resolve({ audioBuffer, rawData });
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

export function intoChunks(waveform, sampleRate, duration = 1.0, step = 0.5, normalize = true) {
  const chunkLength = Math.floor(duration * sampleRate);
  const stepLength = Math.floor(step * sampleRate);
  const chunks = [];

  for (let start = 0; start + chunkLength <= waveform.length; start += stepLength) {
    let chunk = waveform.slice(start, start + chunkLength);

    if (normalize) {
      let maxAbs = 0;
      for (let i = 0; i < chunk.length; i++) {
        const absVal = Math.abs(chunk[i]);
        if (absVal > maxAbs) maxAbs = absVal;
      }

      const EPSILON = 1e-6;
      chunk = chunk.map((v) => v / (maxAbs + EPSILON));
    }

    chunks.push(chunk);
  }

  return chunks;
}

function hannWindow(N) {
  const window = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  return window;
}

export function generateSpectrogram(chunk, nFFT = 2048, hopLength = 1024, nMels = 128) {
  const hann = hannWindow(nFFT);
  const fft = new FFT(nFFT);
  const melSpectrogram = [];

  const nFrames = Math.floor((chunk.length - nFFT) / hopLength) + 1;

  for (let i = 0; i < nFrames; i++) {
    const start = i * hopLength;
    const frame = chunk.slice(start, start + nFFT);
    const windowed = frame.map((v, j) => v * hann[j]);

    const input = new Array(nFFT).fill(0);
    const output = new Array(nFFT).fill(0);
    for (let j = 0; j < nFFT; j++) input[j] = windowed[j] || 0;

    fft.realTransform(output, input);
    fft.completeSpectrum(output);

    const powerSpectrum = [];
    for (let k = 0; k <= nFFT / 2; k++) {
      const re = output[2 * k];
      const im = output[2 * k + 1];
      powerSpectrum.push(re * re + im * im);
    }

    const melBands = melFilterbank.map((filterRow) => {
      let sum = 0;
      for (let i = 0; i < filterRow.length; i++) {
        sum += filterRow[i] * powerSpectrum[i];
      }
      return 10 * Math.log10(sum + 1e-10);
    });

    melSpectrogram.push(melBands);
  }

  const transposed = Array.from({ length: nMels }, (_, m) =>
    melSpectrogram.map((frame) => frame[m])
  );

  return transposed;
}

export function samplePeaks(samples, totalBins) {
  const result = [];
  const binSize = Math.floor(samples.length / totalBins);

  for (let i = 0; i < totalBins; i++) {
    const start = i * binSize;
    const end = i === totalBins - 1 ? samples.length : (i + 1) * binSize;
    let min = 1.0;
    let max = -1.0;

    for (let j = start; j < end; j++) {
      const val = samples[j];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    result.push([min, max]);
  }

  return result; // array of [min, max]
}
