import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, LoadingState, EmptyState, Button } from './UI.jsx'

/**
 * Leaderboard Component
 * Displays department/institution leaderboards
 */
export default function Leaderboard({
  title = 'Leaderboard',
  students = [],
  loading = false,
  currentUserId = null,
  onExpandClick = null,
  limit = 10
}) {
  const [expanded, setExpanded] = useState(false)
  const displayLimit = expanded ? students.length : limit
  const displayedStudents = students.slice(0, displayLimit)

  const rowVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3
      }
    })
  }

  const getRankMedal = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getStreakIndicator = (streak) => {
    if (streak === 0) return ''
    if (streak >= 30) return '🔥🔥🔥'
    if (streak >= 7) return '🔥🔥'
    if (streak >= 1) return '🔥'
    return ''
  }

  if (loading) {
    return <LoadingState text="Loading leaderboard..." />
  }

  if (!students || students.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No data available"
        description="The leaderboard will be populated as students earn points."
      />
    )
  }

  return (
    <div className="w-full space-y-3">
      <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
        <span>📊</span>
        {title}
      </h3>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper/60 border-b border-rule">
              <tr className="text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                <th className="text-left font-medium px-3 py-2.5">Rank</th>
                <th className="text-left font-medium px-3 py-2.5">Student</th>
                <th className="text-right font-medium px-3 py-2.5">Points</th>
                <th className="text-center font-medium px-3 py-2.5">Streak</th>
                <th className="text-right font-medium px-3 py-2.5">Submissions</th>
              </tr>
            </thead>
            <tbody>
              {displayedStudents.map((student, index) => {
                const isCurrentUser = currentUserId && student._id === currentUserId
                return (
                  <motion.tr
                    key={student._id || index}
                    variants={rowVariants}
                    custom={index}
                    initial="hidden"
                    animate="visible"
                    className={`border-b border-rule transition-colors hover:bg-paper/60 ${
                      isCurrentUser ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-ink">
                      <span className="text-lg">{getRankMedal(student.rank || index + 1)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>
                        <p className="font-medium text-ink">{student.name}</p>
                        <p className="text-xs text-slate-400">{student.regNo || student.registerNo || ''}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-blue-600">
                      {student.totalPoints || 0}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="text-sm">
                        {getStreakIndicator(student.currentStreak || 0)}
                        {(student.currentStreak || 0) > 0 && (
                          <span className="text-[10px] text-slate-400 block mt-1">{student.currentStreak}d</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      {student.approvedSubmissions || 0}/{student.totalSubmissions || 0}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Expand/Collapse Button */}
        {students.length > limit && (
          <div className="px-3 py-2.5 border-t border-rule bg-paper/30 text-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setExpanded(!expanded)
                onExpandClick?.(!expanded)
              }}
            >
              {expanded ? '↑ Show Less' : '↓ Show All'} ({students.length})
            </Button>
          </div>
        )}
      </Card>

      {/* Legend */}
      <div className="text-xs text-slate-500 space-y-1">
        <p>🔥 Streak: 1+ days | 🔥🔥 7+ days | 🔥🔥🔥 30+ days</p>
      </div>
    </div>
  )
}
