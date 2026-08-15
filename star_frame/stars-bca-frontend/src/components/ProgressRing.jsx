import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Animated Progress Ring Component with STAR Percentage Visualization
 * Features:
 * - Smooth animation on value change
 * - Trend indicator (up/down arrow)
 * - Click-to-expand for detailed breakdown
 * - Customizable colors and size
 */
export default function ProgressRing({
  value = 0,
  maxValue = 100,
  label = 'Progress',
  subLabel = '',
  trend = null, // null, 'up', 'down'
  trendPercentage = null,
  color = 'brand',
  size = 'lg',
  onClick = null,
  showTrend = true,
  detailed = false,
  breakdown = {}
}) {
  const [displayValue, setDisplayValue] = useState(value)
  const [animationKey, setAnimationKey] = useState(0)

  // Trigger animation when value changes
  useEffect(() => {
    setDisplayValue(value)
    setAnimationKey(prev => prev + 1)
  }, [value])

  // Determine size dimensions
  const sizeMap = {
    sm: { radius: 30, circumference: 188.4, strokeWidth: 3, fontSize: 'text-xs' },
    md: { radius: 45, circumference: 282.6, strokeWidth: 4, fontSize: 'text-sm' },
    lg: { radius: 60, circumference: 376.8, strokeWidth: 5, fontSize: 'text-lg' },
    xl: { radius: 80, circumference: 502.4, strokeWidth: 6, fontSize: 'text-xl' }
  }

  const sizing = sizeMap[size] || sizeMap.lg

  // Determine color scheme
  const colorMap = {
    brand: { start: 'from-blue-500', end: 'to-blue-600', text: 'text-blue-600', bg: 'bg-blue-50' },
    leaf: { start: 'from-green-500', end: 'to-green-600', text: 'text-green-600', bg: 'bg-green-50' },
    rose: { start: 'from-rose-500', end: 'to-rose-600', text: 'text-rose-600', bg: 'bg-rose-50' },
    amber: { start: 'from-amber-500', end: 'to-amber-600', text: 'text-amber-600', bg: 'bg-amber-50' }
  }

  const colors = colorMap[color] || colorMap.brand

  const percentage = (displayValue / maxValue) * 100
  const strokeDashoffset = sizing.circumference - (percentage / 100) * sizing.circumference

  const trendColor = trend === 'up' ? 'text-green-600' : 'text-rose-600'
  const trendIcon = trend === 'up' ? '↑' : '↓'

  return (
    <motion.div
      className={`flex flex-col items-center gap-3 p-4 rounded-lg ${colors.bg} cursor-pointer`}
      onClick={onClick}
      whileHover={{ scale: onClick ? 1.02 : 1 }}
      whileTap={{ scale: onClick ? 0.98 : 1 }}
    >
      {/* SVG Ring */}
      <div className="relative" style={{
        width: sizing.radius * 2 + 20,
        height: sizing.radius * 2 + 20
      }}>
        <svg
          className="absolute top-0 left-0"
          width={sizing.radius * 2 + 20}
          height={sizing.radius * 2 + 20}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background circle */}
          <circle
            cx={sizing.radius + 10}
            cy={sizing.radius + 10}
            r={sizing.radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={sizing.strokeWidth}
          />

          {/* Animated progress circle */}
          <motion.circle
            key={animationKey}
            cx={sizing.radius + 10}
            cy={sizing.radius + 10}
            r={sizing.radius}
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth={sizing.strokeWidth}
            strokeDasharray={sizing.circumference}
            strokeLinecap="round"
            initial={{ strokeDashoffset: sizing.circumference }}
            animate={{ strokeDashoffset }}
            transition={{
              duration: 1.2,
              ease: 'easeInOut'
            }}
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.start.replace('from-', '').replace('-500', '')} />
              <stop offset="100%" stopColor={colors.end.replace('to-', '').replace('-600', '')} />
            </linearGradient>
          </defs>
        </svg>

        {/* Center text */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span className={`${sizing.fontSize} font-bold ${colors.text}`}>
            {Math.round(percentage)}%
          </span>
          <span className={`text-[10px] text-slate-400`}>
            {Math.round(displayValue)}/{maxValue}
          </span>
        </motion.div>
      </div>

      {/* Label and Stats */}
      <div className="text-center w-full">
        <p className="text-sm font-medium text-ink">{label}</p>
        {subLabel && <p className="text-xs text-slate-400">{subLabel}</p>}

        {/* Trend Indicator */}
        {showTrend && trend && (
          <motion.div
            className={`inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-full text-xs font-medium ${trendColor}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span>{trendIcon}</span>
            {trendPercentage && <span>{trendPercentage}% vs last period</span>}
          </motion.div>
        )}
      </div>

      {/* Detailed Breakdown (if provided) */}
      {detailed && Object.keys(breakdown).length > 0 && (
        <motion.div
          className="w-full mt-2 pt-2 border-t border-slate-200 space-y-1"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          {Object.entries(breakdown).map(([key, val]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-slate-500">{key}</span>
              <span className={`font-medium ${colors.text}`}>{val}</span>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
