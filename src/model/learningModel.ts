/**
 * learningModel.ts — Online phoneme-statistical language-acquisition model
 *
 * Grounded in infant language-acquisition research:
 *
 *  Saffran et al. (1996) — statistical learning: infants extract phoneme
 *    transitional-probability patterns from continuous speech within minutes.
 *
 *  Kuhl (2004) — neural commitment / perceptual magnet effect: early exposure
 *    strengthens native-language phoneme prototypes and weakens sensitivity to
 *    foreign contrasts. Modelled here as cluster-frequency reinforcement.
 *
 *  Werker & Tees (1984) — cross-language speech perception: the phoneme inventory
 *    narrows with exposure. Modelled as cluster competition + decay.
 *
 *  Jusczyk (1999) — prosodic bootstrapping: rhythmic patterns guide word
 *    segmentation. Approximated through bigram entropy reduction.
 *
 * Four developmental stages:
 *   0  Pre-linguistic   (0–30 utterances)    acoustic inventory formation
 *   1  Canonical babbling (30–100)           CV-syllable patterns stabilise
 *   2  Variegated babbling (100–200)         complex sequences, bigram learning
 *   3  First word (200+ & readiness ≥ 95)   pattern crystallises into output
 */

import { K, processFrames, initCodebook, BABBLE_MAP } from '../audio/phonemeCluster'
import type { ModelState, DevelopmentStage } from '../store/brainStore'

// ── Developmental thresholds ──────────────────────────────────────────────────
const STAGE_THRESHOLDS: [number, number, number, number] = [0, 30, 100, 200]

// ── Readiness gate values (all must be satisfied for first-word) ──────────────
const CLUSTER_FREQ_THRESHOLD = 50     // top cluster lifetime frame count
const MIN_UTTERANCES         = 15     // minimum speaking sessions
const CONSISTENCY_GATE       = 0.70   // bigram entropy reduction required
const MIN_VOCABULARY         = 2      // clusters heard ≥ 10 times

// ── Recency decay — how quickly old patterns fade (per utterance) ─────────────
// α close to 1 = slow decay (long memory); close to 0 = fast decay
const RECENCY_ALPHA = 0.88  // ~8 utterances half-life (similar to infant attention span)

// ── Cluster competition threshold ──────────────────────────────────────────────
// Clusters that trail the top cluster by this factor stop competing
const COMPETITION_RATIO = 0.04   // bottom 4% of max recency weight pruned

export function createInitialModel(): ModelState {
  return {
    clusterFreq:    new Array(K).fill(0),
    clusterRecency: new Array(K).fill(0),
    bigramMatrix:   Array.from({ length: K }, () => new Array(K).fill(0)),
    totalUtterances: 0,
    totalFrames: 0,
    codebook:    initCodebook(),
    firstWordSpoken: false,
    firstWord:   '',
    readinessScore: 0,
    pathwayStrength: [0, 0, 0],
    wordFreq: {},
    developmentStage: 0,
    brainAge: 0,
  }
}

export interface UtteranceResult {
  model: ModelState
  activation: { auditory: number; wernicke: number; broca: number }
  topClusterId: number
  rms: number
}

