/**
 * Sound design using Tone.js
 * Ambient brain hum, neural activation crackle, first-word chime.
 */
import * as Tone from 'tone'

let initialized = false
let ambientOsc1: Tone.Oscillator | null = null
let ambientOsc2: Tone.Oscillator | null = null
let ambientGain: Tone.Gain | null = null
let lfo: Tone.LFO | null = null

export async function initSound() {
  if (initialized) return
  initialized = true

  await Tone.start()

  // Ambient hum: two sine oscillators with subtle LFO modulation
  ambientGain = new Tone.Gain(0).toDestination()
  ambientOsc1 = new Tone.Oscillator(40, 'sine').connect(ambientGain)
  ambientOsc2 = new Tone.Oscillator(80, 'sine').connect(ambientGain)
  lfo = new Tone.LFO({ frequency: 0.08, min: 0.03, max: 0.06 }).connect(ambientGain.gain)

  ambientOsc1.start()
  ambientOsc2.start()
  lfo.start()

  // Fade in ambient hum
  ambientGain.gain.rampTo(0.04, 2)
}

export function triggerNeuralCrackle(region: 'auditory' | 'wernicke' | 'broca', intensity: number) {
  if (!initialized) return
  const noiseSynth = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04 + intensity * 0.06, sustain: 0, release: 0.01 },
  }).toDestination()

  // Different pitch character per region via filter
  const filter = new Tone.Filter({
    type: 'bandpass',
    frequency: region === 'auditory' ? 4000 : region === 'wernicke' ? 2000 : 800,
    Q: 2,
  }).toDestination()

  noiseSynth.connect(filter)
  const vol = new Tone.Volume(-20 + intensity * 10).toDestination()
  filter.connect(vol)

  noiseSynth.triggerAttackRelease('16n')
  setTimeout(() => { noiseSynth.dispose(); filter.dispose(); vol.dispose() }, 500)
}

export function triggerFirstWordChime() {
  if (!initialized) return

  const reverb = new Tone.Reverb({ decay: 4, wet: 0.6 }).toDestination()
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 3 },
  }).connect(reverb)

  synth.set({ volume: -8 })

  // C major chord — warm, soft, wondrous
  synth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '2n')
  setTimeout(() => { synth.triggerAttackRelease(['E4', 'G4', 'B4'], '1n') }, 800)
  setTimeout(() => { synth.dispose(); reverb.dispose() }, 8000)
}

export function setAmbientVolume(vol: number) {
  if (ambientGain) ambientGain.gain.rampTo(Math.max(0, Math.min(vol, 0.08)), 0.5)
}
