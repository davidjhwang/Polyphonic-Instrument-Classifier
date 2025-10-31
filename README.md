# Polyphonic Instrument Classifier (React)

A browser-based web app for **real-time polyphonic instrument classification**.  
It detects multiple instruments (piano, guitar, bass, strings, drums) playing simultaneously, visualizing predictions along a scrolling timeline with waveform and spectrogram displays.

---

## Overview
This project combines **deep learning** and **real-time web audio processing**.  
A Convolutional Neural Network (CNN) was trained in **Python** using **TensorFlow**, with **Mel spectrograms** extracted via **PyTorch** and **Librosa**.  
The trained model was then converted to **TensorFlow.js** for in-browser inference within a **React** interface.

---

## Features
- Real-time or playback-based instrument classification  
- Supports polyphonic audio (multiple instruments at once)  
- Scrolling timeline showing instrument activations per 1-second window  
- Waveform and spectrogram visualization with playback and seeking  
- Responsive React UI with smooth visualization updates  

---

## Tech Stack
- **Model Training:** TensorFlow (Python), PyTorch, Librosa  
- **Frontend:** React, JavaScript, Tailwind CSS  
- **Audio Processing:** Web Audio API, FFT  
- **Model Inference:** TensorFlow.js  
