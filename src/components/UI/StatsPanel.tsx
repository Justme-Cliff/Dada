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

/** Thin gradient divider between sections */
function Divider() {
  return (
    <div
      className="my-5 h-px w-full"
      style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.15) 40%, rgba(99,102,241,0.12) 60%, transparent)' }}
    />
  )
}

/** Section label with a tiny left accent bar */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-0.5 h-3 rounded-full bg-white/20" />
      <span className="text-[9px] tracking-[0.26em] uppercase text-white/40 font-light">{children}</span>
    </div>
  )
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
    <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: glow && value > 0.1 ? `0 0 8px ${color}88` : 'none',
        }}
        animate={{ width: `${Math.round(Math.min(value, 1) * 100)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
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
  const r    = 32
  const circ = 2 * Math.PI * r
  const dash = (Math.min(value, 100) / 100) * circ
  const isHigh = value > 60
  return (
    <div className="relative w-[84px] h-[84px] flex items-center justify-center">
      {/* Outer glow when high */}
      {isHigh && (
        <div
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 24px ${color}33` }}
        />
      )}
      <svg width="84" height="84" className="-rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.5" />
        <motion.circle
          cx="42" cy="42" r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ filter: value > 10 ? `drop-shadow(0 0 5px ${color}99)` : 'none' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-light tabular-nums" style={{ color, letterSpacing: '-0.02em' }}>
          {Math.round(value)}
        </div>
        <div className="text-[8px] tracking-widest uppercase text-white/25 -mt-0.5">%</div>
      </div>
    </div>
  )
}

