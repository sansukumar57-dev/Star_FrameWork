import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import Shell from '../components/Shell.jsx'
import { StatCard, StatusBadge, Modal, Button, PageHeader, Card, Toast, EmptyState, LoadingState, Field, Input, Textarea, Select, ConfirmDialog } from '../components/UI.jsx'
import { getTeacherDashboard, getTeacherSubmissions, approveSubmission, rejectSubmission, getSubmissionFileBlob, runAiReview, applyAiReview, bulkApproveSubmissions, bulkRejectSubmissions, exportTeacherSubmissions } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

function EvidenceRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-rule bg-paper px-3 py-2.5 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-ink">{value}</span>
    </div>
  )
}

function isAwarded(sub) {
  const status = sub?.status
  return status === 'FacultyApproved' || status === 'HODApproved' || status === 'Approved'
}

function pointsFor(sub) {
  const awarded = sub?.pointsAwarded
  const suggested = sub?.suggestedPoints
  return isAwarded(sub) ? (awarded ?? suggested ?? 0) : (suggested ?? 0)
}

function pointsStateLabel(sub) {
  const status = sub?.status
  if (status === 'Rejected' || status === 'HODRejected') return 'Rejected'
  if (isAwarded(sub)) return 'Awarded marks'
  return 'Suggested marks'
}

function PointsTag({ sub }) {
  const status = sub?.status
  if (isAwarded(sub)) {
    return <span className="rounded-full bg-leaf-100 text-leaf-700 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]">Awarded</span>
  }
  if (status === 'Rejected' || status === 'HODRejected') {
    return <span className="rounded-full bg-rose-50 text-rose-600 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]">Rejected</span>
  }
  return <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]">Suggested</span>
}

const STATUS_TABS = [
  { key: 'Pending', label: 'To Review' },
  { key: 'FacultyApproved', label: 'Faculty Approved' },
  { key: 'Rejected', label: 'Rejected' },
]

