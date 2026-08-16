import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Routes, Route, Navigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import Shell from '../components/Shell.jsx'
import { StatCard, StatusBadge, Modal, Button, PageHeader, Card, Toast, EmptyState, LoadingState, Field, Input, Textarea, Select, ConfirmDialog } from '../components/UI.jsx'
import CommentThread from '../components/CommentThread.jsx'
import FacultyProfileModal from './FacultyProfileModal.jsx'
import { getTeacherDashboard, getTeacherSubmissions, getTeacherStudents, updateTeacherStudentRecords, bulkUpdateTeacherStudentRecords, deleteTeacherStudent, approveSubmission, rejectSubmission, getSubmissionFileBlob, runAiReview, applyAiReview, bulkApproveSubmissions, bulkRejectSubmissions, exportTeacherSubmissions, downloadTeacherReport, bulkImportStudents, getAiClearedCount, autoApproveAiCleared } from '../utils/api.js'

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

function daysWaiting(sub) {
  if (!sub?.submittedAt) return 0
  const diff = Date.now() - new Date(sub.submittedAt).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
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

const REMARK_TEMPLATES = [
  { label: 'Approve', text: 'Evidence verified and meets the activity requirements. Well done — keep it up.' },
  { label: 'Good work', text: 'Clear, verifiable evidence submitted. Good effort — continue building your STAR portfolio.' },
  { label: 'Minor fixes', text: 'Evidence is mostly complete, but please provide a clearer, dated proof (certificate/screenshot) for this activity.' },
  { label: 'Reject', text: 'The submitted evidence does not clearly match the activity requirements. Please re-read the activity description and resubmit with appropriate proof.' },
]

const VERTICAL_FILLS = ['var(--color-brand-500)', 'var(--color-leaf-500)', 'var(--color-amber-500)', 'var(--color-rose-400)', 'var(--color-sky-500)', 'var(--color-violet-500)', 'var(--color-slate-500)', 'var(--color-teal-500)']

export default function FacultyDashboard() {
  const currentUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])
  const [pendingCount, setPendingCount] = useState(0)
  const [aiClearedBadge, setAiClearedBadge] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const [facultyName, setFacultyName] = useState(currentUser.name || 'Faculty')

  useEffect(() => {
    getTeacherDashboard().then((res) => setPendingCount(res.data?.pending ?? 0)).catch(() => {})
    getAiClearedCount().then((res) => setAiClearedBadge(res.data?.count || 0)).catch(() => {})
  }, [])

  function handleProfileUpdate(updated) {
    const nextName = updated?.name || facultyName
    setFacultyName(nextName)
    try {
      const saved = JSON.parse(localStorage.getItem('stars_user') || '{}')
      localStorage.setItem('stars_user', JSON.stringify({ ...saved, name: nextName }))
    } catch { /* ignore */ }
  }

  return (
    <Shell role="faculty" userName={facultyName} department={currentUser.department || 'Department'} profileTrigger={() => setProfileOpen(true)} badges={{ '/faculty/reviews': pendingCount }}>
      <Routes>
        <Route path="" element={<FacultyHome />} />
        <Route path="reviews" element={<ReviewsPage aiClearedBadge={aiClearedBadge} setAiClearedBadge={setAiClearedBadge} setPendingCount={setPendingCount} />} />
        <Route path="*" element={<Navigate to="/faculty" replace />} />
      </Routes>
      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="">
        <FacultyProfileModal user={currentUser} onProfileUpdate={handleProfileUpdate} />
      </Modal>
    </Shell>
  )
}