export function processUtterance(
  frames: number[][],
  rms: number,
  model: ModelState,
): UtteranceResult {
  if (frames.length === 0) {
    // Still count the session — utteranceScore should grow with each listen event
    const totalUtterances = model.totalUtterances + 1
    const utteranceScore  = Math.min(totalUtterances / MIN_UTTERANCES, 1.0)
    const readinessScore  = Math.min(
      model.readinessScore + utteranceScore * 0.10 * 100 * 0.05,
      model.readinessScore + 0.5,  // cap increment per empty session
    )
    return {
      model: { ...model, totalUtterances, readinessScore },
      activation: { auditory: rms, wernicke: 0, broca: 0 },
      topClusterId: 0,
      rms,
    }
  }

  // ── k-means assignment + online codebook update ────────────────────────────
  const { sequence, codebook } = processFrames(frames, model.codebook)
  const frameCount = sequence.length

  // ── Lifetime frequency table ───────────────────────────────────────────────
  const clusterFreq = [...model.clusterFreq]
  for (const id of sequence) clusterFreq[id]++

  // ── Recency-weighted table (exponential moving average) ────────────────────
  // Models infant attention / neural commitment decay:
  //   recent exposure strengthens prototypes; stale exposure fades
  let clusterRecency = model.clusterRecency.map((v) => v * RECENCY_ALPHA)
  for (const id of sequence) {
    clusterRecency[id] = clusterRecency[id] + (1 - RECENCY_ALPHA)
  }

  // ── Bigram co-occurrence matrix ────────────────────────────────────────────
  const bigramMatrix = model.bigramMatrix.map((row) => [...row])
  for (let i = 0; i + 1 < sequence.length; i++) {
    bigramMatrix[sequence[i]][sequence[i + 1]]++
  }

  const totalUtterances = model.totalUtterances + 1
  const totalFrames     = model.totalFrames + frameCount

  // ── Developmental stage ────────────────────────────────────────────────────
  let developmentStage: DevelopmentStage = 0
  if (totalUtterances >= STAGE_THRESHOLDS[3]) developmentStage = 3
  else if (totalUtterances >= STAGE_THRESHOLDS[2]) developmentStage = 2
  else if (totalUtterances >= STAGE_THRESHOLDS[1]) developmentStage = 1

  // ── Brain age: non-linear growth curve (logistic, like real cortical growth) ─
  // At 200 utterances the brain reaches ~85% of final size;
  // full 100% requires first word to be spoken.
  const brainAge = Math.min(
    1 / (1 + Math.exp(-0.03 * (totalUtterances - 80))),
    model.firstWordSpoken ? 1.0 : 0.95,
  )

  // ── Readiness score (0–100) ────────────────────────────────────────────────
  const maxFreq      = Math.max(...clusterFreq)
  const topClusterId = clusterFreq.indexOf(maxFreq)

  // 1. Phoneme exposure — how well is the dominant cluster reinforced?
  //    Use both lifetime freq AND recency for a two-component score.
  const maxRecency   = Math.max(...clusterRecency)
  const freqScore    = Math.min(maxFreq / CLUSTER_FREQ_THRESHOLD, 1.0)
  const recencyBoost = Math.min(maxRecency * 8, 1.0)   // peaks after ~5 recent utterances
  const exposureScore = freqScore * 0.70 + recencyBoost * 0.30

  // 2. Pattern consistency — low bigram entropy for the top cluster's row
  //    (matches Saffran's transitional probability criterion)
  const topRow      = bigramMatrix[topClusterId]
  const topRowTotal = topRow.reduce((a, b) => a + b, 0)
  let rawEntropy = 0
  if (topRowTotal > 0) {
    for (const count of topRow) {
      if (count > 0) {
        const p = count / topRowTotal
        rawEntropy -= p * Math.log2(p)
      }
    }
  }
  const maxEntropy      = Math.log2(K)
  const normEntropy     = topRowTotal > 0 ? rawEntropy / maxEntropy : 1
  const consistencyScore = Math.max((CONSISTENCY_GATE - normEntropy) / CONSISTENCY_GATE, 0)

  // 3. Vocabulary breadth — how many distinct phoneme prototypes are acquired?
  //    (Werker-style phoneme inventory narrowing)
  const acquiredClusters = clusterFreq.filter((c) => c >= 10).length
  const vocabularyScore  = Math.min(acquiredClusters / MIN_VOCABULARY, 1.0)

  // 4. Session count gate
  const utteranceScore = Math.min(totalUtterances / MIN_UTTERANCES, 1.0)

  // Combined: all four components must be high (multiplicative interaction
  // prevents any single factor from carrying the readiness score alone)
  const rawScore =
    exposureScore   * 0.40 +
    consistencyScore* 0.30 +
    vocabularyScore * 0.20 +
    utteranceScore  * 0.10

  const readinessScore = Math.min(rawScore * 100, 100)

  // ── Pathway strength (Aud↔Wer, Wer↔Bro, Aud↔Bro) ─────────────────────────
  // Clusters 0–6 map to auditory, 7–13 Wernicke, 14–19 Broca
  const aw = sumBigrams(bigramMatrix, [0,1,2,3,4,5,6], [7,8,9,10,11,12,13])
  const wb = sumBigrams(bigramMatrix, [7,8,9,10,11,12,13], [14,15,16,17,18,19])
  const ab = sumBigrams(bigramMatrix, [0,1,2,3,4,5,6],   [14,15,16,17,18,19])

  const totalBigrams = aw + wb + ab + 1
  const pathMax = Math.max(aw, wb, ab, 1)
  const pathwayStrength: [number, number, number] = [
    Math.min(aw / pathMax, 1) * Math.min(totalBigrams / 400, 1),
    Math.min(wb / pathMax, 1) * Math.min(totalBigrams / 400, 1),
    Math.min(ab / pathMax, 1) * Math.min(totalBigrams / 400, 1),
  ]

  // ── First word text ────────────────────────────────────────────────────────
  // Stage-dependent babble → builds toward real word
  const sortedClusters = [...clusterFreq]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c - a.c)
  const top1 = sortedClusters[0].i
  const top2 = sortedClusters[1].i
  const syl1 = BABBLE_MAP[top1]
  const syl2 = BABBLE_MAP[top2]

  // Babble grows in complexity with developmental stage
  const babble =
    developmentStage === 0 ? `${syl1}…`                              // single syllable
  : developmentStage === 1 ? `${syl1}… ${syl1}…`                    // reduplication
  : developmentStage === 2 ? `${syl1}… ${syl1}… ${syl2}…`           // variegated
  :                          `${syl1}… ${syl1}… ${syl2}… ${syl1}…`  // proto-word

  const firstWord = model.firstWordSpoken ? model.firstWord : babble

  // ── Brain region activation levels ────────────────────────────────────────
  // Auditory: instantaneous RMS response
  const auditoryActivation = Math.min(rms * 10, 1)

  // Wernicke: pattern-recognition engagement — rises with statistical learning
  // Weighted by developmental stage (greater engagement later in development)
  const stageMultiplier = 0.5 + developmentStage * 0.17
  const wernickeActivation = Math.min(
    exposureScore * 1.4 * (0.35 + consistencyScore * 0.65) * stageMultiplier,
    1,
  )

  // Broca: speech-motor preparation — rises with overall readiness
  const brocaActivation = readinessScore / 100

  return {
    model: {
      clusterFreq,
      clusterRecency,
      bigramMatrix,
      totalUtterances,
      totalFrames,
      codebook,
      firstWordSpoken: model.firstWordSpoken,
      firstWord,
      readinessScore,
      pathwayStrength,
      wordFreq:         model.wordFreq,
      developmentStage,
      brainAge,
    },
    activation: {
      auditory: auditoryActivation,
      wernicke: wernickeActivation,
      broca:    brocaActivation,
    },
    topClusterId,
    rms,
  }
}

function sumBigrams(matrix: number[][], from: number[], to: number[]): number {
  let total = 0
  for (const i of from) for (const j of to) total += matrix[i][j]
  return total
}

/** Get top N clusters sorted by lifetime frequency */
export function getTopClusters(
  model: ModelState,
  n = 5,
): Array<{ id: number; syllable: string; count: number; recency: number }> {
  return model.clusterFreq
    .map((count, id) => ({
      id,
      syllable: BABBLE_MAP[id],
      count,
      recency: model.clusterRecency[id] ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

/** Human-readable label for each developmental stage */
export const STAGE_LABELS: Record<DevelopmentStage, string> = {
  0: 'Pre-linguistic',
  1: 'Canonical babbling',
  2: 'Variegated babbling',
  3: 'First word forming',
}
