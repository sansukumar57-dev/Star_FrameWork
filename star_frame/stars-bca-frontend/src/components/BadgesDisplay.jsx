import React from 'react'
import { motion } from 'framer-motion'
import { Card, LoadingState, EmptyState } from './UI.jsx'

/**
 * Badges Display Component
 * Shows earned badges with animation
 */
export default function BadgesDisplay({ badges = [], loading = false, isStudent = false }) {
  const badgeVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3
      }
    })
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  if (loading) {
    return <LoadingState text="Loading badges..." />
  }

  if (!badges || badges.length === 0) {
    return (
      <EmptyState
        icon="🏆"
        title={isStudent ? "No badges yet" : "No badges earned"}
        description={isStudent ? "Complete activities and milestones to earn badges!" : "Encourage your students to complete activities."}
      />
    )
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
        <span>🏆</span>
        Earned Badges ({badges.length})
      </h3>
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {badges.map((badge, i) => (
          <motion.div
            key={badge._id || i}
            variants={badgeVariants}
            custom={i}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Card className="p-3 text-center cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-3xl mb-1">{badge.badgeIcon || badge.icon || '🏅'}</div>
              <h4 className="text-xs font-semibold text-ink truncate">{badge.badgeName || badge.name}</h4>
              <p className="text-[10px] text-slate-400 mt-1">{badge.awardedAt ? new Date(badge.awardedAt).toLocaleDateString() : ''}</p>
              <p className="text-[10px] text-slate-500 mt-2 line-clamp-2">{badge.badgeDescription || badge.description}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