function FacultyHome() {
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalStudents: 0, topStudents: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTeacherDashboard()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState rows={3} />

  return (
    <div className="space-y-6">
      <PageHeader title="Faculty Dashboard" subtitle="Overview of your review queue and student performance." />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Pending Reviews" value={stats.pending} sub="Awaiting your action" accent="amber" />
        <StatCard label="Approved Tasks" value={stats.approved} sub="This term" accent="leaf" />
        <StatCard label="Rejected Tasks" value={stats.rejected} sub="Needs resubmission" accent="rose" />
        <StatCard label="Total Students" value={stats.totalStudents} sub="Registered learners" accent="brand" />
      </div>
      {(stats.topStudents || []).length > 0 && (
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold text-ink mb-3">Top Students</h2>
          <p className="text-sm text-slate-400 mb-3">Ranked by approved STAR points.</p>
          <div className="space-y-2">
            {stats.topStudents.map((student, index) => (
              <div key={student._id} className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[10px] font-medium text-paper">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{student.name}</p>
                    <p className="font-mono text-[11px] text-slate-400">{student.registerNumber || student.section || ''}</p>
                  </div>
                </div>
                <span className="shrink-0 font-display text-lg font-semibold text-ink">{student.totalPoints || 0}<span className="text-xs font-normal text-slate-400"> pts</span></span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function ReviewsPage({ setAiClearedBadge, setPendingCount }) {
  const [submissions, setSubmissions] = useState([])
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalStudents: 0, totalPointsAwarded: 0, topStudents: [] })
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
  const [search, setSearch] = useState('')
  const [records, setRecords] = useState([])
  const [recordsSearch, setRecordsSearch] = useState('')
  const [editingStudent, setEditingStudent] = useState(null)
  const [recordForm, setRecordForm] = useState({ attendancePercentage: '', semesterPercentage: '', libraryUsage: '' })
  const [savingRecords, setSavingRecords] = useState(false)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [deletingStudent, setDeletingStudent] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [aiClearedCount, setAiClearedCount] = useState(0)
  const [aiAutoApproving, setAiAutoApproving] = useState(false)
  const [reviewTab, setReviewTab] = useState('evidence')

  const currentUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])

  const loadCurrent = useCallback(async () => {
    const [submissionsRes, dashboardRes] = await Promise.all([getTeacherSubmissions(50, statusFilter, search), getTeacherDashboard()])
    setSubmissions(submissionsRes.data.submissions || [])
    setStats(dashboardRes.data)
  }, [statusFilter, search])

  useEffect(() => {
    let active = true
    loadCurrent()
      .then((res) => { if (active && res) setPendingCount(res?.pending ?? 0) })
      .catch((error) => { if (active) setToast({ message: error.message || 'Unable to load submissions', tone: 'error' }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [statusFilter, search, loadCurrent, setPendingCount])

  const loadAiClearedCount = useCallback(async () => {
    try {
      const data = await getAiClearedCount()
      const count = data.data?.count || 0
      setAiClearedCount(count)
      setAiClearedBadge(count)
    } catch {
      setAiClearedCount(0)
    }
  }, [setAiClearedBadge])

  const loadRecords = useCallback(async () => {
    try {
      const data = await getTeacherStudents()
      setRecords(data.data?.students || [])
    } catch (error) {
      setToast({ message: error.message || 'Unable to load student records', tone: 'error' })
    }
  }, [])

  useEffect(() => {
    loadRecords()
    loadAiClearedCount().catch(() => {})
  }, [loadAiClearedCount, loadRecords])

  const chartData = [
    { name: 'Pending', pct: stats.pending, fill: 'var(--color-amber-500)' },
    { name: 'Approved', pct: stats.approved, fill: 'var(--color-leaf-500)' },
    { name: 'Rejected', pct: stats.rejected, fill: 'var(--color-rose-500)' },
  ]

  const verticalChartData = useMemo(() => {
    const counts = new Map()
    submissions.forEach((sub) => {
      const vertical = sub.activityId?.vertical || sub.vertical || 'Other'
      counts.set(vertical, (counts.get(vertical) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([name, count], index) => ({ name, count, fill: VERTICAL_FILLS[index % VERTICAL_FILLS.length] }))
      .sort((a, b) => b.count - a.count)
  }, [submissions])

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
      await exportTeacherSubmissions(statusFilter)
    } catch (error) {
      setToast({ message: error.message || 'Export failed', tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  async function handleReport() {
    setExporting(true)
    try {
      await downloadTeacherReport()
    } catch (error) {
      setToast({ message: error.message || 'Unable to download report', tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  async function handleAutoApproveAi() {
    if (aiClearedCount === 0) {
      setToast({ message: 'No AI-cleared submissions are waiting for auto-approval.', tone: 'info' })
      return
    }

    setAiAutoApproving(true)
    try {
      const result = await autoApproveAiCleared()
      const approved = result.data?.approved || 0
      setAiClearedCount(0)
      setToast({ message: approved ? `${approved} AI-cleared submission${approved === 1 ? '' : 's'} approved.` : 'No AI-cleared submissions were approved.', tone: approved ? 'success' : 'info' })
      await loadCurrent()
      await loadAiClearedCount()
    } catch (error) {
      setToast({ message: error.message || 'AI auto-approval failed', tone: 'error' })
    } finally {
      setAiAutoApproving(false)
    }
  }

  const filteredRecords = useMemo(() => {
    const term = recordsSearch.trim().toLowerCase()
    if (!term) return records
    return records.filter((student) => {
      const searchable = `${student.name || ''} ${student.registerNumber || ''} ${student.section || ''}`.toLowerCase()
      return searchable.includes(term)
    })
  }, [records, recordsSearch])

  function openRecordEditor(student) {
    setEditingStudent(student)
    setRecordForm({
      attendancePercentage: student.attendancePercentage ?? '',
      semesterPercentage: student.semesterPercentage ?? '',
      libraryUsage: student.libraryUsage ?? '',
    })
  }

  async function saveStudentRecords() {
    if (!editingStudent) return
    setSavingRecords(true)
    try {
      await updateTeacherStudentRecords(editingStudent._id, recordForm)
      setRecords((prev) => prev.map((student) => (
        student._id === editingStudent._id
          ? {
              ...student,
              attendancePercentage: recordForm.attendancePercentage === '' ? null : Number(recordForm.attendancePercentage),
              semesterPercentage: recordForm.semesterPercentage === '' ? null : Number(recordForm.semesterPercentage),
              libraryUsage: recordForm.libraryUsage === '' ? null : Number(recordForm.libraryUsage),
            }
          : student
      )))
      setEditingStudent(null)
      setToast({ message: `${editingStudent.name}'s academic records updated.`, tone: 'success' })
    } catch (error) {
      setToast({ message: error.message || 'Unable to save student records', tone: 'error' })
    } finally {
      setSavingRecords(false)
    }
  }

  async function handleDeleteStudent() {
    if (!deletingStudent) return
    setDeleteLoading(true)
    try {
      await deleteTeacherStudent(deletingStudent._id)
      setRecords((prev) => prev.filter((student) => student._id !== deletingStudent._id))
      setToast({ message: `${deletingStudent.name || 'Student'} deleted successfully.`, tone: 'success' })
      setDeletingStudent(null)
      loadCurrent().catch(() => {})
    } catch (error) {
      setToast({ message: error.message || 'Unable to delete student', tone: 'error' })
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleRecordsBulkUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBulkUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await bulkUpdateTeacherStudentRecords(formData)
      setToast({ message: res.message || 'Student records updated from the uploaded file.', tone: 'success' })
      loadRecords()
    } catch (error) {
      setToast({ message: error.message || 'Bulk record upload failed', tone: 'error' })
    } finally {
      setBulkUploading(false)
      event.target.value = ''
    }
  }

  async function handleStudentImport(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBulkUploading(true)
    try {
      const csvData = await file.text()
      const res = await bulkImportStudents(csvData, currentUser.departmentId || '', '')
      const data = res.data || {}
      setToast({
        message: `Imported ${data.successful || 0} students (${data.failed || 0} failed).`,
        tone: data.failed ? 'warning' : 'success',
      })
      loadRecords()
      loadCurrent().catch(() => {})
    } catch (error) {
      setToast({ message: error.message || 'Bulk student import failed', tone: 'error' })
    } finally {
      setBulkUploading(false)
      event.target.value = ''
    }
  }

  async function handleStudentExcelImport(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBulkUploading(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet) throw new Error('The workbook has no sheets.')

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      if (rows.length < 2) throw new Error('The sheet must have a header row and at least one student row.')

      const indexOf = (name) => {
        const header = rows[0].map((cell) => String(cell).trim().toLowerCase())
        const col = header.findIndex((cell) => cell.includes(name))
        return col === -1 ? null : col
      }
      const iName = indexOf('name')
      const iEmail = indexOf('email')
      const iRegNo = indexOf('register') ?? indexOf('reg no')
      if (iName === null || iEmail === null || iRegNo === null) {
        throw new Error('Expected columns: name, email, regNo (header row required).')
      }

      const lines = rows.slice(1)
        .map((row) => [row[iName], row[iEmail], row[iRegNo], row[4], row[5]].map((v) => String(v ?? '').trim()))
        .filter((row) => row[0] || row[1] || row[2])

      const res = await bulkImportStudents(lines.map((r) => r.join(',')).join('\n'), currentUser.departmentId || '', '')
      const result = res.data || {}
      setToast({
        message: `Imported ${result.successful || 0} students (${result.failed || 0} failed).`,
        tone: result.failed ? 'warning' : 'success',
      })
      loadRecords()
      loadCurrent().catch(() => {})
    } catch (error) {
      setToast({ message: error.message || 'Excel student import failed', tone: 'error' })
    } finally {
      setBulkUploading(false)
      event.target.value = ''
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
    setReviewTab('evidence')
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

  const decide = useCallback(async (status) => {
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
  }, [reviewing, score, remarks, loadCurrent])

  async function openEvidence(submissionId) {
    try {
      const blob = await getSubmissionFileBlob(submissionId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setToast({ message: error.message || 'Unable to open evidence file', tone: 'error' })
    }
  }

  const AiRowBadge = ({ sub }) => {
    const review = sub?.aiReview
    if (!review) return null
    return (
      <span
        title={`AI: ${review.recommendation} · ${review.suggestedPoints} SP · ${review.confidence}% confidence`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${AI_RECOMMENDATION_TONES[review.recommendation] || 'bg-slate-100 text-slate-600'}`}
      >
        <span className="h-1 w-1 rounded-full bg-current" />
        AI {review.recommendation}
      </span>
    )
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
      setRemarks(updated.aiReview?.reasoning || updated.teacherRemarks || '')
      setToast({ message: 'AI suggestion applied — review and confirm before approving.', tone: 'success' })
    } catch (error) {
      setToast({ message: error.message || 'Could not apply AI suggestion', tone: 'error' })
    }
  }

  const decideRef = useRef(decide)
  useEffect(() => {
    decideRef.current = decide
  }, [decide])

  useEffect(() => {
    if (!reviewing) return
    function handleKeyDown(event) {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') return
      if ((event.metaKey || event.ctrlKey) || event.altKey) return
      if (event.key === 'a' || event.key === 'A') decideRef.current('Approved')
      if (event.key === 'r' || event.key === 'R') decideRef.current('Rejected')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [reviewing])

  if (loading) return <LoadingState rows={4} />

  return (
    <div>
      <PageHeader
        title="Review Submissions"
        subtitle="Verify evidence, score submissions, and keep student STAR records up to date."
        actions={
          <>
            <Button variant="success" onClick={handleAutoApproveAi} loading={aiAutoApproving} disabled={aiClearedCount === 0}>⚡ Auto-approve AI{aiClearedCount > 0 ? ` (${aiClearedCount})` : ''}</Button>
            <Button variant="outline" onClick={handleReport} loading={exporting}>⬇ PDF Report</Button>
            <Button variant="outline" onClick={handleExport} loading={exporting}>⬇ Export Excel</Button>
          </>
        }
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 mt-6">
        <StatCard label="Pending Reviews" value={stats.pending} sub="Awaiting your action" accent="amber" />
        <StatCard label="Approved Tasks" value={stats.approved} sub="This term" accent="leaf" />
        <StatCard label="Rejected Tasks" value={stats.rejected} sub="Needs resubmission" accent="rose" />
        <StatCard label="AI Cleared" value={aiClearedCount} sub="High-confidence approvals" accent="brand" />
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
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">Submissions</h2>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student name or register number"
              className="!w-full md:!w-auto md:min-w-[240px] !bg-card !border-rule"
            />
          </div>
          {statusFilter === 'Pending' && selectedIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-200 bg-brand-50/70 px-4 py-3">
              <p className="text-sm font-medium text-ink">{selectedIds.length} selected</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={toggleSelectAll}>
                  {allSelected ? 'Deselect all' : 'Select all pending'}
                </Button>
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
                    <th className="text-left font-medium px-5 py-3">Waiting</th>
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
                              <div className="flex items-center gap-2">
                                <StatusBadge status={group.submissions[0]?.status} />
                                <AiRowBadge sub={group.submissions[0]} />
                              </div>
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
                          <td className="px-5 py-3">
                            {isMultiSubmission ? (
                              <span className="text-slate-400">—</span>
                            ) : (() => {
                              const days = daysWaiting(group.submissions[0])
                              return days > 3 ? (
                                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-medium text-rose-600">{days}d</span>
                              ) : (
                                <span className="font-mono text-[11px] text-slate-400">{days}d</span>
                              )
                            })()}
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
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={submission.status} />
                                <AiRowBadge sub={submission} />
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className="flex items-center gap-2">
                                <span className="tabular font-medium text-slate-600">{pointsFor(submission)} pts</span>
                                <PointsTag sub={submission} />
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              {(() => {
                                const days = daysWaiting(submission)
                                return days > 3 ? (
                                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-medium text-rose-600">{days}d</span>
                                ) : (
                                  <span className="font-mono text-[11px] text-slate-400">{days}d</span>
                                )
                              })()}
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

          <h2 className="font-display text-lg font-semibold text-ink mb-3 mt-8">Vertical Breakdown</h2>
          <Card className="p-5">
            <p className="text-sm text-slate-400 mb-3">Submissions by STAR vertical.</p>
            {verticalChartData.length > 0 ? (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={verticalChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid horizontal={false} stroke="var(--color-rule)" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-slate-400)' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} axisLine={false} tickLine={false} width={96} />
                      <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }} />
                      <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={18} fill="var(--color-brand-500)">
                        {verticalChartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-400 mt-2">{submissions.length} submissions across {verticalChartData.length} verticals.</p>
              </>
            ) : (
              <EmptyState icon="▦" title="No vertical data" description="Submissions will be grouped by vertical as they arrive." />
            )}
          </Card>

          <h2 className="font-display text-lg font-semibold text-ink mb-3 mt-8">Top Students</h2>
          <Card className="p-5">
            <p className="text-sm text-slate-400 mb-3">Ranked by approved STAR points.</p>
            {(stats.topStudents || []).length > 0 ? (
              <div className="space-y-2">
                {stats.topStudents.map((student, index) => (
                  <div key={student._id} className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5 text-sm">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[10px] font-medium text-paper">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{student.name}</p>
                        <p className="font-mono text-[11px] text-slate-400">{student.registerNumber || student.section || ''}</p>
                      </div>
                    </div>
                    <span className="shrink-0 font-display text-lg font-semibold text-ink">{student.totalPoints || 0}<span className="text-xs font-normal text-slate-400"> pts</span></span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="★" title="No top students yet" description="Students appear here as they earn approved STAR points." />
            )}
          </Card>
        </div>
      </div>

      <Card className="p-5 mt-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Student Academic Records</h2>
            <p className="text-sm text-slate-400 mt-1">Record attendance %, semester %, and library hours for your assigned students.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={recordsSearch}
              onChange={(e) => setRecordsSearch(e.target.value)}
              placeholder="Search students"
              className="!w-full sm:!w-auto sm:min-w-[200px] !bg-card !border-rule"
            />
            <input id="records-excel-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleRecordsBulkUpload} />
            <Button variant="outline" loading={bulkUploading} onClick={() => document.getElementById('records-excel-input')?.click()}>
              {bulkUploading ? 'Uploading…' : '⬇ Upload Excel'}
            </Button>
            <input id="students-csv-input" type="file" accept=".csv,.txt" className="hidden" onChange={handleStudentImport} />
            <Button variant="outline" loading={bulkUploading} onClick={() => document.getElementById('students-csv-input')?.click()}>
              {bulkUploading ? 'Importing…' : '⬆ Import Students (CSV)'}
            </Button>
            <input id="students-excel-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleStudentExcelImport} />
            <Button variant="outline" loading={bulkUploading} onClick={() => document.getElementById('students-excel-input')?.click()}>
              {bulkUploading ? 'Importing…' : '⬆ Import Students (Excel)'}
            </Button>
          </div>
        </div>

        {filteredRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                <tr>
                  <th className="text-left font-medium px-3 py-2.5">Student</th>
                  <th className="text-left font-medium px-3 py-2.5">Register No</th>
                  <th className="text-left font-medium px-3 py-2.5">Attendance %</th>
                  <th className="text-left font-medium px-3 py-2.5">Semester %</th>
                  <th className="text-left font-medium px-3 py-2.5">Library (hrs)</th>
                  <th className="text-left font-medium px-3 py-2.5">STAR Points</th>
                  <th className="text-right font-medium px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((student) => (
                  <tr key={student._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="h-8 w-8 shrink-0 rounded-full bg-ink font-display text-xs font-semibold text-paper flex items-center justify-center">{student.name?.[0] || '?'}</span>
                        <p className="font-medium text-ink">{student.name}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{student.registerNumber || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">
                    {student.attendancePercentage == null ? (
                      '—'
                    ) : student.attendancePercentage < 75 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 font-mono text-[11px] font-medium text-rose-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        {student.attendancePercentage}%
                      </span>
                    ) : student.attendancePercentage < 85 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-medium text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {student.attendancePercentage}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-2 py-0.5 font-mono text-[11px] font-medium text-leaf-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-leaf-500" />
                        {student.attendancePercentage}%
                      </span>
                    )}
                  </td>
                    <td className="px-3 py-2.5 text-slate-600">{student.semesterPercentage ?? '—'}{student.semesterPercentage != null ? '%' : ''}</td>
                    <td className="px-3 py-2.5 text-slate-600">{student.libraryUsage ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{student.totalPoints || 0} pts</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => openRecordEditor(student)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => setDeletingStudent(student)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="▤" title="No students found" description={records.length ? 'No students match your search.' : 'Assigned students will appear here once they are linked to you.'} />
        )}
      </Card>

      <Modal
        open={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title={`Academic records — ${editingStudent?.name || ''}`}
        subtitle={editingStudent?.registerNumber || ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingStudent(null)} disabled={savingRecords}>Cancel</Button>
            <Button onClick={saveStudentRecords} loading={savingRecords}>Save Records</Button>
          </>
        }
      >
        {editingStudent && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Attendance %">
              <Input type="number" min="0" max="100" value={recordForm.attendancePercentage} onChange={(e) => setRecordForm({ ...recordForm, attendancePercentage: e.target.value })} placeholder="e.g. 92" />
            </Field>
            <Field label="Semester %">
              <Input type="number" min="0" max="100" value={recordForm.semesterPercentage} onChange={(e) => setRecordForm({ ...recordForm, semesterPercentage: e.target.value })} placeholder="e.g. 85" />
            </Field>
            <Field label="Library (hours)">
              <Input type="number" min="0" value={recordForm.libraryUsage} onChange={(e) => setRecordForm({ ...recordForm, libraryUsage: e.target.value })} placeholder="e.g. 15" />
            </Field>
          </div>
        )}
      </Modal>

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

            <div className="flex gap-1 rounded-md border border-rule bg-paper p-1" role="tablist" aria-label="Review sections">
              {[
                { key: 'evidence', label: 'Evidence' },
                { key: 'ai', label: 'AI Review' },
                { key: 'decision', label: 'Score & Decision' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={reviewTab === tab.key}
                  onClick={() => setReviewTab(tab.key)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-ring ${
                    reviewTab === tab.key ? 'bg-card text-ink shadow-sm' : 'text-slate-500 hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {reviewTab === 'evidence' && (
              <>
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
              </>
            )}

            {reviewTab === 'ai' && (
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
            )}

            {reviewTab === 'decision' && (
              <>
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
                    autoFocus
                  />
                </Field>
                <Field label="Remarks" hint="This feedback will be visible to the student. Press A to approve or R to reject.">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {REMARK_TEMPLATES.map((template) => (
                      <button
                        key={template.label}
                        type="button"
                        onClick={() => setRemarks(template.text)}
                        className="rounded-full border border-rule bg-card px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-600 focus-ring"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Add feedback for the student..."
                  />
                  <p className="mt-1 text-right font-mono text-[11px] text-slate-400">{remarks.length} / 500</p>
                </Field>

                <CommentThread submissionId={reviewing?._id} currentUser={currentUser} />
              </>
            )}
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

      <ConfirmDialog
        open={!!deletingStudent}
        onClose={() => setDeletingStudent(null)}
        title="Delete student"
        message={`Delete ${deletingStudent?.name || 'this student'} (${deletingStudent?.registerNumber || ''}) from your assigned list? This also removes their submissions and points. This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={handleDeleteStudent}
        loading={deleteLoading}
      />
    </div>
  )
}
