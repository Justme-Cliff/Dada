# Dada — Internal Technical Reference

This document is for you (the author). It covers every non-obvious decision, the full data flow, known edge cases, and what to watch for when extending the code. The README is for external collaborators; this is the map for you.

---

## Project Philosophy

The app is intentionally zero-backend. Every computation runs in the browser:
- Audio: Web Audio API (AudioWorklet primary, ScriptProcessorNode fallback)
- Feature extraction: custom TypeScript MFCC (no ML framework)
- Learning: online k-means + frequency/bigram statistics
- Persistence: IndexedDB via the `idb` wrapper
- 3D: Three.js / @react-three/fiber
- Synthesis: Web Speech API

This means the app works on Vercel's free tier with no API keys, no databases, no infra costs. It also means all user data stays on-device — important for privacy.

---

## File Map (annotated)

```
src/
├── audio/
│   ├── mfcc.ts              Custom MFCC implementation — do NOT replace with Meyda
│   │                        (Meyda's browser bundle adds 800 KB; this is ~3 KB)
│   ├── phonemeCluster.ts    Online k-means — the heart of the learning
│   ├── soundDesign.ts       Tone.js audio feedback — ambient hum + crackle + chime
│   └── wordTracker.ts       SpeechRecognition wrapper — runs parallel to MFCC
│
├── hooks/
│   ├── useAudio.ts          Mic capture + VAD + AudioWorklet/ScriptProcessor routing
│   ├── useLearningModel.ts  Wires audio → model → store → IndexedDB
│   └── useSpeechSynthesis.ts First-word trigger via SpeechSynthesis
│
├── model/
│   ├── learningModel.ts     The statistical model — frequency tables + readiness
│   └── persistence.ts       IndexedDB read/write (schema-migration aware)
│
├── store/
│   └── brainStore.ts        Zustand — all shared state (model + activation + UI)
│
├── components/
│   ├── Brain/
│   │   ├── BrainScene.tsx   R3F Canvas, lights, OrbitControls, Bloom
│   │   ├── BrainMesh.tsx    Real MRI brain GLBs + material + region glow + growth
│   │   └── NeuralPathways.tsx  Particle streams along bezier arcs
│   ├── UI/
│   │   ├── MicButton.tsx    Toggle mic button (click to start/stop)
│   │   ├── Sidebar.tsx      Slide-in panel (desktop right, mobile bottom)
│   │   ├── StatsPanel.tsx   All stats: stage, activation, learning, words, readiness
│   │   └── SidebarToggle.tsx  Open/close button
│   └── FirstWordOverlay.tsx  Full-screen celebration on first word
│
└── App.tsx                  Wires useAudio + useLearningModel + useSpeechSynthesis

public/
├── lh.glb                   Left hemisphere, Draco-compressed (~270 KB)
├── rh.glb                   Right hemisphere, Draco-compressed (~270 KB)
├── draco_decoder.js         Local Draco WASM decoder (avoids CDN dependency)
├── draco_decoder.wasm       ~192 KB — loaded once, cached forever
├── draco_encoder.js         Needed by loader even if not encoding
├── draco_wasm_wrapper.js    JS wrapper for the WASM decoder
└── mfcc-processor.js        AudioWorklet processor (raw PCM → main thread)
```

---

## Brain Model — Coordinate System

The pial surface OBJ files from Brainder.org use **FreeSurfer surface RAS space** (millimetres):
- X = Right (positive = patient right)
- Y = Anterior (positive = front of head)
- Z = Superior (positive = top of head)

The brain group in `BrainMesh.tsx` applies `rotation={[-Math.PI/2, 0, 0]}` which transforms:
```
FreeSurfer (R, A, S)  →  Three.js (R, S, -A)
Three.js X = R
Three.js Y = S  (superior = up, correct)
Three.js Z = -A (anterior points AWAY from default camera)
```

This means from the default camera position `[0, 0.3, 4.5]`, you see the **posterior** (occipital) surface first. Users can rotate with OrbitControls. If you want the frontal lobe facing forward, change the group rotation to `[-Math.PI/2, Math.PI, 0]` — this flips the A axis so the forehead faces the camera, but mirrors left/right (which is the standard radiological convention anyway).

