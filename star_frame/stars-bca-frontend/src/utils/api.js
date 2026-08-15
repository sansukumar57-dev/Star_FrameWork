const DEFAULT_API_BASE_URL = 'http://localhost:3000'
export const API_BASE_URL = import.meta.env?.VITE_API_URL || DEFAULT_API_BASE_URL

function handleUnauthorized() {
  if (localStorage.getItem('stars_token')) {
    localStorage.removeItem('stars_token')
    localStorage.removeItem('stars_user')
    if (!window.location.pathname.startsWith('/')) {
      window.location.href = '/'
    } else {
      window.location.reload()
    }
  }
}

async function request(path, { method = 'GET', body, auth = true, isFormData = false, headers = {} } = {}) {
  const token = localStorage.getItem('stars_token')
  const options = { method, headers: { ...headers } }

  if (auth && token) {
    options.headers.Authorization = `Bearer ${token}`
  }

  if (body && !isFormData) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  } else if (body && isFormData) {
    options.body = body
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options)
  const data = await response.json().catch(() => ({ success: false, message: 'Request failed' }))

  if (response.status === 401 && auth) {
    handleUnauthorized()
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || 'Request failed')
  }

  return data
}

export async function downloadFile(path, fallbackName = 'export') {
  const token = localStorage.getItem('stars_token')
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (response.status === 401) {
    handleUnauthorized()
  }
  if (!response.ok) {
    throw new Error('Export failed')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match ? match[1] : fallbackName

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function loginUser(role, identifier, password) {
  const endpoint = role === 'student' ? '/api/auth/student/login' : role === 'faculty' ? '/api/auth/teacher/login' : '/api/auth/admin/login'
  const payload = role === 'student'
    ? { registerNumber: identifier, password }
    : { email: identifier, password }

  return request(endpoint, { method: 'POST', body: payload, auth: false })
}

export async function getStudentProfile() {
  return request('/api/student/profile')
}

export async function updateStudentProfile(profileData) {
  return request('/api/student/profile', { method: 'PUT', body: profileData })
}

export async function getStudentActivities(page = 1, limit = 10) {
  return request(`/api/student/activities?page=${page}&limit=${limit}`)
}

export async function getStudentSubmissions(limit = 20) {
  return request(`/api/student/submissions?limit=${limit}`)
}

export async function getStudentPoints() {
  return request('/api/student/points')
}

export async function appealSubmission(id, reason) {
  return request(`/api/student/submission/${id}/appeal`, { method: 'POST', body: { reason } })
}

export async function getStudentNotifications(page = 1, limit = 20) {
  return request(`/api/student/notifications?page=${page}&limit=${limit}`)
}

export async function markNotificationRead(id) {
  return request(`/api/student/notifications/${id}/read`, { method: 'PUT' })
}

export async function markAllNotificationsRead() {
  return request('/api/student/notifications/read-all', { method: 'PUT' })
}

export async function getStudentLeaderboard(scope = 'batch') {
  return request(`/api/student/leaderboard?scope=${encodeURIComponent(scope)}`)
}

export async function getStudentDeadlineAlerts() {
  return request('/api/student/deadline-alerts')
}

export function downloadProgressCard() {
  return downloadFile('/api/student/progress-card', 'progress-card.pdf')
}

export async function submitStudentEvidence(formData, onProgress) {
  const token = localStorage.getItem('stars_token')

  if (typeof onProgress === 'function') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE_URL}/api/student/submission`)
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      }
      xhr.onload = () => {
        if (xhr.status === 401) {
          handleUnauthorized()
          reject(new Error('Session expired'))
          return
        }
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300 && data?.success !== false) {
            resolve(data)
          } else {
            reject(new Error(data?.message || 'Upload failed'))
          }
        } catch {
          reject(new Error('Upload failed'))
        }
      }
      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.send(formData)
    })
  }

  return request('/api/student/submission', { method: 'POST', body: formData, auth: true, isFormData: true })
}

export async function getTeacherSubmissions(limit = 20, status = 'Pending', search = '') {
  const query = new URLSearchParams({ limit: String(limit), status })
  if (search) query.set('search', search)
  return request(`/api/teacher/submissions/pending?${query.toString()}`)
}

export async function getTeacherStudents(search = '') {
  const query = new URLSearchParams()
  if (search) query.set('search', search)
  return request(`/api/teacher/students?${query.toString()}`)
}

export async function updateTeacherStudentRecords(id, payload) {
  return request(`/api/teacher/student/${id}/records`, { method: 'PUT', body: payload })
}

export async function bulkUpdateTeacherStudentRecords(formData) {
  return request('/api/teacher/students/records/bulk-upload', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })
}

export async function getSubmissionFileBlob(submissionId) {
  const token = localStorage.getItem('stars_token')
  const response = await fetch(`${API_BASE_URL}/api/submissions/${submissionId}/file`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Unable to load submission file')
  }

  return response.blob()
}

export async function getTeacherDashboard() {
  return request('/api/teacher/dashboard')
}

export async function approveSubmission(id, pointsAwarded, teacherRemarks) {
  return request(`/api/teacher/submission/${id}/approve`, {
    method: 'PUT',
    body: { pointsAwarded, teacherRemarks },
  })
}

export async function rejectSubmission(id, teacherRemarks) {
  return request(`/api/teacher/submission/${id}/reject`, {
    method: 'PUT',
    body: { teacherRemarks },
  })
}

export async function bulkApproveSubmissions(ids, payload = {}) {
  return request('/api/teacher/submissions/bulk-approve', {
    method: 'POST',
    body: { ids, ...payload },
  })
}

export async function bulkRejectSubmissions(ids, payload = {}) {
  return request('/api/teacher/submissions/bulk-reject', {
    method: 'POST',
    body: { ids, ...payload },
  })
}

export function exportTeacherSubmissions(status = 'Pending') {
  return downloadFile(`/api/teacher/submissions/export?status=${status}`, 'submissions.xlsx')
}

export function downloadTeacherReport() {
  return downloadFile('/api/teacher/report', 'faculty-report.pdf')
}

export async function runAiReview(submissionId) {
  return request(`/api/teacher/submission/${submissionId}/ai-review`, { method: 'POST' })
}

export async function applyAiReview(submissionId) {
  return request(`/api/teacher/submission/${submissionId}/ai-apply`, { method: 'POST' })
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function getAdminUsers() {
  return request('/api/admin/users')
}

export function exportAdminUsers(role = '') {
  return downloadFile(`/api/admin/users/export?role=${role}`, 'users.xlsx')
}

export async function getAdminUser(id) {
  return request(`/api/admin/users/${id}`)
}

export async function createUser(payload) {
  return request('/api/admin/users', { method: 'POST', body: payload })
}

export async function updateUser(id, payload) {
  return request(`/api/admin/users/${id}`, { method: 'PUT', body: payload })
}

export async function deleteUser(id) {
  return request(`/api/admin/users/${id}`, { method: 'DELETE' })
}

export async function resetUserPassword(id, newPassword = 'Welcome@123') {
  return request(`/api/admin/users/${id}/reset-password`, {
    method: 'PUT',
    body: { newPassword },
  })
}

export async function createDepartment(payload) {
  return request('/api/admin/departments', { method: 'POST', body: payload })
}

export async function getLookups() {
  return request('/api/admin/lookups')
}

export async function getAnalytics() {
  return request('/api/admin/analytics')
}

export async function bulkUploadUsers(formData) {
  return request('/api/admin/users/bulk-upload', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })
}

export async function bulkAssignFaculty(formData) {
  return request('/api/admin/users/bulk-assign-faculty', {
    method: 'POST',
    body: formData,
    isFormData: true,
  })
}

export function downloadAdminReport() {
  return downloadFile('/api/admin/report', 'institution-report.pdf')
}

export function downloadBulkTemplate() {
  return downloadFile('/api/admin/bulk-upload/template', 'students-bulk-upload-template.xlsx')
}

export async function getAdminActivities() {
  return request('/api/admin/activities')
}

export async function createAdminActivity(payload) {
  return request('/api/admin/activities', { method: 'POST', body: payload })
}

export async function updateAdminActivity(id, payload) {
  return request(`/api/admin/activities/${id}`, { method: 'PUT', body: payload })
}

export async function deleteAdminActivity(id) {
  return request(`/api/admin/activities/${id}`, { method: 'DELETE' })
}

export function exportAnalytics() {
  return downloadFile('/api/admin/analytics/export', 'analytics.xlsx')
}

export async function getAuditLogs(page = 1, limit = 20, action = '') {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (action) query.set('action', action)
  return request(`/api/admin/audit-logs?${query.toString()}`)
}

export async function getAcademicSettings() {
  return request('/api/admin/academic-year')
}

export async function updateAcademicSettings(payload) {
  return request('/api/admin/academic-year', { method: 'PUT', body: payload })
}

export async function rolloverAcademicYear(payload) {
  return request('/api/admin/academic-year/rollover', { method: 'POST', body: payload })
}

export async function runHodAiReview(submissionId) {
  return request(`/api/hod/submission/${submissionId}/ai-review`, { method: 'POST' })
}

export async function getHodSubmissions(limit = 50, flagged = false) {
  return request(`/api/hod/submissions/pending?limit=${limit}${flagged ? '&flagged=true' : ''}`)
}

export async function getHodDashboard() {
  return request('/api/hod/dashboard')
}

export function exportHodSubmissions(status = 'FacultyApproved') {
  return downloadFile(`/api/hod/submissions/export?status=${status}`, 'hod-submissions.xlsx')
}

export async function verifyHodSubmission(id, status, payload = {}) {
  const endpoint = status === 'Approved' ? 'approve' : 'reject'
  return request(`/api/hod/submission/${id}/${endpoint}`, { method: 'PUT', body: payload })
}

export async function bulkVerifyHodSubmissions(ids, status, payload = {}) {
  const endpoint = status === 'Approved' ? 'bulk-approve' : 'bulk-reject'
  return request(`/api/hod/submissions/${endpoint}`, {
    method: 'POST',
    body: { ids, ...payload },
  })
}

export async function lockSemester(batch) {
  return request('/api/hod/semester/lock', { method: 'PUT', body: { batch: batch || undefined } })
}

export async function unlockSemester(batch) {
  return request('/api/hod/semester/unlock', { method: 'PUT', body: { batch: batch || undefined } })
}

// ---------------------------------------------------------------------------
// Gamification - Badges, Streaks, Leaderboards
// ---------------------------------------------------------------------------

export async function getStudentStats(studentId) {
  return request(`/api/gamification/student/${studentId}/stats`)
}

export async function getStudentBadges(studentId, academicYear = '') {
  const query = new URLSearchParams()
  if (academicYear) query.set('academicYear', academicYear)
  return request(`/api/gamification/student/${studentId}/badges?${query.toString()}`)
}

export async function getDepartmentLeaderboard(departmentId, academicYear = '', limit = 10) {
  const query = new URLSearchParams({ limit: String(limit) })
  if (academicYear) query.set('academicYear', academicYear)
  return request(`/api/gamification/leaderboard/department/${departmentId}?${query.toString()}`)
}

export async function getStudentCoachInsights(studentId) {
  return request(`/api/gamification/student/${studentId}/coach`)
}

// ---------------------------------------------------------------------------
// Student — Points Ledger, Bookmarks, Comments
// ---------------------------------------------------------------------------

export async function getStudentPointsHistory() {
  return request('/api/student/points-history')
}

export async function getStudentBookmarks() {
  return request('/api/student/bookmarks')
}

export async function toggleStudentBookmark(activityId) {
  return request('/api/student/bookmarks/toggle', { method: 'POST', body: { activityId } })
}

export async function getSubmissionComments(submissionId) {
  return request(`/api/student/submission/${submissionId}/comments`)
}

export async function addSubmissionComment(submissionId, text) {
  return request(`/api/student/submission/${submissionId}/comments`, { method: 'POST', body: { text } })
}

// ---------------------------------------------------------------------------
// Admin — Department Stats
// ---------------------------------------------------------------------------

export async function getDepartmentStats() {
  return request('/api/admin/department-stats')
}

export async function getDepartmentAiSummary() {
  return request('/api/admin/ai/department-summary')
}

// ---------------------------------------------------------------------------
// Admin — AI Tools (activity suggestions, at-risk, trends, duplicates, digest)
// ---------------------------------------------------------------------------

export async function getActivitySuggestions({ activityName, vertical = '', maximumPoints = 100 }) {
  return request('/api/admin/ai/activity-suggestions', { method: 'POST', body: { activityName, vertical, maximumPoints } })
}

export async function getAtRiskStudents() {
  return request('/api/admin/ai/at-risk')
}

export async function notifyAtRiskStudents() {
  return request('/api/admin/ai/at-risk/notify', { method: 'POST' })
}

export async function getTrendAnalytics(months = 6) {
  return request(`/api/admin/ai/trends?months=${months}`)
}

export async function getFlaggedDuplicates() {
  return request('/api/admin/ai/duplicates')
}

export async function previewWeeklyDigest() {
  return request('/api/admin/ai/digest/preview', { method: 'POST', body: {} })
}

export async function sendWeeklyDigest() {
  return request('/api/admin/ai/digest/send', { method: 'POST' })
}

export async function semanticSearch(query) {
  return request('/api/search/semantic', { method: 'POST', body: { query } })
}

export async function getAiClearedCount() {
  return request('/api/teacher/submissions/ai-cleared-count')
}

export async function autoApproveAiCleared() {
  return request('/api/teacher/submissions/auto-approve-ai', { method: 'POST' })
}

// ---------------------------------------------------------------------------
// Bulk Operations & Exports
// ---------------------------------------------------------------------------

export function exportStudentsCSV(departmentId = '', academicYear = '') {
  const query = new URLSearchParams()
  if (departmentId) query.set('departmentId', departmentId)
  if (academicYear) query.set('academicYear', academicYear)
  return downloadFile(`/api/bulk/export/students/csv?${query.toString()}`, 'students.csv')
}

export function exportSubmissionsExcel(status = '', departmentId = '', academicYear = '') {
  const query = new URLSearchParams()
  if (status) query.set('status', status)
  if (departmentId) query.set('departmentId', departmentId)
  if (academicYear) query.set('academicYear', academicYear)
  return downloadFile(`/api/bulk/export/submissions/excel?${query.toString()}`, 'submissions.xlsx')
}

export function generateDepartmentReport(departmentId, academicYear = '') {
  const query = new URLSearchParams({ departmentId })
  if (academicYear) query.set('academicYear', academicYear)
  return downloadFile(`/api/bulk/export/department/report?${query.toString()}`, 'department-report.pdf')
}

export async function bulkImportStudents(csvData, departmentId, academicYear = '') {
  return request('/api/bulk/import/students', {
    method: 'POST',
    body: { csvData, departmentId, academicYear }
  })
}

export async function bulkUpdateSubmissions(submissionIds, status, remarks = '') {
  return request('/api/bulk/update/submissions', {
    method: 'POST',
    body: { submissionIds, status, remarks }
  })
}

export async function bulkAssignTeachers(assignments) {
  return request('/api/bulk/assign/teachers', {
    method: 'POST',
    body: { assignments }
  })
}

// ---------------------------------------------------------------------------
// Notification broadcast (principal/admin)
// ---------------------------------------------------------------------------

export async function broadcastDeadlineNotifications(windowDays = 7) {
  return request('/api/notifications/broadcast/deadlines', {
    method: 'POST',
    body: { windowDays }
  })
}

export async function previewDeadlineNotifications(windowDays = 7) {
  return request(`/api/notifications/broadcast/deadlines/preview?windowDays=${windowDays}`)
}
