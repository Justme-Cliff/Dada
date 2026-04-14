import { motion, AnimatePresence } from 'framer-motion'
import { useBrainStore } from '../../store/brainStore'
import StatsPanel from './StatsPanel'

const SIDEBAR_WIDTH = 280

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useBrainStore()

  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <>
      {/* Backdrop on mobile */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-30 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Desktop: slide from right */}
      <AnimatePresence>
        {sidebarOpen && !isMobile && (
          <motion.aside
            key="sidebar-desktop"
            className="fixed top-0 right-0 h-full z-30 overflow-y-auto"
            style={{ width: SIDEBAR_WIDTH }}
            initial={{ x: SIDEBAR_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: SIDEBAR_WIDTH }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
          >
            <div className="h-full bg-white/[0.03] backdrop-blur-xl border-l border-white/[0.06] px-6 pt-16 pb-12">
              <SidebarHeader onClose={() => setSidebarOpen(false)} />
              <StatsPanel />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile: slide from bottom */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.aside
            key="sidebar-mobile"
            className="fixed bottom-0 left-0 right-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
          >
            <div className="bg-[#0e0e18] border-t border-white/[0.07] px-6 pt-5 pb-12">
              {/* Drag handle */}
              <div className="w-10 h-0.5 bg-white/10 rounded-full mx-auto mb-5" />
              <SidebarHeader onClose={() => setSidebarOpen(false)} />
              <StatsPanel />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

function SidebarHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-7">
      <span className="text-[10px] tracking-[0.25em] uppercase text-white/30">
        Learning Stats
      </span>
      <button
        onClick={onClose}
        className="text-white/20 hover:text-white/50 transition-colors p-1"
        aria-label="Close sidebar"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
