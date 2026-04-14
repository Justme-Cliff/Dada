import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBrainStore } from '../../store/brainStore'
import { initSound, triggerNeuralCrackle } from '../../audio/soundDesign'

interface MicButtonProps {
  onStart: () => void
  onStop: () => void
}

export default function MicButton({ onStart, onStop }: MicButtonProps) {
  const activation = useBrainStore((s) => s.activation)
  const isListening = activation.isListening
  const isProcessing = activation.isProcessing

  const handleClick = useCallback(async () => {
    await initSound()
    if (isListening) {
      onStop()
      triggerNeuralCrackle('auditory', 0.4)
    } else {
      onStart()
    }
  }, [isListening, onStart, onStop])

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">

      {/* Status label */}
      <AnimatePresence mode="wait">
        {isListening && (
          <motion.span key="on"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="text-xs tracking-[0.2em] uppercase text-white/40 font-light"
          >
            listening
          </motion.span>
        )}
        {isProcessing && !isListening && (
          <motion.span key="proc"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="text-xs tracking-[0.2em] uppercase text-white/30 font-light"
          >
            processing
          </motion.span>
        )}
        {!isListening && !isProcessing && (
          <motion.span key="idle"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-xs tracking-[0.2em] uppercase text-white/20 font-light"
          >
            tap to speak
          </motion.span>
        )}
      </AnimatePresence>

      {/* Button */}
      <motion.button
        className="relative w-16 h-16 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center select-none focus:outline-none"
        onClick={handleClick}
        whileTap={{ scale: 0.93 }}
        aria-label={isListening ? 'Stop listening' : 'Start listening'}
      >
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border"
          animate={{
            borderColor: isListening ? 'rgba(59,130,246,0.85)' : 'rgba(255,255,255,0.12)',
            boxShadow: isListening
              ? '0 0 28px rgba(59,130,246,0.45), 0 0 10px rgba(59,130,246,0.3)'
              : '0 0 0px transparent',
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Outer pulse ring when listening */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              key="pulse"
              className="absolute inset-0 rounded-full border border-blue-400/25"
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 1.7, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        {/* Second slower pulse */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              key="pulse2"
              className="absolute inset-0 rounded-full border border-blue-400/15"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
            />
          )}
        </AnimatePresence>

        {/* Inner fill */}
        <motion.div
          className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center"
          animate={{
            backgroundColor: isListening ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
          }}
          transition={{ duration: 0.25 }}
        >
          {/* Mic icon — morphs to stop square when active */}
          <AnimatePresence mode="wait">
            {isListening ? (
              <motion.svg key="stop" width="18" height="18" viewBox="0 0 18 18" fill="none"
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
              >
                <rect x="3" y="3" width="12" height="12" rx="2.5" fill="rgba(59,130,246,0.9)" />
              </motion.svg>
            ) : (
              <motion.svg key="mic" width="22" height="22" viewBox="0 0 24 24" fill="none"
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 0.55, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
              >
                <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.button>
    </div>
  )
}
