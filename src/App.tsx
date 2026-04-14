import { useCallback } from 'react'
import BrainScene from './components/Brain/BrainScene'
import MicButton from './components/UI/MicButton'
import BabyVoiceButton from './components/UI/BabyVoiceButton'
import Sidebar from './components/UI/Sidebar'
import SidebarToggle from './components/UI/SidebarToggle'
import FirstWordOverlay from './components/FirstWordOverlay'
import { useAudio } from './hooks/useAudio'
import { useLearningModel } from './hooks/useLearningModel'
import { triggerNeuralCrackle } from './audio/soundDesign'
import { useBrainStore } from './store/brainStore'

export default function App() {
  const { handleUtterance, startRecording, stopRecording } = useLearningModel()
  const activation = useBrainStore((s) => s.activation)

  const onUtterance = useCallback(
    (frames: number[][], rms: number) => {
      handleUtterance(frames, rms)
      if (rms > 0.02) {
        setTimeout(() => triggerNeuralCrackle('auditory', Math.min(rms * 5, 1)), 50)
        setTimeout(() => triggerNeuralCrackle('wernicke', 0.4), 300)
        if (activation.broca > 0.3) {
          setTimeout(() => triggerNeuralCrackle('broca', activation.broca), 600)
        }
      }
    },
    [handleUtterance, activation.broca],
  )

  const { startListening, stopListening } = useAudio(onUtterance)

  const handleStart = useCallback(() => {
    startListening()
    startRecording()   // also start SpeechRecognition
  }, [startListening, startRecording])

  const handleStop = useCallback(() => {
    stopListening()
    stopRecording()    // also stop SpeechRecognition
  }, [stopListening, stopRecording])

  return (
    <div className="w-full h-full bg-[#080808] overflow-hidden">
      <BrainScene />

      {/* Wordmark */}
      <div className="fixed top-6 left-6 z-20 pointer-events-none select-none">
        <span className="text-sm font-light tracking-[0.35em] uppercase text-white/20">
          dada
        </span>
      </div>

      {/* Region legend */}
      <div className="fixed top-6 right-16 z-20 flex flex-col gap-1.5 pointer-events-none select-none">
        {[
          { label: 'Auditory', color: '#3B82F6' },
          { label: "Wernicke's", color: '#10B981' },
          { label: "Broca's", color: '#F59E0B' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
            <span className="text-[9px] tracking-widest uppercase text-white/20">{label}</span>
          </div>
        ))}
      </div>

      <SidebarToggle />
      <Sidebar />

      {/* Bottom controls: mic + baby voice side by side */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-end gap-8">
        <MicButton onStart={handleStart} onStop={handleStop} />
        <BabyVoiceButton />
      </div>

      <FirstWordOverlay />
    </div>
  )
}
