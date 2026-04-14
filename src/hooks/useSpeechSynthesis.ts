import { useCallback } from 'react'

export function useSpeechSynthesis() {
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.55
    utterance.pitch = 1.5
    utterance.volume = 1.0

    // Try to pick a soft/female voice
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(
      (v) =>
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('karen') ||
        v.name.toLowerCase().includes('victoria') ||
        v.name.toLowerCase().includes('female') ||
        v.lang === 'en-US',
    )
    if (preferred) utterance.voice = preferred

    window.speechSynthesis.speak(utterance)
  }, [])

  return { speak }
}
