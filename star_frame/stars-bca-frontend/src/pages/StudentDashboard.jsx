import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Shell from '../components/Shell.jsx'
import { Modal, Button, Toast, LoadingState, EmptyState, Field, Input, Select } from '../components/UI.jsx'
import { TASKS, categoryById } from '../data/mockData.js'
import { getStudentActivities, getStudentProfile, getStudentPoints, getStudentSubmissions, submitStudentEvidence, getSubmissionFileBlob, getStudentNotifications, getStudentDeadlineAlerts } from '../utils/api.js'
import StudentDashboardHome from './StudentDashboardHome.jsx'
import StudentTasksPage from './StudentTasksPage.jsx'
import StudentSubmissionsPage from './StudentSubmissionsPage.jsx'
import StudentProfileModal from './StudentProfileModal.jsx'
import StudentLeaderboardPage from './StudentLeaderboardPage.jsx'
import StudentNotificationsPage from './StudentNotificationsPage.jsx'

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
  const [activityOption, setActivityOption] = useState('Internship')
  const [visitOption, setVisitOption] = useState('Industrial Visit')
  const [durationWeeks, setDurationWeeks] = useState('2 weeks')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState('')
  const [urlInput, setUrlInput] = useState('')
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

  function normalizeTaskName(value = '') {
    return String(value || '').toLowerCase()
  }

  function getTaskProfile(task = {}) {
    const name = normalizeTaskName(task?.name)

    if (name.includes('internship') || name.includes('case study') || name.includes('mini project')) {
      return {
        group: 'activity-1',
        defaultOption: name.includes('internship') ? 'Internship' : name.includes('case study') ? 'Case Study' : 'Mini Project',
        options: ['Internship', 'Case Study', 'Mini Project'],
      }
    }

    if (name.includes('visit')) {
      return {
        group: 'activity-2',
        defaultOption: name.includes('industrial') ? 'Industrial Visit' : name.includes('institutional') ? 'Institutional Visit' : 'International Visit',
        options: ['Industrial Visit', 'Institutional Visit', 'International Visit'],
      }
    }

    // Activities that need a URL proof
    if (name.includes('live project') || name.includes('github portfolio') || name.includes('portfolio website') ||
        name.includes('linkedin') || name.includes('kaggle') || name.includes('genai') ||
        name.includes('ai / ml') || name.includes('open-source')) {
      return { group: 'url', defaultOption: '', options: [] }
    }

    // Level-select activities (V2–V10)
    const levelMap = {
      'semester exam': ['< 60%', '60–69%', '70–79%', '80% and above'],
      'attendance': ['75–79%', '80–89%', '90–94%', '95% and above'],
      'internship': ['Case study/Mini project', 'Industry internship (2 weeks)', 'Industry internship (4 weeks)'],
      'case study': ['Case study/Mini project', 'Industry internship (2 weeks)', 'Industry internship (4 weeks)'],
      'mini project': ['Case study/Mini project', 'Industry internship (2 weeks)', 'Industry internship (4 weeks)'],
      'visit': ['Industrial Visit completed', 'Institutional Visit completed', 'International Visit / Conference'],
      'library': ['5 Hrs', '10 Hrs', '15 Hrs'],
      'scholarship': ['Applied for scholarship', 'Scholarship received', 'Merit Scholarship'],
      'nptel': ['Registered & Completed Assignments', 'Successfully completed', 'Elite', 'Elite with Gold/Silver badge'],
      'online certification': ['Completed 1 course', 'Specialisation / multi-course', 'Professional certificate', '2 professional certs'],
      'industry certification': ['Foundation level', 'Associate level', 'Professional level', 'Expert / Speciality level'],
      'short mooc': ['Enrolled & completed', '2 MOOCs completed', '3+ MOOCs with assessment'],
      'value added course': ['VAC with assessment / internal certification', 'External agency / industry expert with certification'],
      'leetcode': ['Profile + 5–20 Easy', '50 Easy / 10 Medium', '50 Medium problems', '100+ Medium / Hard / Top 10%'],
      'hackerrank': ['Profile + 5–20 Easy', '50 Easy / 10 Medium', '50 Medium problems', '100+ Medium / Hard / Top 10%'],
      'hackerearth': ['Profile + 5–20 Easy', '50 Easy / 10 Medium', '50 Medium problems', '100+ Medium / Hard / Top 10%'],
      'programming, data structures': ['Basic assessment cleared', 'Intermediate cleared', 'Advanced cleared', 'Expert / Certification'],
      'codechef': ['1–2 Star / 25 problems', '3 Star / 50 problems', '4 Star / 100 problems', '5 Star / 200 problems'],
      'geeksforgeeks': ['1–2 Star / 25 problems', '3 Star / 50 problems', '4 Star / 100 problems', '5 Star / 200 problems'],
      'coding contest': ['Participated', 'Top 50%', 'Finalist', 'Winner'],
      'open-source': ['GitHub profile + starred/forked repo + raised an issue', 'Pull Request submitted'],
      'hackathon': ['Participated', 'Qualified round / finalist', 'Regional/Local winner', 'IIT/NIT /National winner'],
      'datathon': ['Participated', 'Qualified round / finalist', 'Regional/Local winner', 'IIT/NIT /National winner'],
      'ideathon': ['Participated', 'Shortlisted / top 50%', 'Finalist', 'Winner'],
      'business plan': ['Participated', 'Shortlisted / top 50%', 'Finalist', 'Winner'],
      'startup': ['Participated / idea submitted', 'Prototype / MVP built', 'Incubated', 'Startup registered / funded'],
      'technical event': ['Intra-college participation', 'Intra-college winner / Inter-college participation', 'Inter-college winner', 'State/national winner'],
      'paper presentation': ['Internal / Department', 'External/Intercollegiate', 'State / National level', 'International'],
      'conference / journal': ['Abstract submitted', 'Conference paper published', 'Indexed conference', 'Indexed journal (Scopus)'],
      'patent': ['Draft filed', 'Published', 'Granted', 'Copyright'],
      'book chapter': ['Internal project report', 'Book chapter submitted', 'Book chapter published', 'International publisher'],
      'workshop': ['1 event attended', '2 events attended', '3+ events / paper presented', 'Best paper / award'],
      'symposium': ['1 event attended', '2 events attended', '3+ events / paper presented', 'Best paper / award'],
      'kaggle': ['Profile created + participated', 'Top 50%', 'Bronze / top 25%', 'Silver/Gold / top 10%'],
      'analytics vidhya': ['Profile created + participated', 'Top 50%', 'Bronze / top 25%', 'Silver/Gold / top 10%'],
      'ai / ml': ['Prototype / idea stage', 'Functional project', 'Deployed (app / dashboard)', 'Real user adoption / published'],
      'web dev': ['Prototype / idea stage', 'Functional project', 'Deployed (app / dashboard)', 'Real user adoption / published'],
      'networking project': ['Prototype / idea stage', 'Functional project', 'Deployed (app / dashboard)', 'Real user adoption / published'],
      'live project': ['Basic deployment', 'Multi-service deployment', 'Production-ready', 'Certified + deployed'],
      'genai': ['Used AI tools + documented', 'Built GenAI-integrated project', 'Deployed GenAI app', 'Industry / research recognised'],
      'prompt engineering': ['Used AI tools + documented', 'Built GenAI-integrated project', 'Deployed GenAI app', 'Industry / research recognised'],
      'linkedin': ['Profile created (Professional)', '50 connections + active posts + tagging college, Principal, Dean & HOD', '100 connections + weekly posts + engagement (likes/comments)', 'Recommendations + thought leader + college/department featured/shared your post'],
      'github portfolio': ['Account + 2–5 repos', '5–10 repos with README', 'Practical work submission', 'Mini-projects / projects submission'],
      'portfolio website': ['Basic portfolio page', 'Professional with projects', 'Project showcase + deployed'],
      'technical blog': ['3 blogs / 3 videos', '5 blogs', '10 blogs / YouTube channel', 'Industry / media recognition'],
      'podcast': ['3 blogs / 3 videos', '5 blogs', '10 blogs / YouTube channel', 'Industry / media recognition'],
      'peer mentoring': ['Helped 1–2 students', 'Study group / 5 students', 'Workshop / session conducted (class / juniors)', 'Structured mentoring programme'],
      'knowledge sharing': ['Helped 1–2 students', 'Study group / 5 students', 'Workshop / session conducted (class / juniors)', 'Structured mentoring programme'],
      'student council': ['Member', 'Active contributor', 'Coordinator / Jt. Secretary', 'President / Secretary'],
      'club': ['Member', 'Active contributor', 'Coordinator / Jt. Secretary', 'President / Secretary'],
      'professional conduct': ['Awarded by Mentor'],
      'event organising': ['Volunteer in a department-level event', 'Core committee member in college-level event', 'Coordinator / Joint Secretary of major college event', 'Chief Organiser / Convenor of inter-college / national event'],
      'nss': ['Enrolled', 'Active volunteer', 'Event organiser / camp', 'Camp leader / award'],
      'ncc': ['Enrolled', 'Certificate A/B', 'Certificate C', 'Leadership / National'],
      'cultural': ['College-level participation', 'Intercollegiate participation', 'Intercollegiate winner', 'State / national level'],
      'sports': ['College-level participation', 'Intercollegiate participation', 'Intercollegiate winner', 'State / national level'],
      'community outreach': ['Participated in 1 activity', 'Active volunteer (3+ events)', 'Coordinator / project lead', 'Measurable social impact'],
      'social initiative': ['Participated in 1 activity', 'Active volunteer (3+ events)', 'Coordinator / project lead', 'Measurable social impact'],
      'air-rifle': ['Enrolled', 'District level', 'State level', 'National level'],
      'resume': ['Basic draft created', 'Senior reviewed', 'ATS-optimised', 'Industry-reviewed / LinkedIn synced'],
      'mock interview': ['Attended mock / aptitude', 'Cleared aptitude test (>=60%)', 'High rating mock interview', 'Outstanding / top performer'],
      'aptitude': ['Attended mock / aptitude', 'Cleared aptitude test (>=60%)', 'High rating mock interview', 'Outstanding / top performer'],
      'placement': ['Internship offer received', 'Placement offer (<5 LPA)', 'Placement offer (5-10 LPA)', 'Dream offer (>10 LPA)'],
      'internship offer': ['Internship offer received', 'Placement offer (<5 LPA)', 'Placement offer (5-10 LPA)', 'Dream offer (>10 LPA)'],
      'higher studies': ['Appeared in exam', 'Qualified / cleared', 'Good percentile (>=70%ile)', 'Top rank / scholarship / admission'],
      'competitive exam': ['Appeared in exam', 'Qualified / cleared', 'Good percentile (>=70%ile)', 'Top rank / scholarship / admission'],
    }

    for (const [key, options] of Object.entries(levelMap)) {
      if (name.includes(key)) return { group: 'level-select', defaultOption: '', options }
    }

    return { group: 'generic', defaultOption: '', options: [] }
  }

  function openUpload(task) {
    const profile = getTaskProfile(task)
    setActiveTask(task)
    setFileName('')
    setDurationWeeks('2 weeks')
    setActivityOption(profile.defaultOption || 'Internship')
    setVisitOption(profile.defaultOption || 'Industrial Visit')
    setSelectedLevel('')
    setUrlInput('')
  }

  function getSubmissionRules() {
    const profile = getTaskProfile(activeTask)
    const selectedActivity = profile.group === 'activity-1' ? activityOption : profile.group === 'activity-2' ? visitOption : ''
    const isInternship = selectedActivity === 'Internship'
    const isCaseStudy = selectedActivity === 'Case Study'
    const isMiniProject = selectedActivity === 'Mini Project'

    const requiresFile = profile.group === 'generic' || profile.group === 'activity-2' ||
      isInternship || isCaseStudy
    const requiresUrl = isMiniProject || profile.group === 'url'
    const requiresLevel = profile.group === 'level-select'

    const canSubmit =
      (requiresFile ? Boolean(fileName) : true) &&
      (requiresUrl ? Boolean(urlInput.trim()) : true) &&
      (requiresLevel ? Boolean(selectedLevel) : true)

    return { profile, selectedActivity, isInternship, isCaseStudy, isMiniProject, requiresFile, requiresUrl, requiresLevel, canSubmit }
  }

  const ALLOWED_FILE_TYPES = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml']
  const MAX_FILE_SIZE = 10 * 1024 * 1024

  async function submitEvidence() {
    if (!activeTask) return

    const rules = getSubmissionRules()
    const selectedFile = document.querySelector('input[type="file"]')?.files?.[0]

    if (rules.requiresLevel && !selectedLevel) {
      setToast('Please select a level before submitting.')
      return
    }
    if (rules.requiresFile && !selectedFile) {
      setToast('Please upload the required file before submitting.')
      return
    }
    if (rules.requiresFile && selectedFile) {
      const typeOk = ALLOWED_FILE_TYPES.some((prefix) => selectedFile.type.startsWith(prefix))
      if (!typeOk) {
        setToast('Please upload an image, PDF, or Word document.')
        return
      }
      if (selectedFile.size > MAX_FILE_SIZE) {
        setToast('File is too large — the maximum size is 10 MB.')
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

    if (selectedFile) formData.append('certificateFile', selectedFile)

    try {
      const response = await submitStudentEvidence(formData)
      setSubmissions((prev) => [response.data, ...prev])
      setActiveTask(null)
      setSelectedLevel('')
      setUrlInput('')
      setToast('Evidence submitted — your faculty will review it shortly.')
      setTimeout(() => setToast(''), 3500)
    } catch (error) {
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
        <Route path="submissions" element={<StudentSubmissionsPage submissions={submissions} openUpload={openUpload} openEvidence={openEvidence} />} />
        <Route path="leaderboard" element={<StudentLeaderboardPage />} />
        <Route path="notifications" element={<StudentNotificationsPage onUnreadChange={setUnreadCount} />} />
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
        onClose={() => setActiveTask(null)}
        title={`Upload evidence — ${activeTask?.name || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setActiveTask(null)}>Cancel</Button>
            <Button onClick={submitEvidence} disabled={!getSubmissionRules().canSubmit}>Submit</Button>
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
            <label className="block cursor-pointer rounded-md border border-dashed border-rule bg-paper p-6 text-center transition-colors hover:border-brand-300">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} />
              <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-md border border-rule bg-card font-mono text-sm text-slate-400">&#x2191;</span>
              <p className="mt-2 text-sm text-slate-500">{fileName ? <span className="font-medium text-ink">{fileName}</span> : 'Click to choose a file (PDF, JPG, PNG, DOC) — max 10 MB'}</p>
            </label>
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
