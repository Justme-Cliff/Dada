# Dada — A Real-Time Computational Model of Infant Language Acquisition

> *"The infant brain does not learn language — it discovers it, one statistical regularity at a time."*

**Dada** is an open-source, browser-based simulation of the neurobiological processes underlying early language acquisition in human infants. It requires no dataset, no pre-training, and no server. The user's voice is the sole source of input. Over time, as phoneme patterns reinforce, a 3-D anatomical brain visualization responds in real time — and eventually, the model produces its first word.

---

## Scientific Background

### Theoretical Grounding

Dada operationalises several converging lines of empirical research in developmental psycholinguistics and cognitive neuroscience:

**Statistical learning (Saffran, Aslin & Newport, 1996)**
Infants as young as 8 months extract transitional probabilities between syllables from continuous speech within minutes of exposure. Dada models this through an online bigram co-occurrence matrix over MFCC-derived phoneme clusters: as certain cluster transitions recur, their joint probability increases and the model's *consistency score* rises.

**Neural commitment and the perceptual magnet effect (Kuhl, 2004)**
Repeated exposure to native-language phoneme prototypes gradually strengthens specific neural representations while reducing sensitivity to contrasting sounds — a process of *neural commitment*. In Dada, this is implemented as a cluster-frequency reinforcement table combined with exponential recency weighting: recently active phoneme clusters receive stronger gradient updates in the online k-means codebook.

**Cross-language speech perception and phoneme inventory narrowing (Werker & Tees, 1984)**
Between 6 and 12 months, infants lose discrimination ability for phonemic contrasts absent from their native language. Dada approximates this through cluster competition: low-frequency clusters that trail the dominant prototype by a margin `COMPETITION_RATIO` gradually lose recency weight, effectively pruning the phoneme inventory to the most-heard patterns.

**Prosodic bootstrapping and word segmentation (Jusczyk, 1999)**
Stress and rhythmic patterns guide infants in carving continuous speech into word-sized units. While Dada does not implement full prosodic parsing, the bigram entropy metric approximates phonotactic regularity: as the model hears more of the same language, inter-cluster transitions stabilise into predictable (low-entropy) patterns.

**Developmental staging**
The model tracks four discrete developmental stages, each associated with a documented milestone in infant language development:

| Stage | Name | Utterance Range | Hallmark |
|---|---|---|---|
| 0 | Pre-linguistic | 0–30 | Acoustic inventory formation; universal phoneme sensitivity |
| 1 | Canonical babbling | 30–100 | Stable CV-syllable prototypes emerge |
| 2 | Variegated babbling | 100–200 | Complex sequences; bigram learning dominates |
| 3 | First-word forming | 200+ | Specific pattern crystallises into output |

---

## Architecture

### Signal Processing Pipeline

```
Microphone (Web Audio API)
       │
       ▼
  AudioWorklet / ScriptProcessorNode
  (2048-sample blocks, 44.1 kHz)
       │
       ▼  extractMFCCs()
  Mel-Frequency Cepstral Coefficients
  - Hamming window → radix-2 FFT
  - 26-filter Mel filterbank (300–8000 Hz)
  - Log energy → DCT-II → 13 coefficients
  - ~10 ms / frame, ~86 frames/s
       │
       ▼  Voice Activity Detection (RMS threshold)
  Utterance buffer  ──────────────────────────────────┐
  (auto-flush after 900 ms silence)                   │
       │                                              │
       ▼  processFrames()                             ▼
  Online k-means (k=20 clusters)          Web Speech API
  - k-means++ initialization              (SpeechRecognition)
  - Euclidean distance assignment         - Non-continuous mode
  - Decaying learning rate (α 0.08→0.005) - Safari-compatible
  - Codebook: 20 × 13 centroid matrix     - Stopword filtering
       │                                              │
       ▼  processUtterance()                          │
  Learning Model                                      │
  ┌─────────────────────────────────────┐             │
  │ clusterFreq[20]  — lifetime counts  │             │
  │ clusterRecency[20] — decay-weighted │             │
  │ bigramMatrix[20×20]                 │             │
  │ readinessScore (0–100)              │◄────────────┘
  │ developmentStage (0–3)              │  word frequencies
  │ brainAge (0–1, logistic growth)     │  merged in
  └──────────────────┬──────────────────┘
                     │
                     ▼
             IndexedDB persistence
             (idb, survives page reload)
                     │
                     ▼
              Zustand global store
                     │
            ┌────────┴────────┐
            ▼                 ▼
    Three.js 3-D brain    Sidebar stats
    (real MRI pial mesh)  (Framer Motion)
    - Region glow         - Development stage
    - Bloom post-proc     - Pathway strength
    - Brain grows with    - Words heard
      brainAge            - Radial readiness
```

