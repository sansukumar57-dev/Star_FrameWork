import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Shell from '../components/Shell.jsx'
import { Modal, Button, Toast, LoadingState, EmptyState, Field, Input, Select } from '../components/UI.jsx'
import { TASKS, categoryById } from '../data/mockData.js'
import { getStudentActivities, getStudentProfile, getStudentPoints, getStudentSubmissions, submitStudentEvidence, resubmitStudentEvidence, getSubmissionFileBlob, getStudentNotifications, getStudentDeadlineAlerts } from '../utils/api.js'
import { getTaskProfile, getSubmissionRules, normalizeTaskName } from '../utils/taskProfiles.js'
import useSubmissionStatusToasts from '../hooks/useSubmissionStatusToasts.js'
import StudentDashboardHome from './StudentDashboardHome.jsx'
import StudentTasksPage from './StudentTasksPage.jsx'
import StudentSubmissionsPage from './StudentSubmissionsPage.jsx'
import StudentProfileModal from './StudentProfileModal.jsx'
import StudentLeaderboardPage from './StudentLeaderboardPage.jsx'
import StudentNotificationsPage from './StudentNotificationsPage.jsx'
import StudentPointsLedgerPage from './StudentPointsLedgerPage.jsx'
import StudentBookmarksPage from './StudentBookmarksPage.jsx'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

