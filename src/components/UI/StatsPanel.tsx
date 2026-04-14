import { motion } from 'framer-motion'
import { useBrainStore } from '../../store/brainStore'
import { getTopClusters, STAGE_LABELS } from '../../model/learningModel'

function getTopWords(wordFreq: Record<string, number>, n = 6) {
  return Object.entries(wordFreq)
    .filter(([, c]) => c >= 2)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

function Bar({
  value,
  color,
  pulse = false,
  glow = false,
}: {
  value: number
  color: string
  pulse?: boolean
  glow?: boolean
}) {
  return (
    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden relative">
      <motion.div
        className="h-full rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: glow && value > 0.1 ? `0 0 6px ${color}` : 'none',
        }}
        animate={{ width: `${Math.round(Math.min(value, 1) * 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {pulse && value > 0.05 && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: color }}
          animate={{ opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </div>
  )
}

function RadialGauge({ value, color }: { value: number; color: string }) {
  const r    = 30
  const circ = 2 * Math.PI * r
  const dash = (Math.min(value, 100) / 100) * circ
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
        <motion.circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: value > 10 ? `drop-shadow(0 0 4px ${color})` : 'none' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-base font-light tabular-nums" style={{ color }}>
          {Math.round(value)}
        </div>
        <div className="text-[9px] tracking-widest uppercase text-white/25">%</div>
      </div>
    </div>
  )
}

/** Stage indicator — 4 dots that light up as development progresses */
function StageDots({ stage }: { stage: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {[0, 1, 2, 3].map((s) => (
        <motion.div
          key={s}
          className="w-1.5 h-1.5 rounded-full"
          animate={{
            backgroundColor:
              s < stage   ? '#10B981'
              : s === stage ? '#F59E0B'
              : 'rgba(255,255,255,0.08)',
            boxShadow:
              s === stage ? '0 0 6px #F59E0B' : 'none',
          }}
          transition={{ duration: 0.5 }}
        />
      ))}
    </div>
  )
}

export default function StatsPanel() {
  const model      = useBrainStore((s) => s.model)
  const activation = useBrainStore((s) => s.activation)
  const topClusters = getTopClusters(model, 5)

  // Derived stats
  const acquiredClusters = model.clusterFreq.filter((c) => c >= 25).length
  const maxFreq          = Math.max(...model.clusterFreq)
  const freqProgress     = Math.min(maxFreq / 250, 1)
  const brainAgePercent  = Math.round(model.brainAge * 100)

  return (
    <div className="flex flex-col gap-5 p-1">

      {/* Developmental stage */}
      <section>
        <label className="stat-label">Development</label>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[10px] text-white/40 tracking-wide">
            {STAGE_LABELS[model.developmentStage]}
          </span>
          <StageDots stage={model.developmentStage} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-white/25 w-16">Brain age</span>
          <div className="flex-1">
            <Bar value={model.brainAge} color="#a78bfa" glow={model.brainAge > 0.3} />
          </div>
          <span className="text-[9px] tabular-nums text-white/20 w-6">{brainAgePercent}</span>
        </div>
      </section>

      <div className="border-t border-white/[0.04]" />

      {/* Live activation */}
      <section>
        <label className="stat-label">Region Activation</label>
        <div className="mt-2.5 flex flex-col gap-2">
          {[
            { label: 'Auditory', val: activation.auditory, color: '#3B82F6' },
            { label: 'Wernicke', val: activation.wernicke, color: '#10B981' },
            { label: "Broca's", val: activation.broca,     color: '#F59E0B' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-white/25 w-16">{label}</span>
              <div className="flex-1"><Bar value={val} color={color} pulse={val > 0.1} /></div>
              <span className="text-[9px] tabular-nums text-white/20 w-6">{Math.round(val * 100)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-white/[0.04]" />

      {/* Training progress */}
      <section>
        <label className="stat-label">Phoneme Learning</label>
        <div className="mt-2.5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/25 w-16">Exposure</span>
            <div className="flex-1"><Bar value={freqProgress} color="#8B5CF6" /></div>
            <span className="text-[9px] tabular-nums text-white/20 w-6">{Math.round(freqProgress * 100)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/25 w-16">Sessions</span>
            <div className="flex-1">
              <Bar value={Math.min(model.totalUtterances / 50, 1)} color="#EC4899" />
            </div>
            <span className="text-[9px] tabular-nums text-white/20 w-6">{model.totalUtterances}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/25 w-16">Inventory</span>
            <div className="flex-1">
              <Bar value={Math.min(acquiredClusters / 4, 1)} color="#06B6D4" />
            </div>
            <span className="text-[9px] tabular-nums text-white/20 w-6">{acquiredClusters}</span>
          </div>
        </div>
      </section>

      <div className="border-t border-white/[0.04]" />

      {/* Pathway strength */}
      <section>
        <label className="stat-label">Neural Pathways</label>
        <div className="mt-2.5 flex flex-col gap-2">
          {[
            { label: 'Aud → Wer', val: model.pathwayStrength[0], color: '#3B82F6' },
            { label: 'Wer → Bro', val: model.pathwayStrength[1], color: '#10B981' },
            { label: 'Aud → Bro', val: model.pathwayStrength[2], color: '#F59E0B' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-white/25 w-16">{label}</span>
              <div className="flex-1"><Bar value={val} color={color} glow={val > 0.3} /></div>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-white/[0.04]" />

      {/* Words heard */}
      <section>
        <label className="stat-label">Words Heard</label>
        <div className="mt-2 flex flex-col gap-1.5">
          {(() => {
            const words    = getTopWords(model.wordFreq)
            const maxCount = words[0]?.count ?? 1
            if (words.length === 0) {
              return (
                <p className="text-[10px] text-white/15 italic">Speak to begin learning</p>
              )
            }
            return words.map((w, i) => (
              <div key={w.word} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-white/15 w-2.5">{i + 1}</span>
                  <span className="text-xs text-white/60 font-light tracking-wide">{w.word}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-14 h-0.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white/30"
                      style={{ width: `${(w.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-white/30 w-8 text-right">×{w.count}</span>
                </div>
              </div>
            ))
          })()}
        </div>
      </section>

      {/* Acoustic patterns */}
      <section>
        <label className="stat-label">Acoustic Patterns</label>
        <div className="mt-2 flex flex-col gap-1.5">
          {topClusters.filter((c) => c.count > 0).slice(0, 4).map((c, i) => (
            <div key={c.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/15 w-2.5">{i + 1}</span>
                <span className="text-[10px] font-mono text-white/35">/{c.syllable}/</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Recency bar (how fresh this pattern is) */}
                <div className="w-8 h-0.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400/40"
                    style={{ width: `${Math.min(c.recency * 100 * 8, 100)}%` }}
                  />
                </div>
                <div className="w-14 h-0.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/15"
                    style={{ width: `${Math.min((c.count / Math.max(maxFreq, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[9px] tabular-nums text-white/20 w-10 text-right">×{c.count}</span>
              </div>
            </div>
          ))}
          {topClusters.every((c) => c.count === 0) && (
            <p className="text-[10px] text-white/15 italic">No patterns yet</p>
          )}
        </div>
      </section>

      <div className="border-t border-white/[0.04]" />

      {/* First word readiness gauge */}
      <section>
        <label className="stat-label">First Word Readiness</label>
        <div className="mt-3 flex justify-center">
          <RadialGauge value={model.readinessScore} color="#F59E0B" />
        </div>
        {model.readinessScore > 5 && !model.firstWordSpoken && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-center text-[10px] text-white/20 tracking-wider"
          >
            {model.readinessScore < 25  ? 'listening…'
              : model.readinessScore < 50 ? 'patterns forming…'
              : model.readinessScore < 75 ? 'sequences stabilising…'
              : model.readinessScore < 90 ? 'almost there…'
              : 'nearly ready…'}
          </motion.p>
        )}
        {model.firstWordSpoken && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-center text-xs text-amber-400/60 tracking-wider"
          >
            "{model.firstWord}"
          </motion.p>
        )}
      </section>

    </div>
  )
}
