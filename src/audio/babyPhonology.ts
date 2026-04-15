/**
 * babyPhonology.ts — Derives baby speech sounds from MFCC centroids.
 *
 * The key difference from a static lookup table (like the old BABBLE_MAP):
 * each cluster's sound is determined by its centroid's position RELATIVE
 * to all other centroids in the codebook. So the same cluster ID can
 * produce a different sound for different speakers as the k-means model
 * adapts to their actual voice.
 *
 * Acoustic basis:
 *   MFCC c1 ≈ spectral tilt / F1 proxy  →  vowel height (high/low)
 *   MFCC c2 ≈ F2-F1 balance              →  vowel frontness (front/back)
 *   MFCC c3-c5 ≈ fine spectral shape     →  consonant place & manner
 *
 * We use PERCENTILE ranking within the codebook rather than absolute
 * thresholds, so it works regardless of microphone level or recording
 * environment.
 */

// ── Consonant inventory by developmental stage ────────────────────────────────
// Mirrors real acquisition order:
//   Stage 0: no consonants (pre-linguistic — just vowels/cries)
//   Stage 1: bilabials + alveolar (m, b, d, n) — first true babble
//   Stage 2: more variety added
//   Stage 3: richer inventory, approaching first word
const CONSONANT_POOL: readonly (readonly string[])[] = [
  [],
  ['m', 'b', 'd', 'n'],
  ['m', 'b', 'd', 'n', 'g', 'p', 'w'],
  ['m', 'b', 'd', 'n', 'g', 'p', 'w', 'l', 'h', 't'],
]

/**
 * Derive a baby syllable for a cluster based on where its centroid sits
 * in acoustic space relative to the rest of the codebook.
 * Returns a string like "ba", "ee", "moh", "dah", etc.
 */
export function getSyllableForCluster(
  clusterId: number,
  codebook: number[][],
  stage: number,
): string {
  if (!codebook || codebook.length === 0) return 'ah'
  const c = codebook[clusterId]
  if (!c || c.length < 6) return 'ah'

  const n = codebook.length

  // Percentile rank for each acoustic dimension (0 = lowest, 1 = highest)
  const rank = (dim: number) =>
    codebook.filter((o) => (o[dim] ?? 0) < (c[dim] ?? 0)).length / n

  const c1r = rank(1)  // spectral tilt:  low = bright/front, high = dark/back
  const c2r = rank(2)  // F2 proxy:       high = front vowel, low = back vowel
  const c3r = rank(3)  // place:          high = bilabial, low = velar
  const c4r = rank(4)  // manner:         high = voiced stop, low = voiceless
  const c5r = rank(5)  // nasality:       high = nasal resonance

  // ── Map to vowel ──────────────────────────────────────────────────────────
  // Vowel quadrant: c1r (height) × c2r (frontness)
  let vowel: string
  if      (c1r < 0.25 && c2r > 0.70) vowel = 'ee'   // high front  [iː]
  else if (c1r < 0.40 && c2r > 0.55) vowel = 'ay'   // mid front   [eɪ]
  else if (c1r > 0.70 && c2r > 0.55) vowel = 'ah'   // low central [ɑ]
  else if (c1r > 0.65 && c2r < 0.45) vowel = 'oh'   // mid back    [oʊ]
  else if (c1r < 0.30 && c2r < 0.30) vowel = 'oo'   // high back   [uː]
  else if (c2r > 0.60)                vowel = 'ay'
  else if (c2r < 0.35)                vowel = 'oh'
  else                                vowel = 'ah'   // central / schwa

  // ── Map to consonant ──────────────────────────────────────────────────────
  const pool = CONSONANT_POOL[Math.min(stage, 3)] as string[]
  if (pool.length === 0) return vowel  // stage 0: pure vowel

  const has = (x: string) => pool.includes(x)
  let consonant: string

  if (c5r > 0.72) {
    // Nasal resonance dominant
    consonant = c3r > 0.5 ? (has('m') ? 'm' : 'n') : (has('n') ? 'n' : 'm')
  } else if (c4r > 0.78 || c4r < 0.22) {
    // Glide-like manner
    consonant = has('w') ? 'w' : (has('l') ? 'l' : pool[0])
  } else if (c3r > 0.70) {
    // Bilabial place
    consonant = c4r > 0.5 ? (has('b') ? 'b' : 'm') : (has('p') ? 'p' : 'm')
  } else if (c3r < 0.30) {
    // Velar place
    consonant = has('g') ? 'g' : (has('d') ? 'd' : pool[0])
  } else {
    // Alveolar place (default)
    consonant = c4r > 0.5 ? (has('d') ? 'd' : 'n') : (has('t') ? 't' : 'd')
  }

  return consonant + vowel
}

