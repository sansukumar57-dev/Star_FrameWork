import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { StatCard, PageHeader, Card, Button, Toast } from '../components/UI.jsx'
import ProgressRing from '../components/ProgressRing.jsx'
import BadgesDisplay from '../components/BadgesDisplay.jsx'
import Leaderboard from '../components/Leaderboard.jsx'
import { downloadProgressCard, getStudentStats, getStudentBadges, getDepartmentLeaderboard } from '../utils/api.js'

const DEFAULT_VERTICALS = [
  { key: 'academic', label: 'Vertical 1 - Academic Performance' },
  { key: 'innovation', label: 'Vertical 2 - Innovation & Research' },
  { key: 'leadership', label: 'Vertical 3 - Leadership & Governance' },
  { key: 'community', label: 'Vertical 4 - Community Engagement' },
  { key: 'culture', label: 'Vertical 5 - Cultural & Sports' },
  { key: 'professional', label: 'Vertical 6 - Professional Development' },
  { key: 'entrepreneurship', label: 'Vertical 7 - Entrepreneurship' },
  { key: 'global', label: 'Vertical 8 - Global Exposure' },
  { key: 'social', label: 'Vertical 9 - Social Responsibility' },
  { key: 'digital', label: 'Vertical 10 - Digital Skills' },
]

function normalizeVerticalKey(value = '') {
  const text = String(value || '').toLowerCase()
  if (text.includes('academic')) return 'academic'
  if (text.includes('innovation') || text.includes('research')) return 'innovation'
  if (text.includes('leadership') || text.includes('governance')) return 'leadership'
  if (text.includes('community') || text.includes('engagement')) return 'community'
  if (text.includes('culture') || text.includes('sports')) return 'culture'
  if (text.includes('professional') || text.includes('development')) return 'professional'
  if (text.includes('entrepreneur')) return 'entrepreneurship'
  if (text.includes('global') || text.includes('international')) return 'global'
  if (text.includes('social') || text.includes('responsibility')) return 'social'
  if (text.includes('digital') || text.includes('technology')) return 'digital'
  return null
}

