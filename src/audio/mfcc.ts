/**
 * MFCC extraction using Meyda.js
 * Processes a raw Float32Array audio buffer and returns an array of
 * 13-dimensional MFCC vectors (one per analysis frame).
 */

const BUFFER_SIZE = 512
const NUM_MFCC_COEFFS = 13
const HOP_SIZE = 256 // 50% overlap

export function extractMFCCs(audioBuffer: Float32Array, sampleRate: number): number[][] {
  const frames: number[][] = []

  if (audioBuffer.length < BUFFER_SIZE) return frames

  for (let i = 0; i + BUFFER_SIZE <= audioBuffer.length; i += HOP_SIZE) {
    const frame = audioBuffer.slice(i, i + BUFFER_SIZE)
    const mfccs = computeMFCC(frame, sampleRate)
    if (mfccs) frames.push(mfccs)
  }

  return frames
}

/**
 * Compute MFCCs for a single frame using the Mel filterbank approach.
 * This is a self-contained implementation that doesn't require Meyda at runtime
 * (avoids Web Worker / module loading complexity), using standard DSP math.
 */
function computeMFCC(frame: Float32Array, sampleRate: number): number[] | null {
  // Apply Hamming window
  const windowed = new Float32Array(frame.length)
  for (let i = 0; i < frame.length; i++) {
    windowed[i] = frame[i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (frame.length - 1)))
  }

  // Power spectrum via FFT approximation (real FFT)
  const powerSpectrum = rfftPowerSpectrum(windowed)
  const nfft = powerSpectrum.length

  // Mel filterbank
  const numFilters = 26
  const lowFreq = 0
  const highFreq = sampleRate / 2
  const melFilters = melFilterbank(numFilters, nfft, sampleRate, lowFreq, highFreq)

  // Apply filterbank to power spectrum
  const filterEnergies = melFilters.map((filter) => {
    let energy = 0
    for (let i = 0; i < filter.length; i++) {
      energy += filter[i] * powerSpectrum[i]
    }
    return Math.log(Math.max(energy, 1e-10))
  })

  // DCT-II to get MFCCs
  const mfccs: number[] = []
  for (let k = 0; k < NUM_MFCC_COEFFS; k++) {
    let sum = 0
    for (let n = 0; n < numFilters; n++) {
      sum += filterEnergies[n] * Math.cos((Math.PI * k * (n + 0.5)) / numFilters)
    }
    mfccs.push(sum)
  }

  return mfccs
}

/** Radix-2 DIT FFT — returns power spectrum (magnitude squared per bin) */
function rfftPowerSpectrum(signal: Float32Array): number[] {
  const n = signal.length
  // Simple DFT for power of 2 sizes
  const real = Array.from(signal)
  const imag = new Array(n).fill(0)

  // Bit-reversal permutation
  let j = 0
  for (let i = 1; i < n; i++) {
    let bit = n >> 1
    while (j & bit) { j ^= bit; bit >>= 1 }
    j ^= bit
    if (i < j) {
      ;[real[i], real[j]] = [real[j], real[i]]
      ;[imag[i], imag[j]] = [imag[j], imag[i]]
    }
  }

  // Cooley-Tukey FFT
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI) / len
    const wRe = Math.cos(ang)
    const wIm = -Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let uRe = 1, uIm = 0
      for (let k = 0; k < len / 2; k++) {
        const tRe = uRe * real[i + k + len / 2] - uIm * imag[i + k + len / 2]
        const tIm = uRe * imag[i + k + len / 2] + uIm * real[i + k + len / 2]
        real[i + k + len / 2] = real[i + k] - tRe
        imag[i + k + len / 2] = imag[i + k] - tIm
        real[i + k] += tRe
        imag[i + k] += tIm
        const newURe = uRe * wRe - uIm * wIm
        uIm = uRe * wIm + uIm * wRe
        uRe = newURe
      }
    }
  }

  // Power spectrum (one-sided)
  const power: number[] = []
  for (let i = 0; i <= n / 2; i++) {
    power.push(real[i] * real[i] + imag[i] * imag[i])
  }
  return power
}

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700)
}

function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1)
}

function melFilterbank(
  numFilters: number,
  nfft: number,
  sampleRate: number,
  lowFreq: number,
  highFreq: number,
): number[][] {
  const lowMel = hzToMel(lowFreq)
  const highMel = hzToMel(highFreq)
  const melPoints = Array.from({ length: numFilters + 2 }, (_, i) =>
    melToHz(lowMel + (i * (highMel - lowMel)) / (numFilters + 1))
  )
  const binFreqs = melPoints.map((hz) => Math.floor((hz / (sampleRate / 2)) * nfft))

  return Array.from({ length: numFilters }, (_, m) => {
    const filter = new Array(nfft).fill(0)
    for (let k = binFreqs[m]; k < binFreqs[m + 1]; k++) {
      filter[k] = (k - binFreqs[m]) / (binFreqs[m + 1] - binFreqs[m])
    }
    for (let k = binFreqs[m + 1]; k <= binFreqs[m + 2]; k++) {
      filter[k] = (binFreqs[m + 2] - k) / (binFreqs[m + 2] - binFreqs[m + 1])
    }
    return filter
  })
}

/** RMS energy of a buffer — used for real-time activation level */
export function computeRMS(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / buffer.length)
}
