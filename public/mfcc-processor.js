/**
 * mfcc-processor.js — AudioWorklet processor for MFCC frame capture.
 *
 * Runs in the dedicated audio rendering thread (no main-thread jank).
 * Sends raw PCM blocks back to the main thread via MessagePort.
 *
 * Browser support:
 *   Chrome 66+, Firefox 76+, Safari 14.1+, Edge 79+
 */

class MFCCProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._active = true
    this._buffer = []
    this._blockSize = 2048  // match ScriptProcessorNode buffer size

    this.port.onmessage = (e) => {
      if (e.data === 'stop') this._active = false
      if (e.data === 'start') this._active = true
    }
  }

  process(inputs) {
    if (!this._active) return true

    const input = inputs[0]
    if (!input || !input[0]) return true

    const samples = input[0]  // Float32Array, 128 samples per call

    // Accumulate samples until we have a full block
    for (let i = 0; i < samples.length; i++) {
      this._buffer.push(samples[i])
    }

    // When block is full, send to main thread and reset
    if (this._buffer.length >= this._blockSize) {
      const block = new Float32Array(this._buffer.splice(0, this._blockSize))
      this.port.postMessage({ type: 'block', samples: block }, [block.buffer])
    }

    return true  // keep processor alive
  }
}

registerProcessor('mfcc-processor', MFCCProcessor)
