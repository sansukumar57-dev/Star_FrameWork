import React, { useEffect } from 'react'
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const SIZE = 168
const STROKE = 11
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const TONES = {
  brand: { stroke: 'var(--color-brand-500)', soft: 'var(--color-brand-50)', text: 'text-brand-600' },
  leaf: { stroke: 'var(--color-leaf-500)', soft: 'var(--color-leaf-50)', text: 'text-leaf-600' },
  amber: { stroke: '#f59e0b', soft: '#fffbeb', text: 'text-amber-600' },
  rose: { stroke: '#f43f5e', soft: '#fff1f2', text: 'text-rose-600' },
}

function useAnimatedPercentage(target, duration = 900) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 70, damping: 20 })
  const rounded = useTransform(spring, (value) => Math.round(value))
  const dash = useTransform(spring, (value) => CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(100, Math.max(0, value))) / 100)

  useEffect(() => {
    motionValue.set(0)
    const timer = setTimeout(() => motionValue.set(target), 40)
    return () => clearTimeout(timer)
  }, [target, motionValue, spring, duration])

  return { rounded, dash }
}

export default function StarRing({
  percent = 0,
  label = 'STAR %',
  caption = '',
  tone = 'brand',
  trend = null,
  trendLabel = '',
  breakdown = [],
  expanded = false,
  onToggle = null,
  size = SIZE,
}) {
  const colors = TONES[tone] || TONES.brand
  const { rounded, dash } = useAnimatedPercentage(percent)
  const scale = size / SIZE

  const trendUp = trend === 'up'
  const hasTrend = trend === 'up' || trend === 'down'

  return (
    <motion.div
      initial={false}
      animate="visible"
      className="w-full select-none"
      aria-label={`${label}: ${percent}%`}
    >
      <button
        type="button"
        onClick={onToggle || undefined}
        disabled={!onToggle}
        className={`w-full text-left focus-ring ${onToggle ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
          {onToggle && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
              {expanded ? 'Collapse ▴' : 'Breakdown ▾'}
            </span>
          )}
        </div>

        <div className="relative mt-4" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} className="block" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={colors.soft} strokeWidth={STROKE} />
            <motion.circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={colors.stroke}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              style={{ strokeDashoffset: dash }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.p
              className="tabular font-display font-semibold text-ink"
              style={{ fontSize: `${40 * scale}px`, lineHeight: 1 }}
            >
              {rounded}
            </motion.p>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">of 100</p>
          </div>
        </div>

        <motion.div
          className="mt-4 space-y-2"
          animate={{ opacity: 1, y: 0 }}
          initial={false}
        >
          <div className="flex flex-wrap items-center gap-2">
            <AnimatePresence initial={false}>
              {hasTrend && (
                <motion.span
                  key={trend}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2 }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${
                    trendUp ? 'border-leaf-200 bg-leaf-50 text-leaf-700' : 'border-rose-200 bg-rose-50 text-rose-600'
                  }`}
                >
                  <span aria-hidden="true">{trendUp ? '▲' : '▼'}</span>
                  {trendLabel || (trendUp ? 'Up vs last period' : 'Down vs last period')}
                </motion.span>
              )}
            </AnimatePresence>
            {caption && <span className="text-xs text-slate-400">{caption}</span>}
          </div>
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="breakdown"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-rule pt-4">
              <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Breakdown</p>
              <div className="mt-3 space-y-3">
                {breakdown.length > 0 ? (
                  breakdown.map((item, index) => {
                    const itemPct = Math.max(0, Math.min(100, Number(item.value) || 0))
                    return (
                      <div key={item.key || index}>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-xs text-slate-500">{item.label}</p>
                          <p className="shrink-0 font-mono text-xs font-medium text-ink">{item.display ?? `${itemPct}%`}</p>
                        </div>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: colors.stroke }}
                            initial={false}
                            animate={{ width: `${Math.max(2, itemPct)}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-slate-400">No data yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
