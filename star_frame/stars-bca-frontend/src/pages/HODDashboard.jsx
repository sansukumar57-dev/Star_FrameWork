import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Shell from '../components/Shell.jsx'
import { StatCard, Modal, Button, PageHeader, Card, Toast, ConfirmDialog, EmptyState, LoadingState, Field, Input, Textarea } from '../components/UI.jsx'
import { getHodSubmissions, getHodDashboard, verifyHodSubmission, bulkVerifyHodSubmissions, lockSemester, unlockSemester, getSubmissionFileBlob, exportHodSubmissions, runHodAiReview } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

function HODHome({ stats, pendingList }) {
  return (
    <div className="space-y-6">
      <PageHeader title="HOD Dashboard" subtitle="Verify faculty-approved submissions and manage your department." />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Pending HOD Approval" value={stats.pendingHOD} sub="Awaiting your review" accent="amber" />
        <StatCard label="Approved" value={stats.approved} sub="This term" accent="leaf" />
        <StatCard label="Rejected" value={stats.rejected} sub="Needs resubmission" accent="rose" />
        <StatCard label="Total Students" value={stats.totalStudents} sub="In your department" accent="brand" />
      </div>
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

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
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

      <Card className="p-6 max-w-lg">
        <Field label="Batch (optional)" hint="Leave empty to apply to all batches.">
          <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="e.g. 2023-2026" />
        </Field>
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
  const [aiReviewing, setAiReviewing] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
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
      notify('AI review complete')
    } catch (err) {
      notify(err.message || 'AI review failed', 'error')
    } finally {
      setAiReviewing(false)
    }
  }

  if (loading) return <LoadingState rows={4} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verify Submissions"
        subtitle="Faculty-approved submissions awaiting your final verification."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant={flagged ? 'brand' : 'outline'} onClick={() => setFlagged((prev) => !prev)}>
              {flagged ? '✓ Showing flagged' : '⚑ Flagged only'}
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
                <th className="text-left font-medium px-4 py-3">Suggested</th>
                <th className="text-right font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
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
        <Route path="*" element={<Navigate to="/hod" replace />} />
      </Routes>
    </Shell>
  )
}

function HODHomeWrapper() {
  const [stats, setStats] = useState({ pendingHOD: 0, approved: 0, rejected: 0, totalStudents: 0 })
  const [pendingList, setPendingList] = useState([])
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

  if (loading) return <LoadingState rows={3} />
  if (toast) return <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
  return <HODHome stats={stats} pendingList={pendingList} />
}