**Scale factor**: `SCALE = 0.0118` maps 170 mm brain → ~2 Three.js units.

**Region overlay positions** in the group's local space (FreeSurfer mm):
- Auditory R: `[55, -20, 10]` → world: `(0.65, 0.04, 0.24)`
- Auditory L: `[-55, -20, 10]` → world: `(-0.65, 0.04, 0.24)`
- Wernicke: `[-52, -40, 10]` → world: `(-0.61, 0.04, 0.47)`
- Broca: `[-50, 20, 20]` → world: `(-0.59, 0.16, -0.24)`

These match the `NeuralPathways.tsx` world-space positions. **If you adjust brain scale or rotation, update both files.**

---

## MFCC Implementation

`src/audio/mfcc.ts` — custom, no dependencies.

Pipeline per 2048-sample block:
1. **Frame slicing**: 512-sample frames, 50% overlap (256-sample hop)
2. **Hamming window**: reduces spectral leakage at frame boundaries
3. **Radix-2 FFT**: in-place, real-valued input → complex output
4. **Power spectrum**: `|X[k]|²`
5. **Mel filterbank**: 26 triangular filters, 300–8000 Hz, linearly spaced in Mel scale
6. **Log compression**: `log(max(energy, 1e-10))`
7. **DCT-II**: returns coefficients 1–13 (skip C0 = total log energy, too correlated with volume)

**What you get per block**: an array of 13-element vectors, one per frame. A 2048-sample block at 44100 Hz contains ~5–6 frames.

**Why custom?** Meyda is the standard choice but adds ~800 KB to the bundle. The custom implementation is ~80 lines and produces equivalent coefficients. If you ever add Meyda, remove `mfcc.ts` entirely.

---

## Online K-Means (phonemeCluster.ts)

K = 20 clusters, representing ~20 phoneme-like acoustic units.

**Initialization**: k-means++ when first frame batch arrives (avoids random centroid placement — see Arthur & Vassilvitskii 2007 for why this matters).

**Assignment**: Euclidean distance in 13-D MFCC space.

**Update rule**:
```
centroid_new = centroid_old + learning_rate × (frame - centroid_old)
```

