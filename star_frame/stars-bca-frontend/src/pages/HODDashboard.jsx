import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import Shell from '../components/Shell.jsx'
import { StatCard, Modal, Button, PageHeader, Card, Toast, ConfirmDialog, EmptyState, LoadingState, Field, Input, Textarea } from '../components/UI.jsx'
import { getHodSubmissions, getHodDashboard, verifyHodSubmission, bulkVerifyHodSubmissions, lockSemester, unlockSemester, getSubmissionFileBlob, exportHodSubmissions, runHodAiReview, getDepartmentLeaderboard, getHodSemesterStatus } from '../utils/api.js'
import PrincipalDashboard from './PrincipalDashboard.jsx'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

function formatSubmittedCell(submittedAt) {
  if (!submittedAt) return '—'
  const date = new Date(submittedAt)
  const days = Math.max(1, Math.round((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)))
  return (
    <>
      {date.toLocaleDateString()}
      <span className="block text-[11px] text-slate-400">{days}d waiting</span>
    </>
  )
}

const HOD_CHART_FILLS = ['var(--color-brand-500)', 'var(--color-leaf-500)', 'var(--color-amber-500)', 'var(--color-rose-400)', 'var(--color-sky-500)', 'var(--color-violet-500)']

function HODHome({ stats, pendingList, leaderboard, leaderboardLoading }) {
  const [exporting, setExporting] = useState(false)
  const [verticalChart, setVerticalChart] = useState([])
  const [facultyPerformance, setFacultyPerformance] = useState([])

  useEffect(() => {
    const counts = new Map()
    pendingList.forEach((sub) => {
      const vertical = sub.activityId?.vertical || sub.vertical || 'Other'
      counts.set(vertical, (counts.get(vertical) || 0) + 1)
    })
    setVerticalChart(
      Array.from(counts.entries())
        .map(([name, count], index) => ({ name, count, fill: HOD_CHART_FILLS[index % HOD_CHART_FILLS.length] }))
        .sort((a, b) => b.count - a.count)
    )

    const faculty = new Map()
    pendingList.forEach((sub) => {
      const name = sub.verifiedBy?.name || 'Faculty'
      const entry = faculty.get(name) || { name, submissions: 0, points: 0 }
      entry.submissions += 1
      entry.points += Number(sub.suggestedPoints) || 0
      faculty.set(name, entry)
    })
    setFacultyPerformance(Array.from(faculty.values()).sort((a, b) => b.submissions - a.submissions))
  }, [pendingList])

  async function handleExport() {
    setExporting(true)
    try {
      await exportHodSubmissions('FacultyApproved')
    } catch {
      // swallow — download helper surfaces failures
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HOD Dashboard"
        subtitle="Verify faculty-approved submissions and manage your department."
        actions={<Button variant="outline" onClick={handleExport} loading={exporting}>⬇ Export Excel</Button>}
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Pending HOD Approval" value={stats.pendingHOD} sub="Awaiting your review" accent="amber" />
        <StatCard label="Approved" value={stats.approved} sub="This term" accent="leaf" />
        <StatCard label="Rejected" value={stats.rejected} sub="Needs resubmission" accent="rose" />
        <StatCard label="Total Students" value={stats.totalStudents} sub="In your department" accent="brand" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold text-ink mb-3">Review Status</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Pending', pct: stats.pendingHOD, fill: 'var(--color-amber-500)' },
                { name: 'Approved', pct: stats.approved, fill: 'var(--color-leaf-500)' },
                { name: 'Rejected', pct: stats.rejected, fill: 'var(--color-rose-500)' },
              ]}>
                <CartesianGrid vertical={false} stroke="var(--color-rule)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-slate-400)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--color-slate-400)' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }} />
                <Bar dataKey="pct" radius={[3, 3, 0, 0]} maxBarSize={48}>
                  {[{ name: 'Pending' }, { name: 'Approved' }, { name: 'Rejected' }].map((entry) => (
                    <Cell key={entry.name} fill={({ 'Pending': 'var(--color-amber-500)', 'Approved': 'var(--color-leaf-500)', 'Rejected': 'var(--color-rose-500)' })[entry.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold text-ink mb-3">Pending by Vertical</h2>
          {verticalChart.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={verticalChart} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid horizontal={false} stroke="var(--color-rule)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-slate-400)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} axisLine={false} tickLine={false} width={96} />
                  <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }} />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={18}>
                    {verticalChart.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon="▦" title="No pending data" description="Pending submissions will appear grouped by vertical." />
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold text-ink mb-3">Faculty Performance</h2>
        {facultyPerformance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                <tr>
                  <th className="text-left font-medium px-3 py-2.5">Faculty</th>
                  <th className="text-left font-medium px-3 py-2.5">Pending submissions</th>
                  <th className="text-left font-medium px-3 py-2.5">Suggested points</th>
                </tr>
              </thead>
              <tbody>
                {facultyPerformance.map((faculty) => (
                  <tr key={faculty.name} className="border-b border-rule">
                    <td className="px-3 py-2.5 font-medium text-ink">{faculty.name}</td>
                    <td className="px-3 py-2.5 text-slate-600">{faculty.submissions}</td>
                    <td className="px-3 py-2.5 text-slate-600">{faculty.points} SP</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="▤" title="No faculty data" description="Faculty-verified submissions will appear here." />
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold text-ink mb-3">Department Leaderboard</h2>
        {leaderboardLoading ? (
          <LoadingState rows={3} />
        ) : leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((student, index) => (
              <div key={student._id || student.userId || index} className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[10px] font-medium text-paper">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{student.name || 'Student'}</p>
                    <p className="font-mono text-[11px] text-slate-400">{student.registerNumber || ''}</p>
                  </div>
                </div>
                <span className="shrink-0 font-display text-lg font-semibold text-ink">{student.totalPoints || student.points || 0}<span className="text-xs font-normal text-slate-400"> pts</span></span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="★" title="No leaderboard data" description="Students appear here as they earn approved STAR points." />
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold text-ink mb-3">Pending HOD Verification</h2>
        {pendingList.length > 0 ? (
          <PendingTable submissions={pendingList} />
        ) : (
          <EmptyState icon="✓" title="No submissions pending" description="Nothing is waiting for your HOD approval right now." />
        )}
      </Card>
    </div>
  )
}

function PendingTable({ submissions }) {
  const navigate = useNavigate()
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
          <tr>
            <th className="text-left font-medium px-3 py-2.5">Student</th>
            <th className="text-left font-medium px-3 py-2.5">Activity</th>
            <th className="text-left font-medium px-3 py-2.5">Faculty Verified</th>
            <th className="text-right font-medium px-3 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((sub) => (
            <tr key={sub._id} className="border-b border-rule transition-colors hover:bg-paper/60">
              <td className="px-3 py-2.5">
                <p className="font-medium text-ink">{sub.studentId?.name || 'Student'}</p>
                <p className="text-xs text-slate-400">{sub.studentId?.regNo || sub.studentId?.registerNumber || ''}</p>
              </td>
              <td className="px-3 py-2.5 text-slate-600">{sub.activityId?.activityName || 'Activity'}</td>
              <td className="px-3 py-2.5 text-slate-600">{sub.verifiedBy?.name || 'Faculty'}</td>
              <td className="px-3 py-2.5 text-right">
                <Button size="sm" variant="outline" onClick={() => navigate(`/hod/verify?review=${sub._id}`)}>Review</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SemesterLockPage() {
  const [batch, setBatch] = useState('')
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    if (tone !== 'error') window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    let active = true
    getHodSemesterStatus()
      .then((res) => { if (active) setStatus(res.data) })
      .catch(() => { if (active) setStatus(null) })
      .finally(() => { if (active) setStatusLoading(false) })
    return () => { active = false }
  }, [])

  async function runLockAction(action) {
    try {
      if (action === 'lock') {
        await lockSemester(batch)
        notify(batch ? `Semester locked for batch ${batch}.` : 'Semester locked for all batches.')
      } else {
        await unlockSemester(batch)
        notify(batch ? `Semester unlocked for batch ${batch}.` : 'Semester unlocked for all batches.')
      }
      const res = await getHodSemesterStatus()
      setStatus(res.data)
    } catch (err) {
      notify(err.message || `Unable to ${action} the semester`, 'error')
    } finally {
      setConfirm(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Semester Lock" subtitle="Lock or unlock semester submissions for students in your department." />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      {!statusLoading && status && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Semester status</p>
            <p className={`mt-2 font-display text-2xl font-semibold ${status.locked ? 'text-rose-600' : 'text-leaf-600'}`}>
              {status.locked ? '🔒 Locked' : 'Unlocked'}
            </p>
            <p className="mt-1 text-xs text-slate-400">{status.locked} of {status.total || 0} batch(es) locked.</p>
          </Card>
          <Card className="p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Locked batches</p>
            <p className="mt-2 font-display text-2xl font-semibold text-ink">{status.locked}</p>
            <p className="mt-1 text-xs text-slate-400">Currently locked for submissions.</p>
          </Card>
          <Card className="p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Open batches</p>
            <p className="mt-2 font-display text-2xl font-semibold text-ink">{status.unlocked}</p>
            <p className="mt-1 text-xs text-slate-400">Students can still submit evidence.</p>
          </Card>
        </div>
      )}

      <Card className="p-6 max-w-lg">
        <Field label="Batch (optional)" hint="Leave empty to apply to all batches.">
          <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="e.g. 2023-2026" />
        </Field>
        {!statusLoading && status?.batches?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {status.batches.map((item) => (
              <span
                key={item.name}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                  item.locked ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-leaf-200 bg-leaf-50 text-leaf-700'
                }`}
              >
                {item.name}: {item.locked ? 'locked' : 'open'}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <Button
            variant="danger"
            onClick={() => setConfirm({ action: 'lock', title: 'Lock semester', message: `Lock semester submissions${batch ? ` for batch ${batch}` : ' for all batches'}? Students will not be able to submit or resubmit activities.` })}
          >
            Lock Semester
          </Button>
          <Button
            variant="success"
            onClick={() => setConfirm({ action: 'unlock', title: 'Unlock semester', message: `Unlock semester submissions${batch ? ` for batch ${batch}` : ' for all batches'}?` })}
          >
            Unlock Semester
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-4">When locked, students cannot submit or resubmit activities.</p>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.action === 'lock' ? 'Lock' : 'Unlock'}
        tone={confirm?.action === 'lock' ? 'danger' : 'success'}
        onConfirm={() => runLockAction(confirm.action)}
      />
    </div>
  )
}

function VerifyPage() {
  const [submissions, setSubmissions] = useState([])
  const [, setStats] = useState({ pendingHOD: 0, approved: 0, rejected: 0, totalStudents: 0 })
  const [reviewing, setReviewing] = useState(null)
  const [score, setScore] = useState('')
  const [remarks, setRemarks] = useState('')
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkConfirm, setBulkConfirm] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkRemarks, setBulkRemarks] = useState('')
  const [flagged, setFlagged] = useState(false)
  const [flaggedCount, setFlaggedCount] = useState(0)
  const [aiReviewing, setAiReviewing] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [search, setSearch] = useState('')

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    if (tone !== 'error') window.setTimeout(() => setToast(null), 3200)
  }, [])

  const allSelected = submissions.length > 0 && submissions.every((s) => selectedIds.includes(s._id))

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : submissions.map((s) => s._id))
  }

  async function runBulkAction() {
    if (!bulkConfirm) return
    setBulkLoading(true)
    try {
      const ids = [...selectedIds]
      if (bulkConfirm.action === 'Rejected' && !bulkRemarks.trim()) {
        throw new Error('Rejection reason is required')
      }
      await bulkVerifyHodSubmissions(ids, bulkConfirm.action, bulkConfirm.action === 'Rejected' ? { hodRemarks: bulkRemarks } : {})
      const removed = new Set(ids)
      setSubmissions((prev) => prev.filter((s) => !removed.has(s._id)))
      setSelectedIds([])
      setBulkRemarks('')
      notify(`${ids.length} submission${ids.length === 1 ? '' : 's'} ${bulkConfirm.action === 'Approved' ? 'approved' : 'rejected'}`)
    } catch (err) {
      notify(err.message || 'Bulk verification failed', 'error')
    } finally {
      setBulkLoading(false)
      setBulkConfirm(null)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [subData, statsData] = await Promise.all([getHodSubmissions(50, flagged), getHodDashboard()])
        setSubmissions(subData.data.submissions || [])
        setFlaggedCount(subData.data.flaggedCount || 0)
        setStats(statsData.data)
      } catch (err) {
        notify(err.message || 'Unable to load submissions', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagged])

  async function handleVerify(status) {
    if (!reviewing) return
    try {
      await verifyHodSubmission(
        reviewing._id,
        status,
        status === 'Approved'
          ? { pointsAwarded: Number(score) || reviewing.suggestedPoints, hodRemarks: remarks }
          : { hodRemarks: remarks }
      )
      setSubmissions((prev) => prev.filter((s) => s._id !== reviewing._id))
      notify(`Submission ${status.toLowerCase()} successfully`)
      setReviewing(null)
    } catch (err) {
      notify(err.message || 'Verification failed', 'error')
    }
  }

  async function openEvidence(submissionId) {
    try {
      const blob = await getSubmissionFileBlob(submissionId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      notify(error.message || 'Unable to open evidence file', 'error')
    }
  }

  function openReview(sub) {
    setReviewing(sub)
    setScore(String(sub.suggestedPoints || sub.pointsAwarded || 0))
    setRemarks('')
    setAiResult(null)
  }

  async function handleAiReview() {
    if (!reviewing) return
    setAiReviewing(true)
    setAiResult(null)
    try {
      const res = await runHodAiReview(reviewing._id)
      setAiResult(res.data)
      if (res.data?.suggestedPoints !== undefined && res.data?.suggestedPoints !== null) {
        setScore(String(res.data.suggestedPoints))
      }
      notify('AI review complete')
    } catch (err) {
      notify(err.message || 'AI review failed', 'error')
    } finally {
      setAiReviewing(false)
    }
  }

  const filteredSubmissions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return submissions
    return submissions.filter((sub) => {
      const searchable = `${sub.studentId?.name || ''} ${sub.studentId?.regNo || ''} ${sub.studentId?.registerNumber || ''} ${sub.activityId?.activityName || ''} ${sub.verifiedBy?.name || ''}`.toLowerCase()
      return searchable.includes(term)
    })
  }, [submissions, search])

  if (loading) return <LoadingState rows={4} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verify Submissions"
        subtitle="Faculty-approved submissions awaiting your final verification."
        crumbs={['HOD', 'Verify Submissions']}
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, activity, faculty"
              className="!w-auto !min-w-[200px] !bg-card !border-rule"
            />
            <Button size="sm" variant={flagged ? 'brand' : 'outline'} onClick={() => setFlagged((prev) => !prev)}>
              {flagged ? '✓ Showing flagged' : `⚑ Flagged only (${flaggedCount})`}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportHodSubmissions('FacultyApproved')}>⬇ Export Excel</Button>
          </div>
        }
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      {submissions.length > 0 ? (
        <Card className="overflow-hidden">
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200 bg-brand-50/70 px-4 py-3">
              <p className="text-sm font-medium text-ink">{selectedIds.length} selected</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>Clear</Button>
                <Button size="sm" variant="danger" onClick={() => setBulkConfirm({ action: 'Rejected' })}>Reject selected</Button>
                <Button size="sm" variant="success" onClick={() => setBulkConfirm({ action: 'Approved' })}>Approve selected</Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-brand-500"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all submissions"
                  />
                </th>
                <th className="text-left font-medium px-4 py-3">Student</th>
                <th className="text-left font-medium px-4 py-3">Activity</th>
                <th className="text-left font-medium px-4 py-3">Verified by</th>
                <th className="text-left font-medium px-4 py-3">Submitted</th>
                <th className="text-left font-medium px-4 py-3">Suggested</th>
                <th className="text-right font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub) => (
<tr key={sub._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-brand-500"
                      checked={selectedIds.includes(sub._id)}
                      onChange={() => toggleSelect(sub._id)}
                      aria-label={`Select submission for ${sub.studentId?.name || 'student'}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{sub.studentId?.name || 'Student'}</p>
                    <p className="text-xs text-slate-400">{sub.studentId?.regNo || sub.studentId?.registerNumber || ''}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{sub.activityId?.activityName || 'Activity'}</td>
                  <td className="px-4 py-3 text-slate-600">{sub.verifiedBy?.name || 'Faculty'}</td>
                  <td className="tabular px-4 py-3 text-slate-500">{formatSubmittedCell(sub.submittedAt)}</td>
                  <td className="px-4 py-3 text-slate-500">{sub.suggestedPoints || 0} SP</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => openReview(sub)}>Review</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      ) : search ? (
        <EmptyState icon="⌕" title="No matches" description="No submissions match your search." />
      ) : (
        <EmptyState icon="✓" title="Nothing to verify" description="No submissions are pending HOD approval right now." />
      )}

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={`Verify — ${reviewing?.studentId?.name || ''}`}
        footer={
          <>
            <Button variant="danger" onClick={() => handleVerify('Rejected')}>Reject</Button>
            <Button variant="success" onClick={() => handleVerify('Approved')}>Approve</Button>
          </>
        }
      >
        {reviewing && (
          <div className="space-y-4">
            <div className="rounded-md border border-rule p-4 space-y-2">
              <p className="text-sm font-semibold text-ink">{reviewing.activityId?.activityName}</p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-md border border-rule bg-paper px-3 py-2.5">
                  <p className="text-xs text-slate-400">Student</p>
                  <p className="font-medium text-ink">{reviewing.studentId?.name || 'Student'}</p>
                </div>
                <div className="rounded-md border border-rule bg-paper px-3 py-2.5">
                  <p className="text-xs text-slate-400">Verified by</p>
                  <p className="font-medium text-ink">{reviewing.verifiedBy?.name || 'Faculty'}</p>
                </div>
                {reviewing.selectedLevel && (
                  <div className="rounded-md border border-rule bg-paper px-3 py-2.5">
                    <p className="text-xs text-slate-400">Level</p>
                    <p className="font-medium text-ink">{reviewing.selectedLevel}</p>
                  </div>
                )}
                {reviewing.durationWeeks && (
                  <div className="rounded-md border border-rule bg-paper px-3 py-2.5">
                    <p className="text-xs text-slate-400">Duration</p>
                    <p className="font-medium text-ink">{reviewing.durationWeeks}</p>
                  </div>
                )}
                {reviewing.activityType && (
                  <div className="rounded-md border border-rule bg-paper px-3 py-2.5">
                    <p className="text-xs text-slate-400">Activity type</p>
                    <p className="font-medium text-ink">{reviewing.activityType}</p>
                  </div>
                )}
                {reviewing.projectUrl && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5 sm:col-span-2">
                    <p className="text-xs text-slate-400">Project URL</p>
                    <a href={reviewing.projectUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-500 hover:underline break-all">{reviewing.projectUrl}</a>
                  </div>
                )}
              </div>
              {reviewing.description && <p className="text-xs text-slate-400">{reviewing.description}</p>}
            </div>

            {reviewing?.certificateFile?.fileName && (
              <div className="rounded-md border border-rule bg-paper p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Evidence file</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{reviewing.certificateFile.fileName}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEvidence(reviewing._id)}>Open file</Button>
              </div>
            )}

            <div className="rounded-md border border-rule bg-paper p-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">Faculty suggested marks</p>
              <p className="text-lg font-semibold text-ink">{reviewing.suggestedPoints || 0} SP</p>
            </div>

            <div className="rounded-md border border-rule bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">AI-assisted review</p>
                  <p className="text-xs text-slate-400 mt-0.5">Runs the STAR rule engine / Gemini on the submission evidence.</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleAiReview} loading={aiReviewing}>Run AI review</Button>
              </div>
              {aiResult && (
                <div className="mt-3 space-y-2 rounded-md border border-rule bg-paper p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${
                      aiResult.recommendation === 'Approve' ? 'bg-leaf-50 text-leaf-600' : aiResult.recommendation === 'Reject' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {aiResult.recommendation || 'Review'}
                    </span>
                    {aiResult.confidence !== undefined && aiResult.confidence !== null && (
                      <span className="font-mono text-xs text-slate-500">confidence {aiResult.confidence}%</span>
                    )}
                  </div>
                  {aiResult.suggestedPoints !== undefined && aiResult.suggestedPoints !== null && (
                    <p className="text-sm text-slate-600">Suggested points: <span className="font-medium text-ink">{aiResult.suggestedPoints}</span></p>
                  )}
                  {aiResult.reasoning && <p className="text-sm text-slate-500">{aiResult.reasoning}</p>}
                </div>
              )}
            </div>

            {reviewing.teacherRemarks && (
              <div className="rounded-md border border-rule bg-paper p-4 space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">Faculty feedback</p>
                <p className="text-sm text-slate-600">{reviewing.teacherRemarks}</p>
              </div>
            )}

            <Field label="Final marks">
              <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Remarks" hint="This feedback will be visible to the student.">
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Add remarks..." />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!bulkConfirm}
        onClose={() => { setBulkConfirm(null); setBulkRemarks('') }}
        title={bulkConfirm?.action === 'Approved' ? 'Bulk approve submissions' : 'Bulk reject submissions'}
        message={
          bulkConfirm?.action === 'Approved'
            ? `Approve ${selectedIds.length} selected submission(s)? Each will use the faculty-suggested marks.`
            : `Reject ${selectedIds.length} selected submission(s)? Students will be asked to resubmit with clearer evidence.`
        }
        confirmLabel={bulkConfirm?.action === 'Approved' ? 'Approve' : 'Reject'}
        tone={bulkConfirm?.action === 'Approved' ? 'success' : 'danger'}
        onConfirm={runBulkAction}
        loading={bulkLoading}
        inputLabel={bulkConfirm?.action === 'Rejected' ? 'Rejection reason' : undefined}
        inputValue={bulkRemarks}
        onInputChange={setBulkRemarks}
        inputPlaceholder={bulkConfirm?.action === 'Rejected' ? 'Explain why submissions are being rejected…' : undefined}
      />
    </div>
  )
}

export default function HODDashboard() {
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])
  const [pendingHOD, setPendingHOD] = useState(0)

  useEffect(() => {
    getHodDashboard()
      .then((res) => setPendingHOD(res.data?.pendingHOD ?? 0))
      .catch(() => {})
  }, [])

  return (
    <Shell role="hod" userName={currentUser.name || 'HOD'} department={currentUser.department || 'Department'} badges={{ '/hod/verify': pendingHOD }}>
      <Routes>
        <Route path="" element={<HODHomeWrapper />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="semester" element={<SemesterLockPage />} />
        <Route path="users" element={<PrincipalDashboard embedded />} />
        <Route path="*" element={<Navigate to="/hod" replace />} />
      </Routes>
    </Shell>
  )
}

function HODHomeWrapper() {
  const [stats, setStats] = useState({ pendingHOD: 0, approved: 0, rejected: 0, totalStudents: 0 })
  const [pendingList, setPendingList] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [statsData, subData] = await Promise.all([getHodDashboard(), getHodSubmissions(10)])
        setStats(statsData.data)
        setPendingList(subData.data.submissions || [])
      } catch (err) {
        setToast({ message: err.message || 'Unable to load dashboard', tone: 'error' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    let active = true
    async function loadLeaderboard() {
      try {
        const user = JSON.parse(localStorage.getItem('stars_user') || '{}')
        const departmentId = user.departmentId || user.department
        if (!departmentId) return
        const res = await getDepartmentLeaderboard(departmentId, '', 10)
        if (active) setLeaderboard(res.data?.leaderboard || res.data || [])
      } catch {
        if (active) setLeaderboard([])
      } finally {
        if (active) setLeaderboardLoading(false)
      }
    }
    loadLeaderboard()
    return () => { active = false }
  }, [])

  if (loading) return <LoadingState rows={3} />
  if (toast) return <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
  return <HODHome stats={stats} pendingList={pendingList} leaderboard={leaderboard} leaderboardLoading={leaderboardLoading} />
}
