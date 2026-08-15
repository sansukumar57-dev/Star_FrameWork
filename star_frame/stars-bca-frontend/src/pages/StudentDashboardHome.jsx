import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts'
import { StatCard, PageHeader, Card, EmptyState, Button, Toast, LoadingState } from '../components/UI.jsx'
import StarRing from '../components/StarRing.jsx'
import { downloadProgressCard, getStudentLeaderboard, getStudentCoachInsights } from '../utils/api.js'

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
  const [coach, setCoach] = useState(null)
  const [coachLoading, setCoachLoading] = useState(false)

  useEffect(() => {
    getStudentLeaderboard()
      .then((res) => setStreak(res.data?.streak || 0))
      .catch(() => {})
  }, [])

  const studentId = student?._id || student?.id

  async function loadCoach() {
    if (!studentId) return
    setCoachLoading(true)
    try {
      const res = await getStudentCoachInsights(studentId)
      setCoach(res.data || null)
    } catch (error) {
      setToast(error.message || 'Unable to load AI coach')
    } finally {
      setCoachLoading(false)
    }
  }

  useEffect(() => {
    if (studentId) loadCoach()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

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

  const [starExpanded, setStarExpanded] = useState(false)
  const [trend, setTrend] = useState({ delta: 0, up: false, flat: true })

  useEffect(() => {
    const now = Date.now()
    const day = 86400000
    const pointsInWindow = (from, to) => submissions.reduce((sum, submission) => {
      if (submission.status !== 'Approved') return sum
      const timestamp = new Date(submission.verifiedAt || submission.submittedAt || submission.createdAt).getTime()
      if (!Number.isFinite(timestamp)) return sum
      if (timestamp >= from && timestamp < to) return sum + (Number(submission.pointsAwarded) || 0)
      return sum
    }, 0)
    const current = pointsInWindow(now - 30 * day, now)
    const previous = pointsInWindow(now - 60 * day, now - 30 * day)
    const delta = current - previous
    setTrend({ current, previous, delta, up: delta > 0, flat: delta === 0 })
  }, [submissions])

  const BADGES = [
    { key: 'century', label: 'Century Club', hint: '100 points', icon: '★', check: (s) => s.points >= 100 },
    { key: 'doubler', label: '250 Club', hint: '250 points', icon: '★★', check: (s) => s.points >= 250 },
    { key: 'achiever', label: 'Star Achiever', hint: '500 points', icon: '✦', check: (s) => s.points >= 500 },
    { key: 'learner', label: 'Active Learner', hint: '5 completed tasks', icon: '▲', check: (s) => s.completed >= 5 },
    { key: 'consistent', label: 'Consistent Star', hint: '15 completed tasks', icon: '◆', check: (s) => s.completed >= 15 },
    { key: 'relentless', label: 'Relentless', hint: '30 completed tasks', icon: '⬢', check: (s) => s.completed >= 30 },
    { key: 'roll', label: 'On a Roll', hint: '4-week streak', icon: '🔥', check: (s) => s.streak >= 4 },
    { key: 'unstoppable', label: 'Unstoppable', hint: '8-week streak', icon: '⚡', check: (s) => s.streak >= 8 },
  ]
  const badgeState = { points, completed, streak }
  const earnedBadges = BADGES.filter((badge) => badge.check(badgeState))
  const nextBadge = BADGES.find((badge) => !badge.check(badgeState))

  const starBreakdown = verticalAnalytics
    .filter((item) => item.points > 0 || item.completed > 0)
    .sort((a, b) => b.points - a.points)

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
          <StarRing
            percent={percent}
            label="STAR %"
            caption={`${points} / 500 points earned`}
            trend={trend.flat ? null : trend.up ? 'up' : 'down'}
            trendLabel={
              trend.flat
                ? 'No change vs last 30 days'
                : `${trend.delta > 0 ? '+' : ''}${trend.delta} pts vs last 30 days`
            }
            breakdown={starBreakdown.map((item) => ({
              key: item.name,
              label: item.name.replace(/Vertical\s*\d+\s*-\s*/, ''),
              value: item.participation,
              display: `${item.points} pts`,
            }))}
            expanded={starExpanded}
            onToggle={() => setStarExpanded((value) => !value)}
          />
          {streak > 0 && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-mono text-[11px] font-medium text-amber-700">
              🔥 {streak} week{streak === 1 ? '' : 's'} streak
            </span>
          )}
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-8">
          <StatCard label="Total Points" value={points} sub="Earned so far" accent="brand" />
          <StatCard label="Completed Tasks" value={completed} sub={`${submissions.length} total submitted`} accent="leaf" />
          <StatCard label="Pending Tasks" value={pendingTasks.length} sub={`${pendingReview} awaiting review`} accent="amber" />
        </div>
      </div>

      {/* Level progression */}
      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">STAR Level Progression</h2>
        <p className="mt-1 text-sm text-slate-400">Your journey through the STAR levels based on total points earned.</p>
        <div className="mt-5 flex items-center gap-1">
          {[
            { level: 1, label: 'Bronze', at: 0, color: '#CD7F32' },
            { level: 2, label: 'Silver', at: 100, color: '#C0C0C0' },
            { level: 3, label: 'Gold', at: 250, color: '#FFD700' },
            { level: 4, label: 'Platinum', at: 400, color: '#2C4D90' },
            { level: 5, label: 'Diamond', at: 500, color: '#208D49' },
          ].map((lvl, i) => {
            const reached = points >= lvl.at
            const nextLvl = [{ at: 0 }, { at: 100 }, { at: 250 }, { at: 400 }, { at: 500 }][i + 1]
            const isCurrent = reached && (!nextLvl || points < nextLvl.at)
            const progressToNext = nextLvl ? Math.min(100, Math.round(((points - lvl.at) / (nextLvl.at - lvl.at)) * 100)) : 100
            return (
              <div key={lvl.level} className="flex-1">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-mono text-xs font-semibold transition-colors ${
                  isCurrent ? 'border-current bg-current/10' : reached ? 'border-current bg-current/5' : 'border-slate-200 bg-slate-50 text-slate-300'
                }`} style={{ color: reached ? lvl.color : undefined, borderColor: reached ? lvl.color : undefined }}>
                  {reached ? '✓' : lvl.level}
                </div>
                <p className={`mt-2 text-center text-[10px] font-medium ${isCurrent ? 'text-ink' : 'text-slate-400'}`}>{lvl.label}</p>
                <p className="text-center font-mono text-[10px] text-slate-400">{lvl.at}+ pts</p>
                {isCurrent && nextLvl && (
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full" style={{ width: `${progressToNext}%`, backgroundColor: lvl.color }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* AI Coach */}
      <Card className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">AI Coach</h2>
            <p className="mt-1 text-sm text-slate-400">A personalized read on your progress and what to do next.</p>
          </div>
          <div className="flex items-center gap-2">
            {coach?.provider && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-brand-700">
                ✦ {coach.provider === 'rule-engine' ? 'Rule engine' : coach.provider}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={loadCoach} loading={coachLoading}>Refresh</Button>
          </div>
        </div>

        {coachLoading && !coach ? (
          <div className="mt-5"><LoadingState rows={1} /></div>
        ) : coach ? (
          <div className="mt-5 space-y-5">
            {coach.summary && <p className="text-sm leading-relaxed text-slate-600">{coach.summary}</p>}

            {coach.highlights?.length > 0 && (
              <div>
                <h3 className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Highlights</h3>
                <ul className="mt-2 space-y-1.5">
                  {coach.highlights.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-0.5 text-leaf-500">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {coach.weakVerticals?.length > 0 && (
              <div>
                <h3 className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Focus areas</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {coach.weakVerticals.map((vertical, index) => (
                    <span key={index} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-mono text-[11px] text-amber-700">{vertical}</span>
                  ))}
                </div>
              </div>
            )}

            {coach.nextSteps?.length > 0 && (
              <div>
                <h3 className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Next steps</h3>
                <ol className="mt-2 space-y-1.5">
                  {coach.nextSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 font-mono text-[10px] text-white">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {coach.suggestedActivities?.length > 0 && (
              <div>
                <h3 className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Suggested next</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {coach.suggestedActivities.map((activity, index) => (
                    <div key={index} className="rounded-md border border-rule bg-paper p-3">
                      <p className="truncate text-sm font-semibold text-ink">{activity.name}</p>
                      <p className="truncate font-mono text-[11px] text-slate-400">{activity.vertical}</p>
                      {activity.reason && <p className="mt-1 text-xs text-slate-500">{activity.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState icon="✦" title="No coaching yet" description="Submit some evidence and the AI coach will suggest what to do next." />
          </div>
        )}
      </Card>

      {/* Badges */}
      <Card className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Milestone Badges</h2>
            <p className="mt-1 text-sm text-slate-400">
              {earnedBadges.length} of {BADGES.length} earned
              {nextBadge && earnedBadges.length < BADGES.length ? ` · next up: ${nextBadge.label} (${nextBadge.hint})` : ' · all badges unlocked!'}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BADGES.map((badge) => {
            const earned = badge.check(badgeState)
            return (
              <div
                key={badge.key}
                className={`flex items-center gap-3 rounded-md border p-3 ${
                  earned ? 'border-amber-200 bg-amber-50/70' : 'border-rule bg-paper opacity-70'
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm ${earned ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                  {badge.icon}
                </span>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${earned ? 'text-amber-800' : 'text-slate-500'}`}>{badge.label}</p>
                  <p className="truncate font-mono text-[11px] text-slate-400">{earned ? 'Earned ✓' : badge.hint}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

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