**Learning rate schedule**: starts at `INITIAL_LR = 0.08`, decays by `LR_DECAY = 0.9998` per update, floor at `MIN_LR = 0.005`. This models the gradual reduction in neural plasticity as representations solidify — the codebook becomes increasingly stable over time (Kuhl's neural commitment).

**BABBLE_MAP**: maps cluster IDs 0–19 to syllables. This is purely cosmetic — the mapping is arbitrary. The acoustic identity of each cluster is determined entirely by the user's voice.

---

## The Learning Model (learningModel.ts)

### Key parameters

| Parameter | Value | What it controls |
|---|---|---|
| `CLUSTER_FREQ_THRESHOLD` | 250 | Top cluster must be heard ×250 frames before readiness can reach 100% |
| `MIN_UTTERANCES` | 50 | Minimum speaking sessions |
| `CONSISTENCY_GATE` | 0.45 | How much entropy must reduce for full consistency score |
| `MIN_VOCABULARY` | 4 | Clusters heard ≥25 times to count as "acquired" |
| `RECENCY_ALPHA` | 0.88 | Exponential decay per utterance (~8-utterance half-life) |

### Readiness formula

```
exposureScore   = freqScore × 0.70 + recencyBoost × 0.30
readiness       = exposureScore × 0.40
                + consistencyScore × 0.30
                + vocabularyScore × 0.20
                + utteranceScore × 0.10
```

This is **multiplicatively gated** by design — no single factor drives the score to 100%. A user who speaks 500 one-second utterances of random noise will have high exposure and utterance scores, but zero consistency. A user who speaks one long continuous sentence will have high consistency but zero utterance count. Only genuine, repeated, consistent speech accumulates all four.

### Brain age (logistic growth)

```
brainAge = 1 / (1 + exp(-0.03 × (totalUtterances - 80)))
```

This is a logistic (sigmoid) function:
- Near-zero for the first ~20 utterances
- Rapid growth between utterances 50–120
- Approaches 1.0 asymptotically after ~200 utterances
- Capped at 0.95 until `firstWordSpoken = true`, then 1.0

In `BrainMesh.tsx`, the brain group scale is `SCALE × (0.88 + smoothedAge × 0.12)`. Brain starts at 88% of full size, reaches 100% at first word. The scale is smoothed with a very slow lerp (`+= (target - current) × 0.002` per frame) so the growth is imperceptible frame-to-frame.

---

## Audio Pipeline Details

### AudioWorklet vs ScriptProcessorNode

`useAudio.ts` tries AudioWorklet first:
1. Calls `ctx.audioWorklet.addModule('/mfcc-processor.js')`
2. Creates `AudioWorkletNode('mfcc-processor')`
3. Registers `port.onmessage` handler for `{type: 'block', samples: Float32Array}`

The worklet processor (`public/mfcc-processor.js`) accumulates 128-sample chunks from Web Audio API into 2048-sample blocks, then `postMessage`s the block back via `Transferable` (zero-copy).

If worklet fails (no support, HTTPS required for worklet modules — check this!), falls back to `ScriptProcessorNode(2048, 1, 1)` with `onaudioprocess`.

**IMPORTANT**: AudioWorklet modules require HTTPS or localhost. On any custom domain without HTTPS, the fallback will trigger.

### VAD (Voice Activity Detection)

```
RMS > 0.007 → speech starts
  → accumulate MFCC frames + RMS values
  → cancel any pending silence timer

RMS ≤ 0.007 while speaking → start 900ms silence countdown
  → if countdown completes → flush utterance

Utterance < 300ms → discard (noise burst)
```

The 0.007 threshold works well in a quiet room. In noisy environments, the VAD will fire continuously — implement a noise floor estimator if this becomes an issue (see WebRTC VAD algorithm for reference).

### WordTracker

Runs in parallel with MFCC processing. Uses `SpeechRecognition` (Chrome/Edge/Firefox) or `webkitSpeechRecognition` (Safari).

**Safari fix**: `continuous: true` is unreliable on Safari. The tracker uses `continuous: false` and restarts in the `onend` callback while `running === true`. This creates a loop of short recognition sessions. The `buildRecognition()` method is called fresh on each `start()` to avoid Safari state machine bugs.

**Word filtering**: stopwords are filtered (see `STOPWORDS` set). Words shorter than 2 characters are dropped. Only final results are used (`isFinal === true`).

---

## Persistence

Database: `dada-brain` (IndexedDB, v2)
Store: `model-state`, single key `'current'`

`saveModel` is called after every utterance. On the free Vercel tier this is localStorage-equivalent — no network call, <5ms.

**Schema migration**: `DB_VERSION = 2`. The `upgrade` callback runs when the database version increases. New fields are handled by `loadModel()` merging saved state with `createInitialModel()` defaults — so if you add a field to `ModelState`, add its default to `createInitialModel()` and it will be backfilled on load for users with old saved data. Bump `DB_VERSION` only if you delete or rename a field (destructive change).

If you need to reset a user's state (debugging): open DevTools → Application → IndexedDB → dada-brain → delete.

---

## Known Edge Cases & Gotchas

### 1. AudioContext suspended on iOS
iOS Safari requires a user gesture to start AudioContext. `initAudio` is called from the mic button click handler, which is a user gesture — so this is handled. But if the page is backgrounded and foregrounded, the context may suspend again. The `initAudio` function checks `ctx.state === 'suspended'` and calls `.resume()` on subsequent clicks.

### 2. AudioWorklet modules need HTTPS
The AudioWorklet `addModule` call fails on HTTP (non-localhost). If you're testing on a network device via HTTP, the fallback ScriptProcessorNode will be used silently. Check the console for the warn log.

### 3. SpeechRecognition requires microphone permission
`wordTracker.ts` starts `SpeechRecognition` when the mic button is pressed. If the user denied mic permission, SpeechRecognition throws `not-allowed`. The error handler ignores `no-speech` and `aborted` but logs anything else. If recognition silently fails, word tracking won't work but the MFCC model continues.

### 4. Draco decoder loading
`useGLTF.setDecoderPath('/')` must be called before any `useGLTF(url)` call. It's at module-top in `BrainMesh.tsx` which imports before render, so it's set before the first frame. The local decoder files (`/draco_decoder.wasm`, etc.) are in `public/` — they're served by Vite in dev and included in `dist/` on build.

### 5. GLB coordinate system
The pial surface OBJs were converted by `obj2gltf` which copies coordinates as-is. The GLTF spec requires Y-up, but the converter doesn't enforce it — the brain coordinates are in FreeSurfer RAS (Z-up). The Y-up conversion happens in the group rotation in `BrainMesh.tsx`. If you ever re-export the brain with a Y-up converter (like Blender), remove or change the rotation.

### 6. NeuralPathways positions vs BrainMesh transform
`NeuralPathways.tsx` positions are in **world space** (after the BrainMesh group transform). `BrainMesh.tsx` region overlays are in the **group's local space** (FreeSurfer mm). If you change the group's position/rotation/scale in BrainMesh, recalculate the world positions in NeuralPathways using:
```
worldX = R * SCALE
worldY = S * SCALE + Y_OFFSET
worldZ = -A * SCALE
```

### 7. `<line>` JSX type collision
`NeuralPathways.tsx` creates `THREE.Line` objects imperatively in `useEffect` instead of using `<line>` JSX. This is intentional: `<line>` in JSX resolves to the HTML SVG element type, not `THREE.Line`, causing TypeScript errors. The group ref pattern avoids this.

### 8. High-poly brain mesh on mobile
Each hemisphere has ~144k vertices / ~289k faces. On mobile GPUs this is heavy. If performance degrades on mobile, either:
- Serve a simplified version (decimate to 50k faces in Blender, export new GLBs)
- Reduce the Three.js DPR: change `dpr={[1, 2]}` to `dpr={1}` in BrainScene.tsx

### 9. First word timing
The readiness score crosses 95 only after genuine sustained exposure. In a typical session (speaking 10–15 min):
- ~4–8 utterances/min × 15 min = 60–120 utterances
- readiness will be around 60–80% after a single 15-min session
- Getting to 95% requires 2–3 sustained sessions

This is intentional — it mirrors real infant development. Lower `CLUSTER_FREQ_THRESHOLD` and `MIN_UTTERANCES` if you want faster feedback for demos.

---

## Tuning the Learning Rate (Quick Reference)

| Goal | Change |
|---|---|
| First word comes faster | Reduce `CLUSTER_FREQ_THRESHOLD` (250→100) and `MIN_UTTERANCES` (50→25) |
| First word feels more earned | Increase thresholds (250→400, 50→80) |
| Brain grows faster | Increase 0.03 coefficient in brainAge logistic |
| More sensitivity to recent speech | Reduce `RECENCY_ALPHA` (0.88→0.75) |
| Longer memory | Increase `RECENCY_ALPHA` (0.88→0.95) |
| Faster k-means adaptation | Increase `INITIAL_LR` (0.08→0.15) |
| More stable clusters | Reduce `MIN_LR` and `INITIAL_LR` |

---

## Deployment Checklist

- [ ] `npm run build` completes without errors
- [ ] `dist/` contains `lh.glb`, `rh.glb`, `draco_*.{js,wasm}`, `mfcc-processor.js`
- [ ] Deploy to HTTPS host (required for mic + AudioWorklet)
- [ ] Test on Chrome, Firefox, Safari (mobile Safari especially)
- [ ] Test mic permissions prompt
- [ ] Test IndexedDB persistence (reload page — model should restore)
- [ ] Test AudioWorklet fallback by temporarily renaming `mfcc-processor.js`
- [ ] Test SpeechRecognition on Safari (use non-English if testing language independence)

---

## What to Work on Next

**High value:**
1. Cortical parcellation colours on the real brain mesh using FreeSurfer aparc labels
2. Better noise floor estimation for the VAD (WebRTC algorithm)
3. AudioWorklet: use SharedArrayBuffer + Atomics for zero-copy transfer (requires COOP/COEP headers)

**Interesting research extensions:**
1. Bilingual mode: toggle between two input languages, observe phoneme interference
2. Export model state as JSON for offline analysis
3. Log utterance timestamps to study session-dependency of learning curves

**Polish:**
1. Loading skeleton / placeholder while brain GLBs decode (first load ~550 KB)
2. Onboarding tooltip on first visit explaining what to do
3. Reset button in the sidebar with confirmation
