/**
 * useAudio.ts — Microphone capture + VAD with cross-browser support.
 *
 * Audio processing strategy (in priority order):
 *   1. AudioWorklet  — Chrome 66+, Firefox 76+, Safari 14.1+, Edge 79+
 *      Runs in the audio rendering thread; no main-thread interference.
 *   2. ScriptProcessorNode (fallback) — all evergreen browsers + older Safari
 *      Deprecated but functional; keeps older browsers working.
 *
 * VAD (Voice Activity Detection):
 *   RMS threshold → tracks speech start → auto-flushes utterance after
 *   SILENCE_MS of quiet, as long as the segment is ≥ MIN_UTTERANCE_MS.
 */

import { useRef, useCallback, useEffect } from 'react'
import { extractMFCCs, computeRMS } from '../audio/mfcc'
import { useBrainStore } from '../store/brainStore'

const SAMPLE_RATE      = 44100
const VAD_THRESHOLD    = 0.003   // RMS level that counts as speech
const SILENCE_MS       = 900     // ms of silence before utterance is flushed
const MIN_UTTERANCE_MS = 200     // ignore very short noise bursts
const BLOCK_SIZE       = 2048    // samples per processing block

export function useAudio(onUtterance: (frames: number[][], rms: number) => void) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef       = useRef<MediaStream | null>(null)

  // AudioWorklet references
  const workletNodeRef    = useRef<AudioWorkletNode | null>(null)
  // ScriptProcessorNode fallback
  const processorRef      = useRef<ScriptProcessorNode | null>(null)

  // VAD state
  const utteranceFramesRef = useRef<number[][]>([])
  const utteranceRmsRef    = useRef<number[]>([])
  const silenceTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechStartTimeRef = useRef<number>(0)
  const isSpeakingRef      = useRef(false)

  const activeRef      = useRef(false)
  const setActivation  = useBrainStore((s) => s.setActivation)

  // Ref so processBlock always calls the latest flushUtterance (avoids stale closure)
  const flushUtteranceRef = useRef<(() => void) | null>(null)

  // ── VAD processing — shared between worklet and ScriptProcessor paths ──────
  const processBlock = useCallback((buffer: Float32Array) => {
    if (!activeRef.current) return

    const rms = computeRMS(buffer)
    setActivation({ auditory: Math.min(rms * 12, 1) })

    if (rms > VAD_THRESHOLD) {
      if (!isSpeakingRef.current) {
        isSpeakingRef.current = true
        speechStartTimeRef.current = Date.now()
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      const frames = extractMFCCs(buffer, SAMPLE_RATE)
      utteranceFramesRef.current.push(...frames)
      utteranceRmsRef.current.push(rms)
    } else if (isSpeakingRef.current && !silenceTimerRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        silenceTimerRef.current = null
        flushUtteranceRef.current?.()
        setActivation({ auditory: 0 })
      }, SILENCE_MS)
    }
  }, [setActivation])

  const flushUtterance = useCallback(() => {
    const frames    = utteranceFramesRef.current
    const rmsValues = utteranceRmsRef.current
    utteranceFramesRef.current = []
    utteranceRmsRef.current    = []
    isSpeakingRef.current      = false

    const duration = Date.now() - speechStartTimeRef.current
    if (frames.length === 0 || duration < MIN_UTTERANCE_MS) {
      // Still count the session even if frames are empty (updates utterance stats)
      onUtterance([], 0)
      return
    }

    const avgRms = rmsValues.length > 0
      ? rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length
      : 0

    setActivation({ isProcessing: true })
    setTimeout(() => {
      onUtterance(frames, avgRms)
      setActivation({ isProcessing: false })
    }, 30)
  }, [onUtterance, setActivation])

  // Keep ref in sync so processBlock always calls the latest version
  flushUtteranceRef.current = flushUtterance

  // ── Init AudioContext (must be inside a user-gesture handler) ──────────────
  const initAudio = useCallback(async () => {
    if (audioContextRef.current) {
      // Safari / iOS: AudioContext may be suspended after page load
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      return
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    streamRef.current = stream

    // Safari needs `webkitAudioContext` fallback (very old Safari only)
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) throw new Error('Web Audio API not supported')

    const ctx = new AudioContextCtor({ sampleRate: SAMPLE_RATE })
    audioContextRef.current = ctx

    const source = ctx.createMediaStreamSource(stream)

    // ── Try AudioWorklet first ───────────────────────────────────────────────
    let workletLoaded = false
    if (ctx.audioWorklet) {
      try {
        await ctx.audioWorklet.addModule('/mfcc-processor.js')
        const workletNode = new AudioWorkletNode(ctx, 'mfcc-processor')
        workletNodeRef.current = workletNode

        workletNode.port.onmessage = (e: MessageEvent) => {
          if (e.data?.type === 'block') {
            processBlock(new Float32Array(e.data.samples))
          }
        }

        source.connect(workletNode)
        workletNode.connect(ctx.destination)
        workletLoaded = true
      } catch (err) {
        console.warn('[useAudio] AudioWorklet failed, falling back to ScriptProcessorNode:', err)
      }
    }

    // ── ScriptProcessorNode fallback ─────────────────────────────────────────
    if (!workletLoaded) {
      const processor = ctx.createScriptProcessor(BLOCK_SIZE, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        processBlock(e.inputBuffer.getChannelData(0))
      }

      source.connect(processor)
      processor.connect(ctx.destination)
    }
  }, [processBlock])

  const startListening = useCallback(async () => {
    await initAudio()
    activeRef.current              = true
    utteranceFramesRef.current     = []
    utteranceRmsRef.current        = []
    isSpeakingRef.current          = false

    // Signal worklet to start (if present)
    workletNodeRef.current?.port.postMessage('start')

    setActivation({ isListening: true, auditory: 0 })
  }, [initAudio, setActivation])

  const stopListening = useCallback(() => {
    activeRef.current = false

    // Signal worklet to stop
    workletNodeRef.current?.port.postMessage('stop')

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    if (utteranceFramesRef.current.length > 0) {
      flushUtterance()
    }

    setActivation({ isListening: false, auditory: 0 })
  }, [flushUtterance, setActivation])

  useEffect(() => {
    return () => {
      activeRef.current = false
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      workletNodeRef.current?.disconnect()
      processorRef.current?.disconnect()
      audioContextRef.current?.close()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { startListening, stopListening }
}