export default function EnhancedStudentDashboardHome({
  student,
  points,
  completed,
  pendingTasks,
  pendingReview,
  submissions,
  recent,
  activities = [],
  onUploadClick = null
}) {
  const percent = Math.min(100, Math.round((points / 500) * 100))
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [stats, setStats] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [, setShowUpload] = useState(false)

  useEffect(() => {
    async function loadGamificationData() {
      try {
        setLoading(true)
        
        // Load student stats
        if (student?._id) {
          const [statsRes, badgesRes, leaderboardRes] = await Promise.all([
            getStudentStats(student._id),
            getStudentBadges(student._id),
            student.departmentId ? getDepartmentLeaderboard(student.departmentId, null, 10) : null
          ])

          setStats(statsRes?.data)
          setBadges(badgesRes?.data || [])
          setLeaderboard(leaderboardRes?.data || [])
          setStreak(statsRes?.data?.currentStreak || 0)
        }
      } catch (error) {
        console.error('Error loading gamification data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadGamificationData()
  }, [student?._id, student?.departmentId])

  async function handleDownloadCard() {
    setDownloading(true)
    try {
      await downloadProgressCard()
      setToast({ message: 'Progress card downloaded successfully', tone: 'success' })
    } catch (error) {
      setToast({ message: error.message || 'Unable to download progress card', tone: 'error' })
    } finally {
      setDownloading(false)
    }
  }

  const verticalAnalytics = useMemo(() => {
    const activityLookup = activities.reduce((acc, activity) => {
      const key = activity._id || activity.activityId || activity.activityName
      if (key) acc[key] = activity
      return acc
    }, {})

    const metrics = DEFAULT_VERTICALS.map((vertical) => {
      const matchingActivities = activities.filter((activity) => normalizeVerticalKey(activity.vertical) === vertical.key)
      const totalActivities = matchingActivities.length
      const approvedActivityIds = new Set()
      const approvedPoints = submissions.reduce((sum, submission) => {
        if (!['FacultyApproved', 'HODApproved', 'Approved'].includes(submission.status)) return sum
        const activityId = submission.activityId?._id || submission.activityId || submission.activity?.id || submission.activityId?.activityName
        const activity = activityId ? activityLookup[activityId] : null
        if (!activity) return sum
        const activityVerticalKey = normalizeVerticalKey(activity.vertical)
        if (activityVerticalKey !== vertical.key) return sum
        approvedActivityIds.add(activityId || activity.activityName)
        const awarded = Number(submission.pointsAwarded ?? submission.suggestedPoints ?? 0)
        return sum + (Number.isFinite(awarded) ? awarded : 0)
      }, 0)

      const completedCount = approvedActivityIds.size
      const participation = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0

      return {
        name: vertical.label.replace('Vertical', 'V'),
        completed: completedCount,
        points: approvedPoints,
        participation,
        totalActivities,
      }
    })

    return metrics
  }, [activities, submissions])

  const summaryStats = useMemo(() => {
    const participated = verticalAnalytics.filter((item) => item.completed > 0).length
    const mostActive = [...verticalAnalytics].sort((a, b) => (b.completed === a.completed ? b.points - a.points : b.completed - a.completed))[0]
    const leastActive = [...verticalAnalytics].sort((a, b) => (a.completed === b.completed ? a.points - b.points : a.completed - b.completed))[0]

    return {
      participated,
      mostActive: mostActive?.name || 'N/A',
      leastActive: leastActive?.name || 'N/A',
      totalVerticals: DEFAULT_VERTICALS.length,
    }
  }, [verticalAnalytics])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Dashboard"
        subtitle={`Welcome, ${student?.name || 'Student'}. Track your STAR progress and achievements.`}
      />

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Points"
          value={points || 0}
          sub={`${completed || 0} approvals`}
          accent="brand"
        />
        <StatCard
          label="Pending Review"
          value={pendingReview || 0}
          sub={`${pendingTasks?.length || 0} tasks available`}
          accent="amber"
        />
        <StatCard
          label="Current Streak"
          value={`${streak || 0}🔥`}
          sub={`Longest: ${stats?.longestStreak || 0} days`}
          accent="rose"
        />
        <StatCard
          label="Badges"
          value={badges?.length || 0}
          sub={`Achievement unlocked`}
          accent="leaf"
        />
      </div>

      {/* Primary Progress Ring */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <ProgressRing
          value={points || 0}
          maxValue={500}
          label="Total STAR Points"
          subLabel="Out of 500 points goal"
          trend={percent >= 80 ? 'up' : percent >= 40 ? null : 'down'}
          trendPercentage={percent}
          color="brand"
          size="lg"
          onClick={() => setShowUpload(true)}
          detailed={true}
          breakdown={{
            'Approved': completed || 0,
            'Pending': pendingReview || 0,
            'Available': pendingTasks?.length || 0
          }}
        />

        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-ink mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Button
              fullWidth
              onClick={() => onUploadClick?.() || setShowUpload(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              📤 Upload Evidence
            </Button>
            <Button
              fullWidth
              variant="outline"
              onClick={handleDownloadCard}
              disabled={downloading}
            >
              {downloading ? '...' : '📥'} Download Progress Card
            </Button>
            <Button fullWidth variant="outline">
              📋 View All Tasks
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Badges Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-5">
          <BadgesDisplay
            badges={badges}
            loading={loading}
            isStudent={true}
          />
        </Card>
      </motion.div>

      {/* Vertical Analytics Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-ink mb-4">Progress by Vertical</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={verticalAnalytics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="points" fill="#3b82f6" name="Points" />
              <Bar dataKey="completed" fill="#10b981" name="Completed" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Verticals Attempted</p>
              <p className="text-lg font-bold text-ink">{summaryStats.participated}/{summaryStats.totalVerticals}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-slate-500">Most Active</p>
              <p className="text-sm font-bold text-blue-600">{summaryStats.mostActive}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Least Active</p>
              <p className="text-sm font-bold text-slate-600">{summaryStats.leastActive}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-slate-500">Completion Rate</p>
              <p className="text-lg font-bold text-green-600">{percent}%</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Department Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-5">
          <Leaderboard
            title="Department Leaderboard"
            students={leaderboard}
            loading={loading}
            currentUserId={student?._id}
            limit={5}
          />
        </Card>
      </motion.div>

      {/* Recent Submissions */}
      {recent && recent.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-5">
            <h3 className="font-display text-lg font-semibold text-ink mb-3">Recent Submissions</h3>
            <div className="space-y-2">
              {recent.slice(0, 4).map((submission) => (
                <div key={submission._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {submission.activityId?.activityName || 'Activity'}
                    </p>
                    <p className="text-xs text-slate-400">{new Date(submission.submittedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      submission.status === 'Approved' ? 'bg-green-100 text-green-700' :
                      submission.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                      submission.status === 'Rejected' ? 'bg-rose-100 text-rose-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {submission.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast('')} />
      )}
    </div>
  )
}
