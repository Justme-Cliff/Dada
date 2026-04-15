import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBrainStore } from '../../store/brainStore'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { initSound } from '../../audio/soundDesign'

export default function BabyVoiceButton() {
  const model = useBrainStore((s) => s.model)
  const { speak } = useSpeechSynthesis()

  // Clean up display text for TTS — strip ellipsis, make it speakable
  const speakText = (model.firstWord || 'ah')
    .replace(/…/g, '')
    .replace(/-/g, ' ')
    .trim()

  // Display text shown on the button — the raw firstWord
  const displayWord = model.firstWord || 'ah…'

  // Once a real word approximation appears (no ellipsis), glow amber
  const hasWordAttempt = model.firstWord && !model.firstWord.includes('…')

  const handleClick = useCallback(async () => {
    await initSound()
    speak(speakText)
  }, [speakText, speak])

  return (
    <div className="flex flex-col items-center gap-2">

      {/* Label */}
      <span className="text-[9px] tracking-[0.2em] uppercase text-white/20 font-light">
        baby speak
      </span>

      {/* Current word the baby is trying to say */}
      <AnimatePresence mode="wait">
        <motion.span
          key={displayWord}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.4 }}
          className="text-[11px] font-light tracking-wider text-center max-w-[90px] truncate"
          style={{ color: hasWordAttempt ? 'rgba(245,158,11,0.7)' : 'rgba(255,255,255,0.22)' }}
        >
          {displayWord}
        </motion.span>
      </AnimatePresence>

      {/* Button */}
      <motion.button
        className="relative w-16 h-16 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center select-none focus:outline-none"
        onClick={handleClick}
        whileTap={{ scale: 0.93 }}
        aria-label="Make baby speak"
      >
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border"
          animate={{
            borderColor: hasWordAttempt
              ? 'rgba(245,158,11,0.55)'
              : 'rgba(255,255,255,0.12)',
            boxShadow: hasWordAttempt
              ? '0 0 22px rgba(245,158,11,0.2)'
              : '0 0 0px transparent',
          }}
          transition={{ duration: 0.4 }}
        />

        {/* Pulse when word attempt exists */}
        <AnimatePresence>
          {hasWordAttempt && (
            <motion.div
              key="pulse"
              className="absolute inset-0 rounded-full border border-amber-400/20"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.65, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        {/* Inner fill */}
        <motion.div
          className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center"
          animate={{
            backgroundColor: hasWordAttempt
              ? 'rgba(245,158,11,0.12)'
              : 'rgba(255,255,255,0.04)',
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Baby mouth / speech icon */}
          <motion.svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            animate={{ opacity: hasWordAttempt ? 0.8 : 0.35 }}
            transition={{ duration: 0.3 }}
          >
            {/* Mouth */}
            <path
              d="M7 10 Q12 16 17 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Sound waves */}
            <path
              d="M19.5 7 Q22 10 19.5 13"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
              opacity="0.55"
            />
            <path
              d="M4.5 7 Q2 10 4.5 13"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
              opacity="0.55"
            />
          </motion.svg>
        </motion.div>
      </motion.button>
    </div>
  )
}
