// src/utils/runInference.js

import * as tf from "@tensorflow/tfjs";

let model = null;

const INSTRUMENTS = ['Piano', 'Guitar', 'Bass', 'Strings', 'Drums'];
const THRESHOLDS = [0.5, 0.6, 0.5, 0.4, 0.5];

export async function loadTFJSModel() {
  if (model) return model;
  model = await tf.loadGraphModel("/model/model.json");
  return model;
}

export async function runModel(melSpec) {
  if (!model) await loadTFJSModel();

  // Reshape: [128][42] → [1, 128, 42, 1]
  const inputData = melSpec.map(row => row.map(val => [val]));
  const inputTensor = tf.tensor4d([inputData], [1, 128, 42, 1], "float32");

  const outputTensor = model.predict(inputTensor);
  const outputArray = await outputTensor.array();
  const predictions = outputArray[0];

  return INSTRUMENTS.map((name, i) => ({
    name,
    active: predictions[i] > THRESHOLDS[i],
    confidence: predictions[i],
  }));
}
