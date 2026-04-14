import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBrainStore } from '../store/brainStore'
import { triggerFirstWordChime } from '../audio/soundDesign'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'

export default function FirstWordOverlay() {
  const { firstWordOverlay, setFirstWordOverlay, model } = useBrainStore()
  const { speak } = useSpeechSynthesis()
  const hasFired = useRef(false)

  useEffect(() => {
    if (firstWordOverlay && !hasFired.current) {
      hasFired.current = true
      // Small delay for drama
      setTimeout(() => {
        triggerFirstWordChime()
        speak(model.firstWord)
      }, 800)
    }
  }, [firstWordOverlay, model.firstWord, speak])

  return (
    <AnimatePresence>
      {firstWordOverlay && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'radial-gradient(ellipse at center, rgba(8,8,20,0.97) 0%, rgba(4,4,12,0.99) 100%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          onClick={() => setFirstWordOverlay(false)}
        >
          {/* Particle burst — CSS-based rings */}
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-amber-400/20"
              initial={{ width: 0, height: 0, opacity: 0.6 }}
              animate={{ width: 600 * i, height: 600 * i, opacity: 0 }}
              transition={{ delay: 0.6 + i * 0.3, duration: 2.5, ease: 'easeOut' }}
            />
          ))}

          <motion.div
            className="text-center px-8"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[11px] tracking-[0.3em] uppercase text-amber-400/50 mb-6 font-light">
              first word
            </p>
            <p
              className="text-6xl md:text-8xl font-thin tracking-widest text-white/90"
              style={{ textShadow: '0 0 60px rgba(245,158,11,0.25), 0 0 20px rgba(245,158,11,0.15)' }}
            >
              {model.firstWord}
            </p>
            <motion.p
              className="mt-10 text-xs text-white/15 tracking-[0.2em]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
            >
              tap to continue
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
