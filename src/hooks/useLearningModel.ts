import { useCallback, useEffect, useRef } from 'react'
import { useBrainStore } from '../store/brainStore'
import { processUtterance, createInitialModel } from '../model/learningModel'
import { saveModel, loadModel } from '../model/persistence'
import { WordTracker } from '../audio/wordTracker'

export function useLearningModel() {
  const { model, setModel, setActivation, setFirstWordOverlay } = useBrainStore()
  const modelRef = useRef(model)
  modelRef.current = model

  // WordTracker lives for the lifetime of the hook
  const trackerRef = useRef<WordTracker | null>(null)
  if (!trackerRef.current) {
    trackerRef.current = new WordTracker((word, freq) => {
      // Update wordFreq in the store in real time as words are heard
      setModel({
        wordFreq: {
          ...modelRef.current.wordFreq,
          [word]: freq,
        },
      })
    })
  }

  // Load persisted model on mount
  useEffect(() => {
    loadModel().then((saved) => {
      if (saved) {
        setModel(saved)
        // Restore word frequencies into tracker
        if (saved.wordFreq) {
          trackerRef.current?.loadFrequencies(saved.wordFreq)
        }
      }
    })
  }, [setModel])

  /** Call when the mic button is pressed */
  const startRecording = useCallback(() => {
    trackerRef.current?.start()
  }, [])

  /** Call when the mic button is released */
  const stopRecording = useCallback(() => {
    trackerRef.current?.stop()
  }, [])

  const handleUtterance = useCallback(
    async (frames: number[][], rms: number) => {
      const current = modelRef.current

      // Include latest word frequencies from tracker into the model for this update
      const mergedWordFreq = {
        ...current.wordFreq,
        ...trackerRef.current?.exportFrequencies(),
      }

      const result = processUtterance(frames, rms, { ...current, wordFreq: mergedWordFreq })

      // Determine the first word:
      //  1. If SpeechRecognition picked up a dominant word → use it (it's a real word they said)
      //  2. Otherwise fall back to the syllable babble
      const topWord = trackerRef.current?.getTopWord()
      const firstWord = result.model.firstWordSpoken
        ? result.model.firstWord
        : topWord && topWord.count >= 5
          ? topWord.word                        // real word heard enough times
          : result.model.firstWord              // babble fallback

      const updatedModel = {
        ...result.model,
        firstWord,
        wordFreq: mergedWordFreq,
      }

      // Animate activation — fade in then out
      setActivation({
        auditory: result.activation.auditory,
        wernicke: result.activation.wernicke,
        broca: result.activation.broca,
      })

      setModel(updatedModel)
      await saveModel(updatedModel)

      // Check if first word threshold reached
      if (!current.firstWordSpoken && result.model.readinessScore >= 95) {
        const finalModel = { ...updatedModel, firstWordSpoken: true }
        setModel(finalModel)
        setFirstWordOverlay(true)
        await saveModel(finalModel)
        return
      }

      // Fade activation back after 1.5s
      setTimeout(() => {
        setActivation({ auditory: 0, wernicke: 0, broca: 0 })
      }, 1500)
    },
    [setModel, setActivation, setFirstWordOverlay],
  )

  const resetModel = useCallback(async () => {
    const fresh = createInitialModel()
    setModel(fresh)
    await saveModel(fresh)
  }, [setModel])

  /** Top words from the tracker — for the sidebar */
  const getTopWords = useCallback(
    () => trackerRef.current?.getTopWords(8, 2) ?? [],
    [],
  )

  const speechAvailable = trackerRef.current?.isAvailable ?? false

  return { handleUtterance, startRecording, stopRecording, resetModel, getTopWords, speechAvailable }
}