### Brain Visualisation

The 3-D brain model is derived from **MRI pial surface reconstructions** produced by FreeSurfer (Fischl, 2012), obtained from the Brainder.org dataset. The pial surface represents the outer cortical boundary — the surface visible in a conventional brain photograph.

Both hemispheres are loaded as Draco-compressed GLB files (~270 KB each), decoded client-side using the GLTF/Draco WebAssembly decoder. A `MeshPhysicalMaterial` with `clearcoat` parameter simulates the wet sheen of the *pia mater* (the thin membrane covering the cortex).

Regional glow overlays (additive blending) highlight three anatomical areas known to be critical for language processing:

| Region | Approximate Location | Role in Language |
|---|---|---|
| **Primary auditory cortex** | Superior temporal gyrus, Heschl's gyri (Brodmann area 41/42) | Initial acoustic analysis |
| **Wernicke's area** | Left posterior superior temporal gyrus (BA 22) | Phonological pattern recognition; spoken word comprehension |
| **Broca's area** | Left inferior frontal gyrus, pars triangularis/opercularis (BA 44/45) | Articulatory planning; syntactic processing |

Activation levels for each region are derived from the learning model state and updated at 60 fps with exponential smoothing.

### Audio Processing

Dada uses the Web Audio API for low-latency microphone capture. The primary processing path uses `AudioWorklet`, which runs in a dedicated audio rendering thread and is immune to main-thread frame-time jitter from the Three.js scene. A `ScriptProcessorNode` fallback is available for older browser environments.

**MFCC extraction** is implemented entirely in TypeScript without external ML libraries, using a custom radix-2 FFT, a Mel filterbank, and a DCT-II. This ensures the feature computation is fully inspectable and avoids any dependency on WebGL-backed ML frameworks.

**Speech recognition** runs in parallel via the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) in non-continuous mode with `onend` auto-restart — the only configuration that works reliably across Chrome, Firefox, Edge, and Safari.

---

## Readiness Score

The *first word readiness score* (0–100) is a composite of four orthogonal components, each grounded in a distinct developmental criterion:

```
readiness = (
  exposureScore   × 0.40   // lifetime + recency: top cluster reinforcement
  consistencyScore× 0.30   // bigram entropy reduction (Saffran criterion)
  vocabularyScore × 0.20   // acquired cluster count (phoneme inventory breadth)
  utteranceScore  × 0.10   // total session count (time-on-task)
)
```

**No single factor can drive readiness to 100%** — all four must converge. This prevents trivially reaching the first-word threshold with a single long utterance or many short, random ones.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A modern browser (Chrome 66+, Firefox 76+, Safari 14.1+, Edge 79+)
- A microphone

### Installation

