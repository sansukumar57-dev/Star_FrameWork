import React, { useState } from 'react'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, Card, EmptyState, Input, LoadingState, StatusBadge, Toast } from './UI.jsx'
import {
  getTrendAnalytics,
  getAtRiskStudents,
  notifyAtRiskStudents,
  getFlaggedDuplicates,
  previewWeeklyDigest,
  sendWeeklyDigest,
  semanticSearch,
} from '../utils/api.js'

const TABS = [
  { key: 'trends', label: 'Trends' },
  { key: 'atRisk', label: 'At-Risk' },
  { key: 'duplicates', label: 'Duplicates' },
  { key: 'digest', label: 'Digest' },
  { key: 'search', label: 'Search' },
]

const LEVEL_TONE = { High: 'bg-rose-100 text-rose-700', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-sky-100 text-sky-700' }

export default function AiInsightsPanel() {
  const [tab, setTab] = useState('trends')
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-paper/60 px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">AI Insights</h2>
          <p className="text-sm text-slate-500">Trends, at-risk students, duplicates, digests and semantic search</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === item.key ? 'bg-brand-600 text-paper' : 'text-slate-500 hover:bg-slate-100 hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        {toast && <Toast message={toast} tone="info" onDismiss={() => setToast('')} />}
        {tab === 'trends' && <TrendsTab setToast={setToast} loading={loading} setLoading={setLoading} />}
        {tab === 'atRisk' && <AtRiskTab setToast={setToast} loading={loading} setLoading={setLoading} />}
        {tab === 'duplicates' && <DuplicatesTab setToast={setToast} loading={loading} setLoading={setLoading} />}
        {tab === 'digest' && <DigestTab setToast={setToast} loading={loading} setLoading={setLoading} />}
        {tab === 'search' && <SearchTab setToast={setToast} loading={loading} setLoading={setLoading} />}
      </div>
    </Card>
  )
}

