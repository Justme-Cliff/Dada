import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { useBrainStore } from '../../store/brainStore'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { initSound } from '../../audio/soundDesign'

export default function BabyVoiceButton() {
  const model = useBrainStore((s) => s.model)
  const { speak } = useSpeechSynthesis()

  const handleClick = useCallback(async () => {
    await initSound()
    const text = model.firstWord || 'da…'
    speak(text)
  }, [model.firstWord, speak])

  const hasWord = model.firstWord && model.firstWord.length > 0

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Label */}
      <span className="text-xs tracking-[0.2em] uppercase text-white/20 font-light">
        baby speak
      </span>

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
            borderColor: hasWord
              ? 'rgba(245,158,11,0.6)'
              : 'rgba(255,255,255,0.12)',
            boxShadow: hasWord
              ? '0 0 20px rgba(245,158,11,0.25)'
              : '0 0 0px transparent',
          }}
          transition={{ duration: 0.4 }}
        />

        {/* Inner fill */}
        <motion.div
          className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center"
          animate={{
            backgroundColor: hasWord
              ? 'rgba(245,158,11,0.12)'
              : 'rgba(255,255,255,0.04)',
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Mouth / speech icon */}
          <motion.svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            animate={{ opacity: hasWord ? 0.75 : 0.35 }}
            transition={{ duration: 0.3 }}
          >
            {/* Simple mouth shape */}
            <path
              d="M7 10 Q12 16 17 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Sound waves */}
            <path
              d="M19 7 Q21.5 10 19 13"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
            <path
              d="M5 7 Q2.5 10 5 13"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
          </motion.svg>
        </motion.div>
      </motion.button>
    </div>
  )
}