/** Stage dots */
function StageDots({ stage }: { stage: number }) {
  return (
    <div className="flex gap-2 items-center">
      {[0, 1, 2, 3].map((s) => (
        <motion.div
          key={s}
          className="w-1.5 h-1.5 rounded-full"
          animate={{
            backgroundColor:
              s < stage   ? '#10B981'
              : s === stage ? '#F59E0B'
              : 'rgba(255,255,255,0.1)',
            boxShadow:
              s < stage   ? '0 0 4px #10B98188'
              : s === stage ? '0 0 6px #F59E0B'
              : 'none',
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

  const acquiredClusters = model.clusterFreq.filter((c) => c >= 10).length
  const maxFreq          = Math.max(...model.clusterFreq)
  const freqProgress     = Math.min(maxFreq / 50, 1)
  const brainAgePercent  = Math.round(model.brainAge * 100)

  return (
    <div className="flex flex-col">

      {/* ── Developmental stage ── */}
      <section>
        <SectionLabel>Development</SectionLabel>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-white/55 tracking-wide">
            {STAGE_LABELS[model.developmentStage]}
          </span>
          <StageDots stage={model.developmentStage} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/30 w-16 shrink-0">Brain age</span>
          <div className="flex-1">
            <Bar value={model.brainAge} color="#a78bfa" glow={model.brainAge > 0.3} />
          </div>
          <span className="text-[10px] tabular-nums text-white/35 w-7 text-right">{brainAgePercent}</span>
        </div>
      </section>

      <Divider />

      {/* ── Live activation ── */}
      <section>
        <SectionLabel>Region Activation</SectionLabel>
        <div className="flex flex-col gap-3">
          {[
            { label: 'Auditory', val: activation.auditory, color: '#3B82F6' },
            { label: 'Wernicke', val: activation.wernicke, color: '#10B981' },
            { label: "Broca's",  val: activation.broca,    color: '#F59E0B' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-[10px] text-white/30 w-16 shrink-0">{label}</span>
              <div className="flex-1 relative"><Bar value={val} color={color} pulse={val > 0.1} /></div>
              <span className="text-[10px] tabular-nums text-white/35 w-7 text-right">{Math.round(val * 100)}</span>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── Phoneme learning ── */}
      <section>
        <SectionLabel>Phoneme Learning</SectionLabel>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/30 w-16 shrink-0">Exposure</span>
            <div className="flex-1"><Bar value={freqProgress} color="#8B5CF6" /></div>
            <span className="text-[10px] tabular-nums text-white/35 w-7 text-right">{Math.round(freqProgress * 100)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/30 w-16 shrink-0">Sessions</span>
            <div className="flex-1">
              <Bar value={Math.min(model.totalUtterances / 15, 1)} color="#EC4899" />
            </div>
            <span className="text-[10px] tabular-nums text-white/35 w-7 text-right">{model.totalUtterances}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/30 w-16 shrink-0">Inventory</span>
            <div className="flex-1">
              <Bar value={Math.min(acquiredClusters / 2, 1)} color="#06B6D4" />
            </div>
            <span className="text-[10px] tabular-nums text-white/35 w-7 text-right">{acquiredClusters}</span>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── Neural pathways ── */}
      <section>
        <SectionLabel>Neural Pathways</SectionLabel>
        <div className="flex flex-col gap-3">
          {[
            { label: 'Aud → Wer', val: model.pathwayStrength[0], color: '#3B82F6' },
            { label: 'Wer → Bro', val: model.pathwayStrength[1], color: '#10B981' },
            { label: 'Aud → Bro', val: model.pathwayStrength[2], color: '#F59E0B' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-[10px] text-white/30 w-16 shrink-0">{label}</span>
              <div className="flex-1"><Bar value={val} color={color} glow={val > 0.3} /></div>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── Words heard ── */}
      <section>
        <SectionLabel>Words Heard</SectionLabel>
        <div className="flex flex-col gap-2">
          {(() => {
            const words    = getTopWords(model.wordFreq)
            const maxCount = words[0]?.count ?? 1
            if (words.length === 0) {
              return (
                <p className="text-[10px] text-white/20 italic pl-3">Speak to begin learning</p>
              )
            }
            return words.map((w, i) => (
              <div key={w.word} className="flex items-center justify-between group">
                <div className="flex items-center gap-2.5">
                  <span className="text-[9px] text-white/20 w-3">{i + 1}</span>
                  <span className="text-[11px] text-white/65 font-light tracking-wide">{w.word}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-14 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(w.count / maxCount) * 100}%`, background: 'rgba(255,255,255,0.35)' }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-white/35 w-8 text-right">×{w.count}</span>
                </div>
              </div>
            ))
          })()}
        </div>
      </section>

      {/* ── Acoustic patterns ── */}
      {topClusters.some((c) => c.count > 0) && (
        <>
          <Divider />
          <section>
            <SectionLabel>Acoustic Patterns</SectionLabel>
            <div className="flex flex-col gap-2">
              {topClusters.filter((c) => c.count > 0).slice(0, 4).map((c, i) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[9px] text-white/20 w-3">{i + 1}</span>
                    <span className="text-[10px] font-mono text-white/45 tracking-wider">/{c.syllable}/</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(c.recency * 100 * 8, 100)}%`, background: 'rgba(251,191,36,0.5)' }}
                      />
                    </div>
                    <div className="w-14 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min((c.count / Math.max(maxFreq, 1)) * 100, 100)}%`, background: 'rgba(255,255,255,0.25)' }}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums text-white/25 w-10 text-right">×{c.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <Divider />

      {/* ── First word readiness ── */}
      <section>
        <SectionLabel>First Word Readiness</SectionLabel>
        <div className="flex flex-col items-center gap-3 pt-1">
          <RadialGauge value={model.readinessScore} color="#F59E0B" />

          {model.readinessScore > 5 && !model.firstWordSpoken && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-[10px] text-white/30 tracking-wider"
            >
              {model.readinessScore < 25  ? 'listening…'
                : model.readinessScore < 50 ? 'patterns forming…'
                : model.readinessScore < 75 ? 'sequences stabilising…'
                : model.readinessScore < 90 ? 'almost there…'
                : 'nearly ready…'}
            </motion.p>
          )}

          {model.firstWordSpoken && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <p className="text-xs text-amber-400/70 tracking-wider">"{model.firstWord}"</p>
              <p className="text-[9px] text-white/20 mt-1 tracking-widest uppercase">first word spoken</p>
            </motion.div>
          )}
        </div>
      </section>

    </div>
  )
}