export default function FacultyDashboard() {
  const [submissions, setSubmissions] = useState([])
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalStudents: 0, totalPointsAwarded: 0 })
  const [reviewing, setReviewing] = useState(null)
  const [score, setScore] = useState('')
  const [remarks, setRemarks] = useState('')
  const [reviewHistory, setReviewHistory] = useState([])
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedStudents, setExpandedStudents] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkConfirm, setBulkConfirm] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkRemarks, setBulkRemarks] = useState('')
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Pending')

  const currentUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])

  const loadCurrent = useCallback(async () => {
    const [submissionsRes, dashboardRes] = await Promise.all([getTeacherSubmissions(50, statusFilter), getTeacherDashboard()])
    setSubmissions(submissionsRes.data.submissions || [])
    setStats(dashboardRes.data)
  }, [statusFilter])

  useEffect(() => {
    let active = true
    loadCurrent()
      .catch((error) => { if (active) setToast({ message: error.message || 'Unable to load submissions', tone: 'error' }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [statusFilter, loadCurrent])

  const chartData = [
    { name: 'Pending', pct: stats.pending, fill: 'var(--color-amber-500)' },
    { name: 'Approved', pct: stats.approved, fill: 'var(--color-leaf-500)' },
    { name: 'Rejected', pct: stats.rejected, fill: 'var(--color-rose-500)' },
  ]

  const groupedSubmissions = useMemo(() => {
    const groups = []
    const groupsByKey = new Map()

    submissions.forEach((submission) => {
      const studentKey = submission?.studentId?._id || submission?.studentId
      const normalizedKey = studentKey?.toString?.() || `${submission?.studentId?.name || 'Student'}-${submission?.studentId?.registerNumber || ''}`

      if (!groupsByKey.has(normalizedKey)) {
        const newGroup = {
          key: normalizedKey,
          name: submission?.studentId?.name || 'Student',
          registerNumber: submission?.studentId?.registerNumber || '',
          submissions: []
        }

        groupsByKey.set(normalizedKey, newGroup)
        groups.push(newGroup)
      }

      groupsByKey.get(normalizedKey).submissions.push(submission)
    })

    return groups
  }, [submissions])

  function toggleStudent(studentKey) {
    setExpandedStudents((prev) => (
      prev.includes(studentKey)
        ? prev.filter((entry) => entry !== studentKey)
        : [...prev, studentKey]
    ))
  }

  const allSubmissionIds = useMemo(() => groupedSubmissions.flatMap((group) => group.submissions.map((s) => s._id)), [groupedSubmissions])
  const allSelected = allSubmissionIds.length > 0 && allSubmissionIds.every((id) => selectedIds.includes(id))

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : allSubmissionIds)
  }

  async function runBulkAction() {
    if (!bulkConfirm) return
    setBulkLoading(true)
    try {
      const ids = [...selectedIds]
      if (bulkConfirm.action === 'Rejected' && !bulkRemarks.trim()) {
        throw new Error('Rejection reason is required')
      }
      if (bulkConfirm.action === 'Approved') {
        await bulkApproveSubmissions(ids)
      } else {
        await bulkRejectSubmissions(ids, { teacherRemarks: bulkRemarks })
      }
      const removed = new Set(ids)
      setSubmissions((prev) => prev.filter((s) => !removed.has(s._id)))
      setSelectedIds([])
      setBulkRemarks('')
      setToast({ message: `${ids.length} submission${ids.length === 1 ? '' : 's'} ${bulkConfirm.action === 'Approved' ? 'approved' : 'rejected'}.`, tone: 'success' })
      loadCurrent().catch(() => {})
    } catch (error) {
      setToast({ message: error.message || 'Bulk action failed', tone: 'error' })
    } finally {
      setBulkLoading(false)
      setBulkConfirm(null)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportTeacherSubmissions('Pending')
    } catch (error) {
      setToast({ message: error.message || 'Export failed', tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  function openReview(sub) {
    const studentId = sub?.studentId?._id || sub?.studentId
    const siblingReviews = submissions.filter((entry) => {
      const entryStudentId = entry?.studentId?._id || entry?.studentId
      return entryStudentId && studentId && entryStudentId.toString() === studentId.toString()
    })
    setReviewHistory(siblingReviews)
    setReviewing(sub)
    setScore(String(pointsFor(sub)))
    setRemarks('')
  }

  function selectReview(event) {
    const selectedReviewId = event.target.value
    const selectedReview = submissions.find((entry) => entry._id === selectedReviewId)
    if (selectedReview) {
      setReviewing(selectedReview)
      setScore(String(pointsFor(selectedReview)))
      setRemarks('')
    }
  }

  async function decide(status) {
    if (!reviewing) return
    const id = reviewing._id

    try {
      if (status === 'Approved') {
        await approveSubmission(id, Number(score) || 0, remarks)
      } else {
        await rejectSubmission(id, remarks)
      }

      setSubmissions((prev) => prev.filter((s) => s._id !== id))
      setToast({ message: `Submission ${status.toLowerCase()} for ${reviewing.studentId?.name || 'student'}.`, tone: 'success' })
      setReviewing(null)
      loadCurrent().catch(() => {})
    } catch (error) {
      setToast({ message: error.message || 'Review action failed', tone: 'error' })
    }
  }

  async function openEvidence(submissionId) {
    try {
      const blob = await getSubmissionFileBlob(submissionId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setToast({ message: error.message || 'Unable to open evidence file', tone: 'error' })
    }
  }

  const AI_RECOMMENDATION_TONES = {
    Approve: 'bg-leaf-100 text-leaf-600',
    Reject: 'bg-rose-50 text-rose-600',
    Review: 'bg-amber-50 text-amber-600',
  }

  async function runAi() {
    if (!reviewing || aiLoading) return
    setAiLoading(true)
    try {
      const res = await runAiReview(reviewing._id)
      const review = res.data
      setReviewing((prev) => ({ ...prev, aiReview: review }))
      setSubmissions((prev) => prev.map((s) => (s._id === review.submissionId ? { ...s, aiReview: review } : s)))
      setToast({ message: `AI review ready (${review.provider || 'rule engine'}).`, tone: 'info' })
    } catch (error) {
      setToast({ message: error.message || 'AI review failed', tone: 'error' })
    } finally {
      setAiLoading(false)
    }
  }

  async function applyAi() {
    if (!reviewing) return
    try {
      const res = await applyAiReview(reviewing._id)
      const updated = res.data
      setReviewing((prev) => ({ ...prev, ...updated }))
      setSubmissions((prev) => prev.map((s) => (s._id === updated._id ? { ...s, ...updated } : s)))
      setScore(String(updated.suggestedPoints ?? 0))
      setRemarks(updated.teacherRemarks || '')
      setToast({ message: 'AI suggestion applied — review and confirm before approving.', tone: 'success' })
    } catch (error) {
      setToast({ message: error.message || 'Could not apply AI suggestion', tone: 'error' })
    }
  }

  if (loading) {
    return (
      <Shell role="faculty" userName={currentUser.name || 'Faculty'} department={currentUser.department || 'Department'}>
        <LoadingState rows={4} />
      </Shell>
    )
  }

  return (
    <Shell role="faculty" userName={currentUser.name || 'Faculty'} department={currentUser.department || 'Department'} badges={{ '/faculty/reviews': stats.pending }}>
      <PageHeader
        title="Faculty Review Dashboard"
        subtitle="Verify evidence, score submissions, and keep student STAR records up to date."
        actions={
          <Button variant="outline" onClick={handleExport} loading={exporting}>⬇ Export Excel</Button>
        }
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Pending Reviews" value={stats.pending} sub="Awaiting your action" accent="amber" />
        <StatCard label="Approved Tasks" value={stats.approved} sub="This term" accent="leaf" />
        <StatCard label="Rejected Tasks" value={stats.rejected} sub="Needs resubmission" accent="rose" />
        <StatCard label="Total Students" value={stats.totalStudents} sub="Registered learners" accent="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-6 border-b border-rule">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.key)
                  setSelectedIds([])
                  setExpandedStudents([])
                }}
                className={`relative pb-2 text-sm font-medium transition-colors ${
                  statusFilter === tab.key ? 'text-ink' : 'text-slate-500 hover:text-ink'
                }`}
              >
                {tab.label}
                {statusFilter === tab.key && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-500" />}
              </button>
            ))}
          </div>
          <h2 className="font-display text-lg font-semibold text-ink mb-3">Submissions</h2>
          {statusFilter === 'Pending' && selectedIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-200 bg-brand-50/70 px-4 py-3">
              <p className="text-sm font-medium text-ink">{selectedIds.length} selected</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>Clear</Button>
                <Button size="sm" variant="danger" onClick={() => setBulkConfirm({ action: 'Rejected' })}>Reject selected</Button>
                <Button size="sm" variant="success" onClick={() => setBulkConfirm({ action: 'Approved' })}>Approve selected</Button>
              </div>
            </div>
          )}
          {groupedSubmissions.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                  <tr>
                    <th className="w-12 px-5 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-brand-500"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all submissions"
                      />
                    </th>
                    <th className="text-left font-medium px-5 py-3">Student</th>
                    <th className="text-left font-medium px-5 py-3">Task</th>
                    <th className="text-left font-medium px-5 py-3">Status</th>
                    <th className="text-left font-medium px-5 py-3">Points</th>
                    <th className="text-right font-medium px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {groupedSubmissions.map((group) => {
                    const isMultiSubmission = group.submissions.length > 1
                    const isExpanded = expandedStudents.includes(group.key)

                    return (
                      <React.Fragment key={group.key}>
                        <tr className="border-b border-rule transition-colors hover:bg-paper/60">
                          <td className="px-5 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-brand-500"
                              checked={group.submissions.every((s) => selectedIds.includes(s._id))}
                              onChange={() => {
                                const ids = group.submissions.map((s) => s._id)
                                setSelectedIds((prev) => {
                                  const anySelected = ids.some((id) => prev.includes(id))
                                  return anySelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
                                })
                              }}
                              aria-label={`Select submissions for ${group.name}`}
                            />
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {isMultiSubmission ? (
                                <button
                                  type="button"
                                  onClick={() => toggleStudent(group.key)}
                                  aria-expanded={isExpanded}
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.1 1.04l-4.25 4.5a.75.75 0 01-1.1 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="h-6 w-6" />
                              )}
                              <div>
                                <p className="font-medium text-ink">{group.name}</p>
                                <p className="text-xs text-slate-400">{group.registerNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-600 max-w-[220px]">
                            {isMultiSubmission ? (
                              <span className="text-sm font-medium text-slate-600">{group.submissions.length} Submissions</span>
                            ) : (
                              <span className="truncate block">{group.submissions[0]?.activityId?.activityName || 'Activity'}</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {isMultiSubmission ? (
                              <span className="text-xs text-slate-400">Grouped</span>
                            ) : (
                              <StatusBadge status={group.submissions[0]?.status} />
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {isMultiSubmission ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="tabular font-medium text-slate-600">{pointsFor(group.submissions[0])} pts</span>
                                <PointsTag sub={group.submissions[0]} />
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {!isMultiSubmission && (
                              <Button size="sm" variant="outline" onClick={() => openReview(group.submissions[0])}>Review</Button>
                            )}
                          </td>
                        </tr>

                        {isMultiSubmission && isExpanded && group.submissions.map((submission) => (
                          <tr key={submission._id} className="border-b border-rule bg-paper/70">
                            <td className="px-8 py-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer accent-brand-500"
                                checked={selectedIds.includes(submission._id)}
                                onChange={() => toggleSelect(submission._id)}
                                aria-label={`Select submission ${submission.activityId?.activityName || ''}`}
                              />
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-brand-300" />
                                <div>
                                  <p className="text-sm font-medium text-ink">{submission.activityId?.activityName || 'Activity'}</p>
                                  <p className="text-xs text-slate-400">{submission.studentId?.registerNumber || ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-slate-600 max-w-[220px] truncate">{submission.activityId?.activityName || 'Activity'}</td>
                            <td className="px-5 py-3"><StatusBadge status={submission.status} /></td>
                            <td className="px-5 py-3">
                              <span className="flex items-center gap-2">
                                <span className="tabular font-medium text-slate-600">{pointsFor(submission)} pts</span>
                                <PointsTag sub={submission} />
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Button size="sm" variant="outline" onClick={() => openReview(submission)}>Review</Button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </Card>
          ) : (
            <EmptyState
              icon="✓"
              title={statusFilter === 'Pending' ? 'All caught up' : statusFilter === 'FacultyApproved' ? 'No approved submissions yet' : 'No rejected submissions'}
              description={statusFilter === 'Pending' ? 'There are no submissions waiting for your review right now.' : 'Submissions will appear here as they move through the review workflow.'}
            />
          )}
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-ink mb-3">Review Status</h2>
          <Card className="h-72 p-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="var(--color-rule)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-slate-400)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--color-slate-400)' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }} />
                <Bar dataKey="pct" radius={[3, 3, 0, 0]} maxBarSize={48}>
                  {chartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <p className="text-xs text-slate-400 mt-2">Submissions grouped by review status.</p>
        </div>
      </div>

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={`Review submission — ${reviewing?.studentId?.name || 'student'}`}
        footer={
          <>
            <Button variant="danger" onClick={() => decide('Rejected')}>Reject</Button>
            <Button variant="success" onClick={() => decide('Approved')}>Approve</Button>
          </>
        }
      >
        {reviewing && (
          <div className="space-y-4">
            {reviewHistory.length > 1 && (
              <div className="rounded-md border border-rule bg-paper p-4">
                <label className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Review history</label>
                <Select value={reviewing?._id || ''} onChange={selectReview} className="mt-2 !bg-card !border-rule">
                  {reviewHistory.map((entry) => (
                    <option key={entry._id} value={entry._id}>{entry.activityId?.activityName || 'Activity'} • {new Date(entry.submittedAt).toLocaleDateString()}</option>
                  ))}
                </Select>
              </div>
            )}

            <div className="rounded-md border border-rule p-4 space-y-2">
              <p className="text-sm font-semibold text-ink">{reviewing.activityId?.activityName || 'Activity'}</p>
              <EvidenceRow label="Student" value={reviewing.studentId?.name} />
              <EvidenceRow label="Register No." value={reviewing.studentId?.registerNumber || reviewing.studentId?.regNo} />
              <EvidenceRow label="Vertical" value={reviewing.activityId?.vertical || reviewing.vertical} />
              <EvidenceRow label="Activity type" value={reviewing.activityType || reviewing.visitType} />
              <EvidenceRow label="Level" value={reviewing.selectedLevel} />
              <EvidenceRow label="Duration" value={reviewing.durationWeeks} />
              <EvidenceRow label="Project URL" value={reviewing.projectUrl || reviewing.proofUrl} />
              {reviewing.description && (
                <p className="text-xs text-slate-400 mt-1">{reviewing.description}</p>
              )}
            </div>

            {reviewing?.certificateFile?.fileName && (
              <div className="rounded-md border border-rule bg-paper p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Stored evidence</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{reviewing.certificateFile.fileName}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEvidence(reviewing._id)}>Open file</Button>
              </div>
            )}

            <div className="rounded-md border border-rule bg-paper p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-brand-200 bg-brand-50 font-mono text-[10px] font-medium text-brand-600">AI</span>
                  <p className="text-sm font-semibold text-ink">Evidence Review</p>
                  {reviewing?.aiReview?.provider && (
                    <span className="rounded-full bg-brand-100 text-brand-600 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]">
                      {reviewing.aiReview.provider}
                    </span>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={runAi} loading={aiLoading}>
                  {reviewing?.aiReview ? 'Re-run' : 'Run AI review'}
                </Button>
              </div>

              {aiLoading ? (
                <p className="text-xs text-slate-400 animate-pulse">Analyzing evidence and submission details…</p>
              ) : reviewing?.aiReview ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${AI_RECOMMENDATION_TONES[reviewing.aiReview.recommendation] || 'bg-slate-100 text-slate-600'}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {reviewing.aiReview.recommendation}
                    </span>
                    <span className="text-xs text-slate-500">
                      {reviewing.aiReview.suggestedPoints} SP suggested · {reviewing.aiReview.confidence}% confidence
                    </span>
                  </div>
                  {reviewing.aiReview.reasoning && (
                    <p className="text-sm text-slate-600 leading-relaxed">{reviewing.aiReview.reasoning}</p>
                  )}
                  {Array.isArray(reviewing.aiReview.flags) && reviewing.aiReview.flags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {reviewing.aiReview.flags.map((flag, index) => (
                        <span key={index} className="rounded-md bg-card border border-amber-200 text-amber-700 text-xs px-2 py-1">
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={applyAi}>Use suggested score & reasoning</Button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400">
                  No AI review yet. Run the AI evidence reviewer to get an approve/reject/review recommendation.
                </p>
              )}
            </div>

            <div className="rounded-md border border-rule bg-paper p-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">{pointsStateLabel(reviewing)}</p>
              <p className="text-lg font-semibold text-ink">{pointsFor(reviewing)} SP</p>
            </div>

            <Field label="Final marks">
              <Input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Remarks" hint="This feedback will be visible to the student.">
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Add feedback for the student..."
              />
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
            ? `Approve ${selectedIds.length} selected submission(s)? Each will use its suggested marks and become pending HOD verification.`
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
    </Shell>
  )
}