function TrendsTab({ setToast, loading, setLoading }) {
  const [data, setData] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await getTrendAnalytics(6)
      setData(res.data || null)
    } catch (error) {
      setToast(error.message || 'Unable to load trends')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !data) return <LoadingState rows={2} />
  if (!data) return <EmptyState icon="📈" title="No trend data yet" description="Trends appear once approved submissions exist." action={<Button variant="outline" size="sm" onClick={load}>Refresh</Button>} />

  const chartData = (data.series || []).map((month) => ({ name: month.label, points: month.points }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Last {data.months} months · forecast next month: <span className="font-semibold text-ink">{data.forecast?.nextPoints}</span> points
        </p>
        <Button variant="outline" size="sm" onClick={load} loading={loading}>Refresh</Button>
      </div>
      {chartData.length > 0 && (
        <div className="h-56 rounded-md border border-rule bg-paper p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="points" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="rounded-md border border-rule bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
        {data.narrative?.text}
      </div>
    </div>
  )
}

function AtRiskTab({ setToast, loading, setLoading }) {
  const [data, setData] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await getAtRiskStudents()
      setData(res.data || null)
    } catch (error) {
      setToast(error.message || 'Unable to load at-risk students')
    } finally {
      setLoading(false)
    }
  }

  async function notify() {
    setLoading(true)
    try {
      const res = await notifyAtRiskStudents()
      setToast(`${res.data?.studentNotified || 0} students and ${res.data?.facultyNotified || 0} faculty notified`)
      load()
    } catch (error) {
      setToast(error.message || 'Unable to send notifications')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !data) return <LoadingState rows={2} />
  if (!data || !data.atRisk?.length) return <EmptyState icon="🛟" title="No at-risk students" description="Every active student is on track right now." action={<Button variant="outline" size="sm" onClick={load}>Refresh</Button>} />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-rose-600">{data.counts.high}</span> high · <span className="font-semibold text-amber-600">{data.counts.medium}</span> medium · <span className="font-semibold text-sky-600">{data.counts.low}</span> low
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} loading={loading}>Refresh</Button>
          <Button variant="primary" size="sm" onClick={notify} loading={loading}>Notify students & faculty</Button>
        </div>
      </div>
      {data.atRisk.map((entry) => (
        <div key={String(entry.studentId)} className="rounded-md border border-rule bg-paper p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-ink">{entry.name} <span className="text-xs font-normal text-slate-400">{entry.registerNo || ''}</span></p>
              <p className="text-xs text-slate-500">{entry.department || '—'} · {entry.totalPoints} points · {entry.currentStreak}-day streak</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${LEVEL_TONE[entry.level] || 'bg-slate-100 text-slate-600'}`}>{entry.level}</span>
          </div>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
            {entry.factors.map((factor, index) => <li key={index}>{factor}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}

function DuplicatesTab({ setToast, loading, setLoading }) {
  const [items, setItems] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await getFlaggedDuplicates()
      setItems(res.data || [])
    } catch (error) {
      setToast(error.message || 'Unable to load duplicates')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !items) return <LoadingState rows={2} />
  if (!items?.length) return <EmptyState icon="🖼️" title="No duplicate certificates" description="Submissions flagged for duplicate certificate images appear here." action={<Button variant="outline" size="sm" onClick={load}>Refresh</Button>} />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} flagged submission(s)</p>
        <Button variant="outline" size="sm" onClick={load} loading={loading}>Refresh</Button>
      </div>
      {items.map((item) => (
        <div key={String(item._id)} className="rounded-md border border-rose-200 bg-rose-50/60 p-4">
          <p className="font-medium text-ink">{item.activityId?.activityName || 'Activity'}</p>
          <p className="mt-1 text-sm text-slate-600">
            {item.studentId?.name || 'Student'} flagged — this certificate image matches another submission for the same activity.
          </p>
          <p className="mt-1 text-xs text-slate-400">Submitted {new Date(item.submittedAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  )
}

function DigestTab({ setToast, loading, setLoading }) {
  const [preview, setPreview] = useState(null)

  async function loadPreview() {
    setLoading(true)
    try {
      const res = await previewWeeklyDigest()
      setPreview(res.data || null)
    } catch (error) {
      setToast(error.message || 'Unable to generate preview')
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    setLoading(true)
    try {
      const res = await sendWeeklyDigest()
      setToast(`${res.data?.sent || 0} digest emails sent (${res.data?.skipped || 0} skipped)`)
    } catch (error) {
      setToast(error.message || 'Unable to send digest')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Weekly natural-language progress emails to students. Scheduled every {String(new Date().toLocaleDateString('en-IN', { weekday: 'long' }))} automatically.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPreview} loading={loading}>Preview</Button>
          <Button variant="primary" size="sm" onClick={send} loading={loading}>Send now</Button>
        </div>
      </div>
      {preview ? (
        <div className="rounded-md border border-rule bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{preview.student?.name} · {preview.context?.weekRange}</p>
          {preview.text}
        </div>
      ) : (
        <EmptyState icon="📧" title="No preview yet" description="Generate a sample weekly digest to see what students receive." action={<Button size="sm" onClick={loadPreview} loading={loading}>Generate preview</Button>} />
      )}
    </div>
  )
}

function SearchTab({ setToast, loading, setLoading }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)

  async function run() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    try {
      const res = await semanticSearch(q)
      setResult(res.data || null)
    } catch (error) {
      setToast(error.message || 'Unable to search')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') run() }}
          placeholder='Try "sports certificates from last year" or "pending mini project submissions"'
        />
        <Button onClick={run} loading={loading} className="shrink-0">Search</Button>
      </div>
      {!result && <EmptyState icon="🔎" title="Semantic search" description="Ask in plain language and the AI will find matching activities and submissions." />}
      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(result.parsed?.keywords || []).map((keyword, index) => (
              <span key={index} className="rounded-full bg-brand-100 px-2.5 py-1 font-medium text-brand-700">{keyword}</span>
            ))}
            {result.parsed?.vertical && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{result.parsed.vertical}</span>}
            {result.parsed?.status && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{result.parsed.status}</span>}
            {result.parsed?.year && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{result.parsed.year}</span>}
          </div>
          {result.activities?.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Activities</h3>
              <div className="space-y-2">
                {result.activities.map((activity) => (
                  <div key={String(activity.id)} className="rounded-md border border-rule bg-paper p-3 text-sm">
                    <p className="font-medium text-ink">{activity.name}</p>
                    <p className="text-xs text-slate-500">{activity.vertical} · up to {activity.maximumPoints} points{activity.deadline ? ` · due ${new Date(activity.deadline).toLocaleDateString()}` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.submissions?.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Submissions</h3>
              <div className="space-y-2">
                {result.submissions.map((submission) => (
                  <div key={String(submission.id)} className="rounded-md border border-rule bg-paper p-3 text-sm">
                    <p className="font-medium text-ink">{submission.activityName}</p>
                    <p className="text-xs text-slate-500">{submission.vertical} · <StatusBadge status={submission.status} /> · {submission.pointsAwarded || 0} pts · {new Date(submission.submittedAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!result.activities?.length && !result.submissions?.length && <EmptyState icon="🔎" title="No matches" description="Try different keywords or check the parsed filters above." />}
        </div>
      )}
    </div>
  )
}