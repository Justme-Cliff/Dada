/**
 * Online k-means phoneme clustering with k-means++ initialization.
 *
 * The codebook starts random but self-organizes as more audio comes in.
 * Each MFCC frame is assigned to the nearest centroid, which then moves
 * slightly toward that frame. Over time centroids converge to represent
 * the actual phoneme-like units in the user's speech.
 */

export const K = 20
const MFCC_DIMS = 13

// Online learning rate: starts higher for faster initial adaptation,
// decays slowly so the model stabilizes over time
const INITIAL_LR = 0.08
const MIN_LR = 0.005
const LR_DECAY = 0.9998  // per frame processed

// Track total frames processed (for learning rate decay)
let totalFramesProcessed = 0

/** Euclidean distance squared (faster than sqrt for comparison) */
function distSq(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return sum
}

/** Euclidean distance */
function dist(a: number[], b: number[]): number {
  return Math.sqrt(distSq(a, b))
}

/**
 * k-means++ initialization.
 * Seeds centroids by preferentially choosing points that are far from
 * already-chosen centroids. This gives dramatically better initial
 * codebook quality vs random initialization.
 */
export function initCodebook(seedFrames?: number[][]): number[][] {
  if (!seedFrames || seedFrames.length < K) {
    // No seed data yet — use random initialization
    return Array.from({ length: K }, () =>
      Array.from({ length: MFCC_DIMS }, () => (Math.random() - 0.5) * 8),
    )
  }

  // k-means++ seeding
  const centroids: number[][] = []

  // First centroid: random
  centroids.push([...seedFrames[Math.floor(Math.random() * seedFrames.length)]])

  // Remaining centroids: weighted by distance to nearest existing centroid
  for (let k = 1; k < K; k++) {
    const dists = seedFrames.map((frame) => {
      const minD = Math.min(...centroids.map((c) => distSq(frame, c)))
      return minD
    })
    const totalDist = dists.reduce((a, b) => a + b, 0)
    let r = Math.random() * totalDist
    let chosen = seedFrames[seedFrames.length - 1]
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i]
      if (r <= 0) { chosen = seedFrames[i]; break }
    }
    centroids.push([...chosen])
  }

  return centroids
}

/** Find nearest centroid — returns cluster ID */
export function assignCluster(mfcc: number[], codebook: number[][]): number {
  let best = 0
  let bestDist = Infinity
  for (let k = 0; k < codebook.length; k++) {
    const d = distSq(mfcc, codebook[k])
    if (d < bestDist) { bestDist = d; best = k }
  }
  return best
}

/** Online k-means update: move the winning centroid toward the new vector */
function updateCodebook(mfcc: number[], clusterId: number, codebook: number[][]): number[][] {
  const lr = Math.max(INITIAL_LR * Math.pow(LR_DECAY, totalFramesProcessed), MIN_LR)
  return codebook.map((c, k) => {
    if (k !== clusterId) return c
    return c.map((v, i) => v + lr * (mfcc[i] - v))
  })
}

/**
 * Process an array of MFCC frames.
 * Returns: sequence of cluster IDs, updated codebook, avg quantization error.
 */
export function processFrames(
  frames: number[][],
  codebook: number[][],
): { sequence: number[]; codebook: number[][]; avgError: number } {
  let cb = codebook
  const sequence: number[] = []
  let totalError = 0

  for (const mfcc of frames) {
    const id = assignCluster(mfcc, cb)
    totalError += dist(mfcc, cb[id])
    cb = updateCodebook(mfcc, id, cb)
    sequence.push(id)
    totalFramesProcessed++
  }

  return {
    sequence,
    codebook: cb,
    avgError: frames.length > 0 ? totalError / frames.length : 0,
  }
}

/** Reset frame counter (e.g., when model is reset) */
export function resetFrameCounter(): void {
  totalFramesProcessed = 0
}

