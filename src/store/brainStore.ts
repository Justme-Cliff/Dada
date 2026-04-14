import { create } from 'zustand'

/** Developmental stage — mirrors real infant language acquisition */
export type DevelopmentStage =
  | 0  // Pre-linguistic: building acoustic inventory (0–30 utterances)
  | 1  // Canonical babbling: stable CV patterns form  (30–100 utterances)
  | 2  // Variegated babbling: complex sequences       (100–200 utterances)
  | 3  // First word: pattern threshold met            (200+ + score ≥ 95)

export interface ModelState {
  clusterFreq: number[]           // length 20, lifetime frame count per cluster
  clusterRecency: number[]        // length 20, exponentially-decayed recent weight
  bigramMatrix: number[][]        // 20×20 co-occurrence counts
  totalUtterances: number
  totalFrames: number             // cumulative MFCC frames processed
  codebook: number[][]            // 20 centroids × 13 MFCC dims
  firstWordSpoken: boolean
  firstWord: string
  readinessScore: number          // 0–100
  pathwayStrength: [number, number, number]  // Aud↔Wer, Wer↔Bro, Aud↔Bro, 0–1
  wordFreq: Record<string, number>           // recognized word → times heard
  developmentStage: DevelopmentStage
  brainAge: number                // 0–1, visual growth factor
}

export interface BrainActivation {
  auditory: number    // 0–1 instantaneous
  wernicke: number
  broca: number
  isListening: boolean
  isProcessing: boolean
}

export interface BrainStore {
  model: ModelState
  activation: BrainActivation
  sidebarOpen: boolean
  firstWordOverlay: boolean

  setModel: (m: Partial<ModelState>) => void
  setActivation: (a: Partial<BrainActivation>) => void
  setSidebarOpen: (open: boolean) => void
  setFirstWordOverlay: (show: boolean) => void
  resetActivation: () => void
}

const defaultModel: ModelState = {
  clusterFreq:    new Array(20).fill(0),
  clusterRecency: new Array(20).fill(0),
  bigramMatrix:   Array.from({ length: 20 }, () => new Array(20).fill(0)),
  totalUtterances: 0,
  totalFrames: 0,
  codebook: [],
  firstWordSpoken: false,
  firstWord: '',
  readinessScore: 0,
  pathwayStrength: [0, 0, 0],
  wordFreq: {},
  developmentStage: 0,
  brainAge: 0,
}

const defaultActivation: BrainActivation = {
  auditory: 0,
  wernicke: 0,
  broca: 0,
  isListening: false,
  isProcessing: false,
}

export const useBrainStore = create<BrainStore>((set) => ({
  model: defaultModel,
  activation: defaultActivation,
  sidebarOpen: false,
  firstWordOverlay: false,

  setModel: (m) => set((s) => ({ model: { ...s.model, ...m } })),
  setActivation: (a) => set((s) => ({ activation: { ...s.activation, ...a } })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setFirstWordOverlay: (show) => set({ firstWordOverlay: show }),
  resetActivation: () => set({ activation: defaultActivation }),
}))