/**
 * Build stage-appropriate babble from the top cluster syllables.
 * Complexity grows with developmental stage — matches real infant output.
 */
export function generateBabble(syllables: string[], stage: number): string {
  if (syllables.length === 0) return 'ah…'
  const [s1 = 'ah', s2 = s1, s3 = s1] = syllables

  switch (stage) {
    case 0:  return `${s1}…`                          // single vowel-like sound
    case 1:  return `${s1}… ${s1}…`                  // reduplication (da da)
    case 2:  return `${s1}-${s2}… ${s1}…`            // variegated (ba-dee ba)
    default: return `${s1}-${s2}… ${s3}-${s1}…`      // proto-word
  }
}

// ── Baby word approximation ──────────────────────────────────────────────────

/**
 * Real phonological processes babies use:
 *   Gliding:    r, l → w           ("red" → "wed", "love" → "wuv")
 *   Stopping:   f, v → p, b        ("fish" → "pish")
 *   Fronting:   s, z, sh, ch → d   ("see" → "dee")
 *   TH-stop:    th → d             ("the" → "duh")
 *   Reduction:  consonant clusters simplified
 */
const CONSONANT_SUBS: Record<string, string> = {
  r: 'w', l: 'w',
  f: 'p', v: 'b',
  s: 'd', z: 'd',
  j: 'd', x: 'g', q: 'g',
}
const DIGRAPH_SUBS: Record<string, string> = {
  th: 'd', sh: 'd', ch: 'd', wh: 'w', ph: 'p', gh: 'g',
}

const VOWEL_SET = new Set(['a', 'e', 'i', 'o', 'u'])

/**
 * Turn a real word into what a baby at the given stage would say.
 *
 * "mama"   stage 1  →  "mah-mah"
 * "daddy"  stage 1  →  "dah-dee"
 * "hello"  stage 2  →  "heh-oh"
 * "bottle" stage 2  →  "bah-doh"
 * "water"  stage 2  →  "wah-dah"
 * "cookie" stage 3  →  "doo-dee"
 */
export function babyApproximate(word: string, stage: number): string {
  if (!word) return 'ah'
  const available = new Set(CONSONANT_POOL[Math.min(stage, 3)] as string[])
  const letters = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!letters) return 'ah'

  // Build phoneme sequence
  const phones: string[] = []
  let i = 0
  while (i < letters.length) {
    // Check digraphs first
    const di = letters.slice(i, i + 2)
    if (DIGRAPH_SUBS[di]) {
      let sub = DIGRAPH_SUBS[di]
      if (!available.has(sub)) sub = [...available][0] ?? 'd'
      phones.push(sub)
      i += 2
      continue
    }

    const ch = letters[i]
    if (VOWEL_SET.has(ch)) {
      const v = ({ a: 'ah', e: 'eh', i: 'ee', o: 'oh', u: 'oo' } as Record<string, string>)[ch]
      phones.push(v)
    } else {
      let sub = CONSONANT_SUBS[ch] ?? ch
      if (!available.has(sub)) {
        // Replace with closest available consonant (bilabial preferred)
        sub = available.has('b') ? 'b' : available.has('d') ? 'd' : ([...available][0] ?? 'd')
      }
      phones.push(sub)
    }
    i++
  }

  // Group into CV syllables — babies favour canonical CV structure
  const maxSyls = stage === 0 ? 1 : stage === 1 ? 2 : 3
  const syllables: string[] = []
  let j = 0

  while (j < phones.length && syllables.length < maxSyls) {
    const p = phones[j]
    const isVowelP = p.length > 1 || VOWEL_SET.has(p)

    if (isVowelP) {
      // Bare vowel syllable
      syllables.push(p)
      j++
    } else if (j + 1 < phones.length) {
      const next = phones[j + 1]
      const nextIsVowel = next.length > 1 || VOWEL_SET.has(next)
      if (nextIsVowel) {
        syllables.push(p + next)  // CV syllable
        j += 2
      } else {
        j++  // skip consonant cluster, try next
      }
    } else {
      j++  // trailing consonant — drop
    }
  }

  return syllables.length > 0 ? syllables.join('-') : letters.slice(0, 4)
}