```bash
git clone https://github.com/<your-handle>/dada.git
cd dada
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Grant microphone access when prompted. Tap the button at the bottom to begin speaking.

### How to use

1. **Tap the microphone button** — it stays active until you tap again (toggle mode)
2. **Speak naturally** — any language, any content; the model learns phoneme statistics, not words
3. **Watch the brain** — regions glow in response to your voice; neural pathways strengthen over time
4. **Check the sidebar** — tap the toggle (top-right) to see real-time learning statistics
5. **Wait for the first word** — after enough consistent phoneme exposure, the brain babbles back

### Deployment

```bash
npm run build
```

Deploy the `dist/` folder to any static host. HTTPS is required for microphone access (Vercel, Netlify, Cloudflare Pages all provide this automatically).

---

## Browser Compatibility

| Browser | Audio Capture | MFCC | Speech Recognition | Status |
|---|---|---|---|---|
| Chrome 66+ | AudioWorklet | ✓ | SpeechRecognition | ✅ Full |
| Firefox 76+ | AudioWorklet | ✓ | SpeechRecognition | ✅ Full |
| Safari 14.1+ | AudioWorklet | ✓ | webkitSpeechRecognition (non-continuous) | ✅ Full |
| Edge 79+ | AudioWorklet | ✓ | SpeechRecognition | ✅ Full |
| Older Safari | ScriptProcessorNode | ✓ | webkitSpeechRecognition | ⚠️ No word tracking |
| Firefox < 76 | ScriptProcessorNode | ✓ | ✗ | ⚠️ MFCC-only |

The MFCC learning model functions in all browsers. Speech recognition (which enables real-word detection in the sidebar and first-word output) requires the Web Speech API.

---

## Contributing

Dada is open to contributions in several directions:

### Modelling improvements
- **Prosodic parsing**: extract stress/rhythm features from the audio signal to implement prosodic bootstrapping more faithfully
- **Decay scheduling**: empirically calibrate the `RECENCY_ALPHA` parameter against infant habituation data
- **Bigram entropy metric**: replace with a proper transitional probability estimator (see Saffran et al. 1996 for the exact formulation)
- **Cross-utterance learning**: implement episodic memory to allow the model to align patterns across non-consecutive utterances

### Visualisation
- **Cortical parcellation**: colour the real brain mesh by anatomical region using FreeSurfer parcellation labels (aparc.annot)
- **Fibre tracts**: replace the parametric bezier pathways with actual white-matter tractography (e.g., from a DTI atlas)
- **Dynamic gyri**: animate cortical folding over developmental time using a smooth deformation of the pial mesh

### Engineering
- **ONNX Runtime**: replace the custom k-means with a trained phoneme encoder (wav2vec 2.0 base, quantised) for richer acoustic features
- **WebGPU**: migrate the MFCC extraction and k-means assignment to a compute shader for sub-millisecond frame latency
- **SharedArrayBuffer**: implement a lock-free ring buffer between the AudioWorklet and main thread for zero-copy PCM transfer

### Please read before contributing

- Open an issue describing your proposed change before writing code — especially for modelling changes, as they affect the experiment's validity
- Keep the zero-dependency philosophy for the core model (TypeScript only, no ML frameworks)
- All PR descriptions should include a brief scientific justification for the change

---

## References

Fischl, B. (2012). FreeSurfer. *NeuroImage*, 62(2), 774–781.

Jusczyk, P. W. (1999). How infants begin to extract words from speech. *Trends in Cognitive Sciences*, 3(9), 323–328.

Kuhl, P. K. (2004). Early language acquisition: Cracking the speech code. *Nature Reviews Neuroscience*, 5(11), 831–843.

Saffran, J. R., Aslin, R. N., & Newport, E. L. (1996). Statistical learning by 8-month-old infants. *Science*, 274(5294), 1926–1928.

Werker, J. F., & Tees, R. C. (1984). Cross-language speech perception: Evidence for perceptual reorganization during the first year of life. *Infant Behavior and Development*, 7(1), 49–63.

---

## License

MIT License. See `LICENSE` for details.

The MRI brain surface meshes are derived from FreeSurfer pial surface reconstructions distributed via [Brainder.org](https://brainder.org). See their licensing terms before redistribution.

---

*Built with React, Three.js, Web Audio API, and the conviction that the best model of learning is one that actually learns.*