export default function StudentDashboard() {
  const [student, setStudent] = useState(null)
  const [points, setPoints] = useState(0)
  const [submissions, setSubmissions] = useState([])
  const [activities, setActivities] = useState([])
  const [activityPage, setActivityPage] = useState(1)
  const [activityMeta, setActivityMeta] = useState({ page: 1, limit: 6, total: 0 })
  const [selectedVertical, setSelectedVertical] = useState('Vertical 1 - Academic Performance')
  const [activeTask, setActiveTask] = useState(null)
  const [fileName, setFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [resubmitting, setResubmitting] = useState(null)
  const [activityOption, setActivityOption] = useState('Internship')
  const [visitOption, setVisitOption] = useState('Industrial Visit')
  const [durationWeeks, setDurationWeeks] = useState('2 weeks')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submissionSuccess, setSubmissionSuccess] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [alerts, setAlerts] = useState([])
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('stars_dismissed_alerts') || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    getStudentDeadlineAlerts()
      .then((res) => setAlerts(res.data?.alerts || []))
      .catch(() => {})
  }, [])

  useSubmissionStatusToasts({ enabled: !loading, onUnreadChange: setUnreadCount })

  useEffect(() => {
    try {
      localStorage.setItem('stars_dismissed_alerts', JSON.stringify(dismissedAlerts))
    } catch {
      /* ignore */
    }
  }, [dismissedAlerts])

  function dismissAlert(activityId) {
    setDismissedAlerts((prev) => (prev.includes(activityId) ? prev : [...prev, activityId]))
  }

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => !dismissedAlerts.includes(String(alert.activityId))),
    [alerts, dismissedAlerts]
  )

  useEffect(() => {
    async function loadData() {
      try {
        setError('')
        const [profileRes, pointsRes, submissionsRes, activitiesRes] = await Promise.all([
          getStudentProfile(),
          getStudentPoints(),
          getStudentSubmissions(20),
          getStudentActivities(1, 100)
        ])

        if (!profileRes?.data) {
          throw new Error('Student profile not found')
        }

        const activityList = Array.isArray(activitiesRes?.data?.activities)
          ? activitiesRes.data.activities
          : Array.isArray(activitiesRes?.data)
            ? activitiesRes.data
            : []

        setStudent(profileRes.data)
        setPoints(pointsRes?.data?.totalPoints || 0)
        setSubmissions(submissionsRes?.data?.submissions || [])
        setActivities(activityList)
        setActivityMeta({
          page: activitiesRes?.data?.page || 1,
          limit: activitiesRes?.data?.limit || 6,
          total: activitiesRes?.data?.total || activityList.length,
        })
      } catch (error) {
        setError(error.message || 'Unable to load student data')
      } finally {
        setLoading(false)
      }
    }

    loadData()

    getStudentNotifications(1, 1)
      .then((res) => setUnreadCount(res.data?.unread || 0))
      .catch(() => {})
  }, [activityPage])

  const verticalOptions = useMemo(() => {
    const options = new Set(
      activities
        .map((activity) => activity.vertical || 'Vertical 1 - Academic Performance')
        .filter(Boolean)
    )

    return [...options].sort((a, b) => {
      const numA = parseInt(a.match(/Vertical\s*(\d+)/)?.[1], 10) || 99
      const numB = parseInt(b.match(/Vertical\s*(\d+)/)?.[1], 10) || 99
      return numA - numB
    })
  }, [activities])

  const availableTasks = useMemo(() => {
    if (activities.length > 0) {
      return activities.map((activity) => ({
        id: activity._id,
        name: activity.activityName,
        description: activity.description || 'Upload supporting evidence',
        maxPoints: activity.maximumPoints || 0,
        maxStarPct: Math.min(100, Math.round((activity.maximumPoints || 0) / 5)),
        deadline: activity.deadline || '',
        important: activity.important || false,
        category: 'cert',
        vertical: activity.vertical || 'Vertical 1 - Academic Performance',
      }))
    }

    return TASKS.map((task) => ({
      ...task,
      vertical: 'Vertical 1 - Academic Performance',
    }))
  }, [activities])

  useEffect(() => {
    if (verticalOptions.length > 0 && !verticalOptions.includes(selectedVertical)) {
      setSelectedVertical(verticalOptions[0])
    }
  }, [selectedVertical, verticalOptions])

  const submittedTaskIds = new Set(submissions.map((s) => (typeof s.activityId === 'object' ? s.activityId?._id : s.activityId)))
  const pendingTasks = availableTasks.filter((t) => !submittedTaskIds.has(t.id || t._id))
  const completed = submissions.filter((s) => ['Approved', 'FacultyApproved', 'HODApproved'].includes(s.status)).length
  const pendingReview = submissions.filter((s) => s.status === 'Pending').length
  const totalActivityPages = Math.max(1, Math.ceil((activityMeta.total || 0) / (activityMeta.limit || 1)))

  const groupedTasks = useMemo(() => {
    const filtered = pendingTasks.filter((task) => task.vertical === selectedVertical)
    if (filtered.length === 0) return [{ key: 'all', heading: selectedVertical, items: [] }]

    const name = normalizeTaskName(selectedVertical)
    // V1 gets sub-grouped by activity type
    if (name.includes('vertical 1') || name.includes('academic')) {
      const groups = [
        { key: 'activity-1', heading: 'Activity: Internship / Case Study / Mini Project', items: [] },
        { key: 'activity-2', heading: 'Activity: Industrial / Institutional / International Visit', items: [] },
        { key: 'activity-3', heading: 'Activity: Academic & Other', items: [] },
      ]
      filtered.forEach((task) => {
        const n = normalizeTaskName(task.name)
        if (n.includes('internship') || n.includes('case study') || n.includes('mini project')) groups[0].items.push(task)
        else if (n.includes('visit')) groups[1].items.push(task)
        else groups[2].items.push(task)
      })
      return groups
    }

    // All other verticals: single flat group
    return [{ key: 'all', heading: selectedVertical, items: filtered }]
  }, [pendingTasks, selectedVertical])

  const recent = useMemo(
    () => [...submissions].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 4),
    [submissions]
  )

  function openUpload(task) {
    const profile = getTaskProfile(task)
    setActiveTask(task)
    setFileName('')
    setSelectedFile(null)
    setResubmitting(null)
    setDurationWeeks('2 weeks')
    setActivityOption(profile.defaultOption || 'Internship')
    setVisitOption(profile.defaultOption || 'Industrial Visit')
    setSelectedLevel('')
    setUrlInput('')
  }

  function openResubmit(submission) {
    const task = {
      id: submission.activityId?._id || submission.activityId,
      name: submission.activityId?.activityName || submission.activityName || 'Activity',
      description: submission.description || 'Upload supporting evidence',
      maxPoints: submission.activityId?.maximumPoints || 0,
      deadline: '',
      category: 'cert',
      vertical: submission.activityId?.vertical || submission.vertical || '',
    }
    const profile = getTaskProfile(task)
    setResubmitting(submission)
    setActiveTask(task)
    setFileName('')
    setSelectedFile(null)
    setDurationWeeks('2 weeks')
    setActivityOption(profile.defaultOption || 'Internship')
    setVisitOption(profile.defaultOption || 'Industrial Visit')
    setSelectedLevel(submission.selectedLevel || '')
    setUrlInput(submission.projectUrl || submission.proofUrl || '')
  }

  function getSubmissionRulesForTask() {
    return getSubmissionRules(activeTask, { activityOption, visitOption, selectedLevel, urlInput, fileName })
  }

  function handleFileChosen(event) {
    const file = event.target.files?.[0] || null
    if (file) {
      const typeOk = ALLOWED_FILE_TYPES.some((prefix) => file.type.startsWith(prefix))
      if (!typeOk) {
        setToast('Please upload an image, PDF, Word document, or video.')
        event.target.value = ''
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setToast('File is too large — the maximum size is 100 MB.')
        event.target.value = ''
        return
      }
      setSelectedFile(file)
      setFileName(file.name)
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer?.files?.[0] || null
    if (!file) return
    const typeOk = ALLOWED_FILE_TYPES.some((prefix) => file.type.startsWith(prefix))
    if (!typeOk) {
      setToast('Please upload an image, PDF, Word document, or video.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setToast('File is too large — the maximum size is 100 MB.')
      return
    }
    setSelectedFile(file)
    setFileName(file.name)
  }

  const scorePreview = useMemo(() => {
    if (!activeTask) return null
    const maxPoints = Number(activeTask.maxPoints || 0)

    // level-select tasks map each option to a point tier
    if (getTaskProfile(activeTask).group === 'level-select') {
      const options = getTaskProfile(activeTask).options
      const base = maxPoints > 0 ? Math.max(1, Math.floor(maxPoints / Math.max(options.length, 1))) : 0
      const range = options.map((_, index) => base * (index + 1))
      return {
        range: range.length ? [range[0], range[range.length - 1]] : [maxPoints, maxPoints],
        note: 'Estimated from the level/achievement tiers for this activity.',
      }
    }
    if (getTaskProfile(activeTask).group === 'activity-1') {
      const internshipScale = { 'Internship': [20, 60], 'Case Study': [20, 60], 'Mini Project': [20, 60] }
      const [lo, hi] = internshipScale[activityOption] || [20, 60]
      return {
        range: [Math.min(lo, maxPoints || hi), Math.min(hi, maxPoints || hi)],
        note: `Estimated for ${activityOption} based on typical STAR level tiers.`,
      }
    }
    if (getTaskProfile(activeTask).group === 'activity-2') {
      return { range: [20, Math.min(60, maxPoints || 60)], note: 'Estimated for a visit with evidence.' }
    }
    if (getTaskProfile(activeTask).group === 'url') {
      return { range: [25, Math.min(75, maxPoints || 75)], note: 'Estimated for a published project/portfolio.' }
    }
    return { range: [maxPoints, maxPoints], note: 'Points are awarded at the activity maximum.' }
  }, [activeTask, activityOption])

  const ALLOWED_FILE_TYPES = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml', 'video/']
  const MAX_FILE_SIZE = 100 * 1024 * 1024

  async function submitEvidence() {
    if (!activeTask) return

    const rules = getSubmissionRulesForTask()
    const file = selectedFile || document.querySelector('input[type="file"]')?.files?.[0] || null

    if (rules.requiresLevel && !selectedLevel) {
      setToast('Please select a level before submitting.')
      return
    }
    if (rules.requiresFile && !file) {
      setToast('Please upload the required file before submitting.')
      return
    }
    if (rules.requiresFile && file) {
      const typeOk = ALLOWED_FILE_TYPES.some((prefix) => file.type.startsWith(prefix))
      if (!typeOk) {
        setToast('Please upload an image, PDF, Word document, or video.')
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setToast('File is too large — the maximum size is 100 MB.')
        return
      }
    }
    if (rules.requiresUrl && !urlInput.trim()) {
      setToast('Please provide the URL before submitting.')
      return
    }
    if (rules.requiresUrl && urlInput.trim()) {
      try {
        const parsed = new URL(urlInput.trim())
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
      } catch {
        setToast('Please enter a valid URL starting with http:// or https://.')
        return
      }
    }
    if (rules.isInternship && !durationWeeks) {
      setToast('Please select the internship duration before submitting.')
      return
    }

    const formData = new FormData()
    const activityId = activeTask.id || activeTask._id || ''

    formData.append('activityId', activityId)
    formData.append('description', `Submission for ${activeTask.name}${rules.selectedActivity ? ` • ${rules.selectedActivity}` : ''}`)
    formData.append('activityType', rules.selectedActivity || '')
    formData.append('visitType', rules.selectedActivity || '')
    formData.append('selectedLevel', selectedLevel || '')
    formData.append('durationWeeks', rules.isInternship ? durationWeeks : '')
    formData.append('projectUrl', rules.requiresUrl ? urlInput : '')
    formData.append('proofUrl', rules.requiresUrl ? urlInput : '')

    if (file) formData.append('certificateFile', file)

    try {
      setUploadProgress(0)
      if (resubmitting?._id) {
        const response = await resubmitStudentEvidence(resubmitting._id, formData, (progress) => setUploadProgress(progress))
        setSubmissions((prev) => prev.map((s) => (s._id === response.data._id ? response.data : s)))
        setToast('Evidence resubmitted — your faculty will review it shortly.')
      } else {
        const response = await submitStudentEvidence(formData, (progress) => setUploadProgress(progress))
        setSubmissions((prev) => [response.data, ...prev])
        setToast('Evidence submitted — your faculty will review it shortly.')
      }
      setActiveTask(null)
      setResubmitting(null)
      setSelectedLevel('')
      setUrlInput('')
      setSelectedFile(null)
      setFileName('')
      setUploadProgress(0)
      setSubmissionSuccess(true)
      window.setTimeout(() => {
        setSubmissionSuccess(false)
        setToast('')
      }, 2200)
    } catch (error) {
      setUploadProgress(0)
      setToast(error.message || 'Submission failed')
    }
  }

  async function openEvidence(submissionId) {
    try {
      const blob = await getSubmissionFileBlob(submissionId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setToast(error.message || 'Unable to open evidence file')
    }
  }

  if (loading) {
    return (
      <Shell role="student" userName="Student" department="Loading">
        <LoadingState rows={3} />
      </Shell>
    )
  }

  if (error || !student) {
    return (
      <Shell role="student" userName="Student" department="Student">
        <EmptyState
          icon="⚠"
          title="Unable to load the dashboard"
          description={error || 'The student profile could not be loaded.'}
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      </Shell>
    )
  }

  return (
    <Shell role="student" userName={student.name} department={student.department} profileTrigger={() => setProfileOpen(true)} badges={{ '/student/notifications': unreadCount }}>
      {submissionSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 px-6" role="status" aria-live="polite">
          <div className="rounded-xl border border-rule bg-card p-10 text-center shadow-modal animate-[fadeInDown_0.25s_ease-out]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf-100 text-leaf-600">
              <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-[drawCheck_0.4s_ease-out_forwards]" style={{ strokeDasharray: 30, strokeDashoffset: 30 }} />
              </svg>
            </div>
            <p className="mt-4 font-display text-lg font-semibold text-ink">Evidence submitted!</p>
            <p className="mt-1 text-sm text-slate-500">Your faculty will review it shortly.</p>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} tone={toast.toLowerCase().includes('fail') || toast.toLowerCase().includes('unable') || toast.toLowerCase().includes('please') ? 'error' : 'success'} onDismiss={() => setToast('')} />}

      {visibleAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {visibleAlerts.map((alert) => {
            const overdue = alert.tone === 'overdue'
            const urgent = alert.tone === 'urgent'
            return (
              <div
                key={String(alert.activityId)}
                className={`flex items-start justify-between gap-3 rounded-md border px-4 py-3 ${
                  overdue ? 'border-rose-300 bg-rose-50' : urgent ? 'border-amber-400 bg-amber-50' : 'border-amber-200 bg-amber-50/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
                    overdue ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {overdue ? '!' : '⏱'}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${overdue ? 'text-rose-700' : 'text-amber-800'}`}>
                      {overdue ? 'Overdue' : urgent ? 'Important — due soon' : 'Deadline approaching'}: {alert.activityName}
                      {alert.important && (
                        <span className="ml-2 inline-flex rounded-full bg-amber-500 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white">Important</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700/90">
                      {overdue
                        ? `Deadline was ${new Date(alert.deadline).toLocaleDateString()} — submit evidence to earn up to ${alert.maximumPoints} pts.`
                        : `Due ${new Date(alert.deadline).toLocaleDateString()} (${alert.daysLeft} day${alert.daysLeft === 1 ? '' : 's'}) — earn up to ${alert.maximumPoints} pts.`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissAlert(alert.activityId)}
                  className="shrink-0 text-lg leading-none text-amber-700/60 transition-colors hover:text-amber-900 focus-ring"
                  aria-label="Dismiss alert"
                >
                  &times;
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Routes>
        <Route path="" element={<StudentDashboardHome student={student} points={points} completed={completed} pendingTasks={pendingTasks} pendingReview={pendingReview} submissions={submissions} recent={recent} activities={activities} />} />
        <Route path="tasks" element={<StudentTasksPage selectedVertical={selectedVertical} setSelectedVertical={setSelectedVertical} verticalOptions={verticalOptions} groupedTasks={groupedTasks} pendingTasks={pendingTasks} activityMeta={activityMeta} activityPage={activityPage} totalActivityPages={totalActivityPages} setActivityPage={setActivityPage} openUpload={openUpload} categoryById={categoryById} />} />
        <Route path="submissions" element={<StudentSubmissionsPage submissions={submissions} openUpload={openUpload} openResubmit={openResubmit} openEvidence={openEvidence} />} />
        <Route path="leaderboard" element={<StudentLeaderboardPage />} />
        <Route path="notifications" element={<StudentNotificationsPage onUnreadChange={setUnreadCount} />} />
        <Route path="points-ledger" element={<StudentPointsLedgerPage />} />
        <Route path="bookmarks" element={<StudentBookmarksPage onSubmitActivity={openUpload} />} />
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Routes>

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="">
        <StudentProfileModal
          student={student}
          points={points}
          submissions={submissions}
          activities={activities}
          recent={recent}
          onProfileUpdate={(updated) => setStudent(updated)}
        />
      </Modal>

      <Modal
        open={!!activeTask}
        onClose={() => { setActiveTask(null); setResubmitting(null) }}
        title={`${resubmitting ? 'Resubmit evidence' : 'Upload evidence'} — ${activeTask?.name || ''}`}
        footer={
          <>
<Button variant="ghost" onClick={() => { setActiveTask(null); setResubmitting(null) }} disabled={uploadProgress > 0 && uploadProgress < 100}>Cancel</Button>
              {uploadProgress > 0 && uploadProgress < 100 ? (
                <div className="flex w-40 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full transition-all" style={{ width: `${uploadProgress}%`, backgroundColor: 'var(--color-brand-500)' }} />
                  </div>
                  <span className="font-mono text-xs text-slate-500">{uploadProgress}%</span>
                </div>
              ) : (
                <Button onClick={submitEvidence} disabled={!getSubmissionRulesForTask().canSubmit}>{resubmitting ? 'Resubmit' : 'Submit'}</Button>
              )}
          </>
        }
      >
        <p className="text-sm text-slate-500 mb-4">{activeTask?.description}</p>

        {getTaskProfile(activeTask).group === 'activity-1' && (
          <Field label="Select activity" className="mb-4">
            <Select value={activityOption} onChange={(e) => setActivityOption(e.target.value)}>
              {getTaskProfile(activeTask).options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
        )}

        {getTaskProfile(activeTask).group === 'activity-2' && (
          <Field label="Select visit type" className="mb-4">
            <Select value={visitOption} onChange={(e) => setVisitOption(e.target.value)}>
              {getTaskProfile(activeTask).options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
        )}

        {getTaskProfile(activeTask).group === 'level-select' && (
          <Field label="Select level / achievement" className="mb-4">
            <Select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
              <option value="">-- Select --</option>
              {getTaskProfile(activeTask).options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
        )}

        {getTaskProfile(activeTask).group === 'url' && (
          <Field label="Profile / Project URL" className="mb-4">
            <Input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://" />
          </Field>
        )}

        {(getTaskProfile(activeTask).group === 'generic' ||
          getTaskProfile(activeTask).group === 'activity-2' ||
          activityOption === 'Case Study' || activityOption === 'Internship' ||
          getTaskProfile(activeTask).group === 'level-select') && (
          <div className="mb-4">
            <label
              className={`block cursor-pointer rounded-md border border-dashed bg-paper p-6 text-center transition-colors ${
                dragActive ? 'border-brand-500 bg-brand-50' : 'border-rule hover:border-brand-300'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.mp4,.webm,.mov"
                className="hidden"
                onChange={(e) => { handleFileChosen(e); setFileName(e.target.files?.[0]?.name || '') }}
              />
              <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-md border font-mono text-sm ${dragActive ? 'border-brand-300 bg-brand-50 text-brand-500' : 'border-rule bg-card text-slate-400'}`}>&#x2191;</span>
              <p className="mt-2 text-sm text-slate-500">
                {fileName ? (
                  <span className="font-medium text-ink">{fileName}</span>
                ) : dragActive ? (
                  'Drop the file here to attach it'
                ) : (
                  'Drag & drop a file here, or click to browse (PDF, JPG, PNG, DOC, MP4, WEBM, MOV) — max 100 MB'
                )}
              </p>
            </label>
          </div>
        )}

        {scorePreview && (
          <div className="mb-4 rounded-md border border-brand-200 bg-brand-50/60 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-500 font-mono text-[10px] font-medium text-white">AI</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Estimated score preview</p>
                <p className="mt-0.5 font-mono text-sm text-brand-700">
                  {scorePreview.range[0]}–{scorePreview.range[1]} pts
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{scorePreview.note}</p>
              </div>
            </div>
          </div>
        )}

        {activityOption === 'Internship' && (
          <Field label="Duration" className="mb-4">
            <Select value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)}>
              <option value="2 weeks">2 weeks</option>
              <option value="4 weeks">4 weeks</option>
            </Select>
          </Field>
        )}

        {activityOption === 'Mini Project' && (
          <Field label="Project URL" className="mb-4">
            <Input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://example.com" />
          </Field>
        )}
      </Modal>
    </Shell>
  )
}
