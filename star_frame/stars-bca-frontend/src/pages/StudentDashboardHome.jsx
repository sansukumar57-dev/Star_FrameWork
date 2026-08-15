import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts'
import { StatCard, ProgressRing, PageHeader, Card, EmptyState, Button, Toast } from '../components/UI.jsx'
import { downloadProgressCard, getStudentLeaderboard } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

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

export default function StudentDashboardHome({ student, points, completed, pendingTasks, pendingReview, submissions, recent, activities = [] }) {
  const percent = Math.min(100, Math.round((points / 500) * 100))
  const [streak, setStreak] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    getStudentLeaderboard()
      .then((res) => setStreak(res.data?.streak || 0))
      .catch(() => {})
  }, [])

  async function handleDownloadCard() {
    setDownloading(true)
    try {
      await downloadProgressCard()
    } catch (error) {
      setToast(error.message || 'Unable to download progress card')
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
        if (submission.status !== 'Approved') return sum
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
        name: vertical.label,
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
    const overallParticipation = verticalAnalytics.length > 0
      ? Math.round(verticalAnalytics.reduce((sum, item) => sum + item.participation, 0) / verticalAnalytics.length)
      : 0

    return {
      mostActive,
      leastActive,
      participated,
      remaining: Math.max(0, DEFAULT_VERTICALS.length - participated),
      overallParticipation,
    }
  }, [verticalAnalytics])

  const chartData = verticalAnalytics.map((item) => ({
    name: item.name.replace('Vertical ', '').split(' - ')[0],
    completed: item.completed,
    points: item.points,
    participation: item.participation,
  }))

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast} tone="error" onDismiss={() => setToast('')} />}
      <PageHeader
        title="Your STAR Dashboard"
        subtitle={`Register No. ${student.registerNumber || student.regNo || student.register || '—'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleDownloadCard} loading={downloading}>⬇ Progress Card (PDF)</Button>
            <span className="inline-flex rounded-full border border-rule bg-card px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">
              {summaryStats.participated} of {DEFAULT_VERTICALS.length} verticals active
            </span>
          </div>
        }
      />

      {/* Meter-led stat row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-4">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-500">STAR %</p>
          <div className="mt-4 max-w-[220px]">
            <ProgressRing percent={percent} />
          </div>
          <p className="mt-3 text-xs text-slate-400">Overall achievement on a 500-point scale</p>
          {streak > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-mono text-[11px] font-medium text-amber-700">
              🔥 {streak} week{streak === 1 ? '' : 's'} streak
            </p>
          )}
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-8">
          <StatCard label="Total Points" value={points} sub="Earned so far" accent="brand" />
          <StatCard label="Completed Tasks" value={completed} sub={`${submissions.length} total submitted`} accent="leaf" />
          <StatCard label="Pending Tasks" value={pendingTasks.length} sub={`${pendingReview} awaiting review`} accent="amber" />
        </div>
      </div>

      {/* Vertical performance */}
      <Card className="p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">STAR Vertical Performance</h2>
            <p className="mt-1 text-sm text-slate-400">Participation across all 10 STAR Framework Verticals, from live activity data.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-8 xl:grid-cols-[1.65fr_0.9fr]">
          <div className="h-80 w-full rounded-md border border-rule bg-paper p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--color-slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-slate-400)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value, name) => [value, name === 'completed' ? 'Completed Activities' : name === 'points' ? 'Points Earned' : 'Participation %']}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }}
                />
                <Legend />
                <Bar dataKey="completed" radius={[3, 3, 0, 0]} fill="var(--color-brand-500)">
                  {chartData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={entry.completed > 0 ? 'var(--color-brand-500)' : 'var(--color-slate-300)'} />
                  ))}
                </Bar>
                <Bar dataKey="points" radius={[3, 3, 0, 0]} fill="var(--color-leaf-500)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="xl:border-l xl:border-rule xl:pl-8">
            <dl>
              {[
                ['Most Active Vertical', summaryStats.mostActive?.name || '—', `${summaryStats.mostActive?.completed || 0} activities · ${summaryStats.mostActive?.points || 0} pts`],
                ['Least Active Vertical', summaryStats.leastActive?.name || '—', `${summaryStats.leastActive?.completed || 0} activities · ${summaryStats.leastActive?.points || 0} pts`],
                ['Participation', `${summaryStats.participated} of ${DEFAULT_VERTICALS.length}`, `${summaryStats.remaining} remaining · ${summaryStats.overallParticipation}% overall`],
              ].map(([label, value, sub]) => (
                <div key={label} className="border-t border-rule py-3">
                  <dt className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</dt>
                  <dd className="mt-1 font-display text-lg font-semibold text-ink">{value}</dd>
                  <dd className="text-sm text-slate-500">{sub}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Card>

      {/* Performance summary + recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Performance Summary</h2>
          <dl className="mt-2">
            <div className="flex items-baseline justify-between border-t border-rule py-4">
              <dt className="text-sm text-slate-500">Approved submissions</dt>
              <dd className="tabular font-display text-2xl font-semibold text-ink">{completed}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-rule py-4">
              <dt className="text-sm text-slate-500">Pending review</dt>
              <dd className="tabular font-display text-2xl font-semibold text-ink">{pendingReview}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Recent Activity</h2>
          {recent.length > 0 ? (
            <ul className="mt-2">
              {recent.map((item) => (
                <li key={item._id} className="border-t border-rule py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper font-mono text-[11px] text-brand-500">
                      {item.status === 'Approved' ? '✓' : item.status === 'Rejected' ? '✕' : '…'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{item.activityId?.activityName || 'Activity'}</p>
                      <p className="font-mono text-xs text-slate-400">{item.status} · {new Date(item.submittedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2">
              <EmptyState icon="·" title="No recent activity" description="Your latest submission updates will show up here." />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}