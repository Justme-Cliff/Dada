/**
 * WordTracker — cross-browser speech recognition.
 *
 * Uses the Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * Browser support:
 *   Chrome / Edge: full support via SpeechRecognition
 *   Safari 14.1+:  support via webkitSpeechRecognition
 *   Firefox:       not supported (graceful fallback — MFCC patterns still work)
 *
 * Safari quirk: continuous=true is unreliable. We use continuous=false and
 * restart after each result, which works reliably across all webkit browsers.
 */

// ── SpeechRecognition type declarations (not in standard TS lib) ──────────────
interface SRResult {
  readonly [index: number]: { readonly transcript: string }
  readonly isFinal: boolean
  readonly length: number
}
interface SRResultList {
  readonly [index: number]: SRResult
  readonly length: number
}
interface SREvent extends Event {
  readonly resultIndex: number
  readonly results: SRResultList
}
interface SRErrorEvent extends Event { readonly error: string }
interface SRInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: SRErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SRCtor = new () => SRInstance

declare global {
  interface Window {
    SpeechRecognition?: SRCtor
    webkitSpeechRecognition?: SRCtor
  }
}

// ── Stop words — too common to be meaningful ──────────────────────────────────
const STOPWORDS = new Set([
  'the','a','an','and','or','but','is','it','i','to','of','in','on','at','for',
  'with','that','this','um','uh','like','so','oh','ah','okay','ok','yeah','yes',
  'no','hey','hi','you','me','my','he','she','we','they','do','did','are','was',
  'be','been','have','has','had','will','can','just','its','im','if','what',
  'how','when','where','who',
])

type WordCallback = (word: string, freq: number) => void

export class WordTracker {
  private SR: SRCtor | null = null
  private recognition: SRInstance | null = null
  private wordFreq = new Map<string, number>()
  private onWordDetected: WordCallback
  private running = false
  readonly isAvailable: boolean

  constructor(onWordDetected: WordCallback) {
    this.onWordDetected = onWordDetected
    this.SR = window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
    this.isAvailable = this.SR !== null
    if (this.SR) this.buildRecognition()
  }

  private buildRecognition() {
    if (!this.SR) return
    const r = new this.SR()

    // ── Use non-continuous mode for maximum Safari compatibility ─────────────
    // Each segment runs, fires onresult, then fires onend.
    // onend auto-restarts while this.running = true.
    r.continuous = false
    r.interimResults = false
    r.lang = 'en-US'
    r.maxAlternatives = 1

    r.onresult = (e: SREvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue
        const transcript = e.results[i][0].transcript.toLowerCase().trim()
        const words = transcript
          .replace(/[^a-z\s'-]/g, '')
          .split(/\s+/)
          .filter((w: string) => w.length >= 2 && !STOPWORDS.has(w))

        for (const word of words) {
          const next = (this.wordFreq.get(word) ?? 0) + 1
          this.wordFreq.set(word, next)
          this.onWordDetected(word, next)
        }
      }
    }

    r.onerror = (e: SRErrorEvent) => {
      // 'no-speech' and 'aborted' are normal — don't log
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[WordTracker] error:', e.error)
      }
    }

    r.onend = () => {
      // Auto-restart while active — handles the non-continuous mode loop
      if (!this.running) return
      try { r.start() } catch (_) {
        // Brief delay before retry if start throws (e.g. mic not ready yet)
        setTimeout(() => { if (this.running) try { r.start() } catch (_) {/* ignore */} }, 200)
      }
    }

    this.recognition = r
  }

  start(): void {
    if (!this.SR || this.running) return
    this.running = true
    // Rebuild recognition object for a clean start (avoids Safari state issues)
    this.buildRecognition()
    try { this.recognition?.start() } catch (_) {/* ignore — will auto-start via onend */}
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    try { this.recognition?.abort() } catch (_) {/* ignore */}
  }

  loadFrequencies(freq: Record<string, number>): void {
    this.wordFreq = new Map(Object.entries(freq))
  }

  exportFrequencies(): Record<string, number> {
    return Object.fromEntries(this.wordFreq)
  }

  getTopWords(n = 8, minCount = 2): Array<{ word: string; count: number }> {
    return Array.from(this.wordFreq.entries())
      .filter(([, c]) => c >= minCount)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n)
  }

  getTopWord(): { word: string; count: number } | null {
    return this.getTopWords(1, 3)[0] ?? null
  }

  getTotalUniqueWords(): number { return this.wordFreq.size }
}
