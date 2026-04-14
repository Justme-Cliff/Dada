import { motion, AnimatePresence } from 'framer-motion'
import { useBrainStore } from '../../store/brainStore'
import StatsPanel from './StatsPanel'

const SIDEBAR_WIDTH = 300

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useBrainStore()

  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-30 bg-black/50"
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
            className="fixed top-0 right-0 h-full z-40 overflow-y-auto"
            style={{ width: SIDEBAR_WIDTH }}
            initial={{ x: SIDEBAR_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: SIDEBAR_WIDTH }}
            transition={{ type: 'spring', stiffness: 320, damping: 38 }}
          >
            {/* Solid panel — no transparency bleed */}
            <div
              className="min-h-full px-6 pt-16 pb-12 flex flex-col"
              style={{
                background: '#0e0c1f',
                borderLeft: '1px solid rgba(139,92,246,0.18)',
                boxShadow: '-24px 0 80px rgba(99,102,241,0.07), inset 1px 0 0 rgba(255,255,255,0.04)',
              }}
            >
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
            className="fixed bottom-0 left-0 right-0 z-40 max-h-[80vh] overflow-y-auto rounded-t-3xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 38 }}
          >
            <div
              className="min-h-full px-6 pt-4 pb-12"
              style={{
                background: '#0e0c1f',
                borderTop: '1px solid rgba(139,92,246,0.18)',
                boxShadow: '0 -24px 80px rgba(99,102,241,0.08)',
              }}
            >
              {/* Drag handle */}
              <div className="w-10 h-1 bg-white/[0.12] rounded-full mx-auto mb-5" />
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
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-2.5">
        {/* Small pulsing indicator dot */}
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: '#8B5CF6', boxShadow: '0 0 6px #8B5CF6' }}
        />
        <span className="text-[10px] tracking-[0.28em] uppercase text-white/50 font-light">
          Neural Activity
        </span>
      </div>
      <button
        onClick={onClose}
        className="text-white/25 hover:text-white/60 transition-colors p-1.5 rounded-lg hover:bg-white/[0.05]"
        aria-label="Close sidebar"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <line x1="1" y1="1" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="1" x2="1" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
