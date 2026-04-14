import { motion } from 'framer-motion'
import { useBrainStore } from '../../store/brainStore'

export default function SidebarToggle() {
  const { sidebarOpen, setSidebarOpen } = useBrainStore()

  return (
    <motion.button
      onClick={() => setSidebarOpen(!sidebarOpen)}
      className="fixed top-6 right-6 z-50 w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-full focus:outline-none"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        opacity: sidebarOpen ? 0.8 : 0.4,
      }}
      aria-label="Toggle stats panel"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block bg-white rounded-full"
          animate={{
            width: i === 1 ? (sidebarOpen ? 10 : 16) : 16,
            height: 1.5,
            opacity: sidebarOpen ? 0.6 : 0.4,
          }}
          transition={{ duration: 0.2 }}
        />
      ))}
    </motion.button>
  )
}
