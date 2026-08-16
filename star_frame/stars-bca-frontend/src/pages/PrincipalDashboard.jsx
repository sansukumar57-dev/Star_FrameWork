import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import Shell, { NAV } from '../components/Shell.jsx'
import { StatCard, Button, PageHeader, Card, Toast, ConfirmDialog, Field, Input, Select, EmptyState, StatusBadge, LoadingState, Modal } from '../components/UI.jsx'
import AiInsightsPanel from '../components/AiInsightsPanel.jsx'
import {
  getAdminUsers,
  getLookups,
  getAnalytics,
  createDepartment,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  exportAdminUsers,
  exportAnalytics,
  downloadAdminReport,
  getDepartmentAiSummary,
  getDepartmentStats,
  getTrendAnalytics,
  getAuditLogs,
  deleteAuditLog,
  getSchools,
  createSchool,
  updateSchool,
  deleteSchool,
} from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const initialDepartmentForm = {
  name: '',
  code: '',
  schoolId: '',
  status: 'Active',
}

const initialHodForm = {
  name: '',
  email: '',
  password: '',
  schoolId: '',
  departmentId: '',
  status: 'Active',
}

const initialUserForm = {
  role: 'student',
  accountType: 'hod',
  name: '',
  email: '',
  password: '',
  registerNo: '',
  school: '',
  department: '',
  schoolId: '',
  departmentId: '',
  assignedTeacher: '',
  assignedYear: '',
  year: '',
  batch: '',
  section: '',
}

const initialSchoolForm = {
  name: '',
  code: '',
  description: '',
  status: 'Active',
}

export default function PrincipalDashboard({ embedded = false }) {
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(initialUserForm)
  const [departmentForm, setDepartmentForm] = useState(initialDepartmentForm)
  const [hodForm, setHodForm] = useState(initialHodForm)
  const [editingId, setEditingId] = useState('')
  const [userPanelOpen, setUserPanelOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState([])
  const [lookups, setLookups] = useState({ schools: [], departments: [], faculty: [] })
  const [schools, setSchools] = useState([])
  const [schoolForm, setSchoolForm] = useState(initialSchoolForm)
  const [schoolPanelOpen, setSchoolPanelOpen] = useState(false)
  const [editingSchoolId, setEditingSchoolId] = useState('')
  const [savingSchool, setSavingSchool] = useState(false)
  const [selectedFaculty, setSelectedFaculty] = useState('all')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [confirm, setConfirm] = useState(null)
  const [exportingUsers, setExportingUsers] = useState(false)
  const [exportingAnalytics, setExportingAnalytics] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [deptStats, setDeptStats] = useState({ departments: [], verticalByDept: {} })
  const [trends, setTrends] = useState({ series: [], narrative: '', forecast: null })
  const [auditLogs, setAuditLogs] = useState([])
  const [studentsPage, setStudentsPage] = useState(1)
  const STUDENTS_PER_PAGE = 10
  const [loadErrors, setLoadErrors] = useState({})

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('stars_user') || '{}')
    } catch {
      return {}
    }
  }, [])

  async function handleExportUsers() {
    setExportingUsers(true)
    try {
      await exportAdminUsers('')
    } catch (error) {
      notify(error.message || 'Export failed', 'error')
    } finally {
      setExportingUsers(false)
    }
  }

  async function handleExportAnalytics() {
    setExportingAnalytics(true)
    try {
      await exportAnalytics()
    } catch (error) {
      notify(error.message || 'Export failed', 'error')
    } finally {
      setExportingAnalytics(false)
    }
  }

  async function handleReport() {
    setReporting(true)
    try {
      await downloadAdminReport()
    } catch (error) {
      notify(error.message || 'Unable to download report', 'error')
    } finally {
      setReporting(false)
    }
  }

  const selectedPortal = (() => {
    try { return localStorage.getItem('stars_portal') || '' } catch { return '' }
  })()
  const isDean = selectedPortal === 'dean' || (!selectedPortal && currentUser?.accountType === 'dean')
  const isHod = selectedPortal === 'hod' || (!selectedPortal && currentUser?.accountType === 'hod')

  const deanNav = useMemo(() => {
    if (!isDean) return null
    return NAV.principal.filter((link) => link.to !== '/principal/bulk-upload')
  }, [isDean])

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    if (tone !== 'error') window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    loadUsers()
    loadLookups()
    loadSchools()
    loadAnalytics()
    loadAiSummary()
    loadDepartmentStats()
    loadTrends()
    loadAuditLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAiSummary() {
    try {
      setAiSummaryLoading(true)
      const data = await getDepartmentAiSummary()
      setAiSummary(data.data?.summary || '')
    } catch {
      setAiSummary('AI department summary is unavailable right now.')
    } finally {
      setAiSummaryLoading(false)
    }
  }

  async function loadUsers() {
    try {
      const data = await getAdminUsers()
      setUsers(data.data || [])
    } catch (error) {
      notify(error.message || 'Unable to load users right now.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadLookups() {
    try {
      const data = await getLookups()
      setLookups(data.data || { schools: [], departments: [], faculty: [] })
      setLoadErrors((prev) => ({ ...prev, lookups: false }))
    } catch (error) {
      console.error(error)
      setLoadErrors((prev) => ({ ...prev, lookups: true }))
    }
  }

  async function loadSchools() {
    try {
      const data = await getSchools()
      setSchools(data.data || [])
      setLoadErrors((prev) => ({ ...prev, schools: false }))
    } catch (error) {
      console.error(error)
      setLoadErrors((prev) => ({ ...prev, schools: true }))
    }
  }

  async function submitSchool(e) {
    e.preventDefault()
    setSavingSchool(true)
    try {
      if (editingSchoolId) {
        await updateSchool(editingSchoolId, schoolForm)
        notify('School updated successfully.')
      } else {
        await createSchool(schoolForm)
        notify('School created successfully.')
      }
      setSchoolPanelOpen(false)
      setSchoolForm(initialSchoolForm)
      setEditingSchoolId('')
      await Promise.all([loadSchools(), loadLookups()])
    } catch (error) {
      notify(error.message || 'Unable to save school', 'error')
    } finally {
      setSavingSchool(false)
    }
  }

  function startEditingSchool(school) {
    setEditingSchoolId(school._id)
    setSchoolForm({
      name: school.name || '',
      code: school.code || '',
      description: school.description || '',
      status: school.status || 'Active',
    })
    setSchoolPanelOpen(true)
  }

  async function confirmDeleteSchool(id) {
    try {
      await deleteSchool(id)
      notify('School deleted successfully.')
      await Promise.all([loadSchools(), loadLookups()])
    } catch (error) {
      notify(error.message || 'Unable to delete school', 'error')
    } finally {
      setConfirm(null)
    }
  }

  async function confirmDeleteRecentLog(id) {
    try {
      await deleteAuditLog(id)
      notify('Audit log removed.', 'success')
      await loadAuditLogs()
    } catch (error) {
      notify(error.message || 'Unable to delete audit log', 'error')
    } finally {
      setConfirm(null)
    }
  }

  async function loadAnalytics() {
    try {
      const data = await getAnalytics()
      setAnalytics(data.data?.chartData || [])
      setLoadErrors((prev) => ({ ...prev, analytics: false }))
    } catch (error) {
      console.error(error)
      setLoadErrors((prev) => ({ ...prev, analytics: true }))
    }
  }

  async function loadDepartmentStats() {
    try {
      const data = await getDepartmentStats()
      setDeptStats({ departments: data.data?.departments || [], verticalByDept: data.data?.verticalByDept || {} })
      setLoadErrors((prev) => ({ ...prev, deptStats: false }))
    } catch (error) {
      console.error(error)
      setLoadErrors((prev) => ({ ...prev, deptStats: true }))
    }
  }

  async function loadTrends() {
    try {
      const data = await getTrendAnalytics(6)
      setTrends({
        series: data.data?.series || [],
        narrative: data.data?.narrative?.text || '',
        forecast: data.data?.forecast || null,
      })
      setLoadErrors((prev) => ({ ...prev, trends: false }))
    } catch (error) {
      console.error(error)
      setLoadErrors((prev) => ({ ...prev, trends: true }))
    }
  }

  async function loadAuditLogs() {
    try {
      const data = await getAuditLogs(1, 8)
      setAuditLogs(data.data?.logs || [])
      setLoadErrors((prev) => ({ ...prev, auditLogs: false }))
    } catch (error) {
      console.error(error)
      setLoadErrors((prev) => ({ ...prev, auditLogs: true }))
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const search = `${user.name || ''} ${user.email || ''} ${user.registerNo || user.registerNumber || user.regNo || ''}`.toLowerCase()
      return search.includes(query.toLowerCase())
    })
  }, [users, query])

  const studentCount = useMemo(() => users.filter((user) => user.role === 'student').length, [users])
  const facultyCount = useMemo(() => users.filter((user) => user.role === 'faculty').length, [users])
  const adminCount = useMemo(() => users.filter((user) => user.role === 'admin').length, [users])

  const selectedDepartmentOptions = useMemo(() => {
    if (!form.schoolId) return lookups.departments
    return lookups.departments.filter((department) => {
      const departmentSchoolId = department.schoolId?._id || department.schoolId || ''
      return departmentSchoolId.toString() === form.schoolId.toString()
    })
  }, [form.schoolId, lookups.departments])

  const facultyForSelectedDepartment = useMemo(() => {
    if (!form.departmentId) return lookups.faculty
    return lookups.faculty.filter((member) => {
      const memberDepartmentId = member.departmentId?._id || member.departmentId || ''
      return memberDepartmentId.toString() === form.departmentId.toString()
    })
  }, [form.departmentId, lookups.faculty])

  const groupedUsers = useMemo(() => {
    const hodDean = filteredUsers.filter((user) => user.role === 'admin' || user.accountType === 'dean' || user.accountType === 'hod')
    const facultyUsers = filteredUsers.filter((user) => user.role === 'faculty')
    const students = filteredUsers.filter((user) => user.role === 'student')
    return { hodDean, facultyUsers, students }
  }, [filteredUsers])

  const facultyFilterOptions = useMemo(() => {
    const facultyFromLookups = Array.isArray(lookups.faculty) ? lookups.faculty : []
    const facultyFromUsers = Array.isArray(groupedUsers.facultyUsers) ? groupedUsers.facultyUsers : []
    const combined = [...facultyFromLookups, ...facultyFromUsers]
    const seen = new Set()

    return combined.filter((member) => {
      const key = member?._id || member?.name || ''
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }).map((member) => ({
      value: member?._id || member?.name || '',
      label: member?.name || member?.email || 'Faculty',
    }))
  }, [groupedUsers.facultyUsers, lookups.faculty])

  const filteredStudentUsers = useMemo(() => {
    const studentUsers = Array.isArray(groupedUsers.students) ? groupedUsers.students : []
    if (selectedFaculty === 'all') return studentUsers

    const normalizedSelectedFaculty = `${selectedFaculty}`.trim().toLowerCase()

    return studentUsers.filter((student) => {
      const candidateValues = [
        student?.recommendedFaculty,
        student?.facultyName,
        student?.assignedFaculty,
        student?.assignedFacultyName,
        student?.assignedTeacher,
        student?.assignedTeacherName,
        student?.facultyId,
        student?.assignedFacultyId,
        student?.faculty?._id,
        student?.faculty?.name,
        student?.assignedTeacher?.name,
        student?.assignedTeacher?._id,
        student?.recommendedFacultyName,
      ]

      return candidateValues.some((value) => {
        if (!value) return false
        if (typeof value === 'object') {
          const nestedValue = `${value.name || value._id || ''}`.trim().toLowerCase()
          return nestedValue === normalizedSelectedFaculty
        }

        const normalizedValue = `${value}`.trim().toLowerCase()
        return normalizedValue === normalizedSelectedFaculty || normalizedValue.includes(normalizedSelectedFaculty)
      })
    })
  }, [groupedUsers.students, selectedFaculty])

  const chartTitle = isDean ? 'Department performance across your school' : isHod ? 'Year-level student performance' : 'Performance overview'

  const verticalChartData = useMemo(() => {
    const totals = new Map()
    Object.values(deptStats.verticalByDept || {}).forEach((verticalMap) => {
      Object.entries(verticalMap || {}).forEach(([vertical, points]) => {
        totals.set(vertical, (totals.get(vertical) || 0) + Number(points))
      })
    })
    const colors = ['var(--color-brand-500)', 'var(--color-leaf-500)', 'var(--color-amber-500)', 'var(--color-rose-400)', 'var(--color-sky-500)', 'var(--color-violet-500)', 'var(--color-slate-500)', 'var(--color-teal-500)']
    return Array.from(totals.entries())
      .map(([name, points], index) => ({ name, points, fill: colors[index % colors.length] }))
      .sort((a, b) => b.points - a.points)
  }, [deptStats.verticalByDept])

  const paginatedStudents = useMemo(() => {
    const list = filteredStudentUsers || []
    const start = (studentsPage - 1) * STUDENTS_PER_PAGE
    return list.slice(start, start + STUDENTS_PER_PAGE)
  }, [filteredStudentUsers, studentsPage])

  const totalStudentPages = useMemo(() => Math.max(1, Math.ceil((filteredStudentUsers || []).length / STUDENTS_PER_PAGE)), [filteredStudentUsers])

  useEffect(() => {
    setStudentsPage(1)
  }, [selectedFaculty, query])

  const deanDepartmentOptions = useMemo(() => {
    if (!isDean) return []
    return lookups.departments.filter((department) => {
      const schoolId = department.schoolId?._id || department.schoolId || ''
      return schoolId.toString() === (currentUser.schoolId || '').toString()
    })
  }, [currentUser.schoolId, isDean, lookups.departments])

  const filteredAnalytics = useMemo(() => {
    if (selectedDepartment === 'all') return analytics
    return analytics.filter((item) => item.departmentId?.toString() === selectedDepartment.toString())
  }, [analytics, selectedDepartment])

  const selectedDepartmentAnalytics = useMemo(() => {
    if (!selectedDepartment || selectedDepartment === 'all') return null
    return filteredAnalytics.find((item) => item.departmentId?.toString() === selectedDepartment.toString()) || null
  }, [filteredAnalytics, selectedDepartment])

  const topStudentsForDepartment = useMemo(() => {
    if (!selectedDepartment || selectedDepartment === 'all') return []
    return selectedDepartmentAnalytics?.topStudents || []
  }, [selectedDepartment, selectedDepartmentAnalytics])

  const selectedDepartmentName = useMemo(() => {
    return deanDepartmentOptions.find((option) => option._id?.toString() === selectedDepartment.toString())?.name || 'Selected department'
  }, [deanDepartmentOptions, selectedDepartment])

  async function submitDepartment(e) {
    e.preventDefault()
    try {
      await createDepartment({ ...departmentForm, schoolId: departmentForm.schoolId || currentUser.schoolId || '' })
      setDepartmentForm(initialDepartmentForm)
      notify('Department created successfully.')
      await Promise.all([loadLookups(), loadAnalytics()])
    } catch (error) {
      notify(error.message || 'Unable to create department', 'error')
    }
  }

  async function submitHod(e) {
    e.preventDefault()
    try {
      await createUser({
        ...hodForm,
        role: 'admin',
        accountType: 'hod',
        schoolId: hodForm.schoolId || currentUser.schoolId || undefined,
        departmentId: hodForm.departmentId || undefined,
      })
      setHodForm(initialHodForm)
      notify('HOD created successfully.')
      await Promise.all([loadUsers(), loadLookups()])
    } catch (error) {
      notify(error.message || 'Unable to create HOD', 'error')
    }
  }

  async function submitUser(e) {
    e.preventDefault()
    try {
      const payload = {
        ...form,
        schoolId: form.schoolId || currentUser.schoolId || undefined,
        departmentId: form.departmentId || currentUser.departmentId || undefined,
        school: form.school || currentUser.school || 'STAR',
        department: form.department || currentUser.department || '',
      }

      if (isDean) {
        payload.role = 'admin'
        payload.accountType = 'hod'
      }
      if (isDean && (payload.role !== 'admin' || payload.accountType !== 'hod')) {
        throw new Error('Dean accounts can only add HOD users.')
      }
      if (isHod && payload.role === 'admin') {
        throw new Error('HOD accounts can only add students or faculty users.')
      }

      if (editingId) {
        await updateUser(editingId, { ...payload, password: undefined })
      } else {
        await createUser(payload)
      }

      setForm(initialUserForm)
      setEditingId('')
      setUserPanelOpen(false)
      notify(editingId ? 'User updated successfully.' : 'User added successfully.')
      await Promise.all([loadUsers(), loadLookups(), loadAnalytics()])
    } catch (error) {
      notify(error.message || 'Unable to save user', 'error')
    }
  }

  async function confirmDelete(id) {
    try {
      await deleteUser(id)
      notify('User deleted successfully.')
      await loadUsers()
    } catch (error) {
      notify(error.message || 'Unable to delete user', 'error')
    } finally {
      setConfirm(null)
    }
  }

  async function confirmReset(id) {
    try {
      await resetUserPassword(id)
      notify('Password reset to Welcome@123.')
    } catch (error) {
      notify(error.message || 'Unable to reset password', 'error')
    } finally {
      setConfirm(null)
    }
  }

  function startEditingUser(user) {
    setEditingId(user._id)
    setUserPanelOpen(true)
    setForm({
      role: user.role || 'student',
      accountType: user.accountType || 'hod',
      name: user.name || '',
      email: user.email || '',
      password: '',
      registerNo: user.registerNo || user.registerNumber || user.regNo || '',
      school: user.school || '',
      department: user.department || '',
      schoolId: user.schoolId || '',
      departmentId: user.departmentId || '',
      assignedTeacher: user.assignedTeacher || user.assignedFacultyId || '',
      assignedYear: user.assignedYear || user.yearAssigned || '',
      year: user.year || '',
      batch: user.batch || user.semesterBatch || '',
      section: user.section || '',
    })
  }

  function actionButtons(user, isStudent = false) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (isStudent) {
              window.location.href = `/principal/edit-student/${user._id}`
            } else {
              startEditingUser(user)
            }
          }}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() =>
            setConfirm({
              id: user._id,
              title: 'Delete user',
              message: `Are you sure you want to delete ${user.name || 'this user'}? This action cannot be undone.`,
              confirmLabel: 'Delete',
              onConfirm: () => confirmDelete(user._id),
            })
          }
        >
          Delete
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setConfirm({
              id: user._id,
              title: 'Reset password',
              message: `Reset the password for ${user.name || 'this user'} to Welcome@123?`,
              confirmLabel: 'Reset',
              tone: 'primary',
              onConfirm: () => confirmReset(user._id),
            })
          }
        >
          Reset
        </Button>
      </div>
    )
  }

  if (loading) {
    return embedded ? (
      <LoadingState rows={3} />
    ) : (
      <Shell role={isHod ? 'hod' : 'principal'} userName={currentUser.name || 'Admin'} department={currentUser.department || 'User Management'} navLinks={deanNav}>
        <LoadingState rows={3} />
      </Shell>
    )
  }

  const pageContent = (
    <>
      <PageHeader
        title={isDean ? 'Dean Dashboard' : 'Admin Dashboard'}
        subtitle={
          isDean
            ? 'Review school-wide department performance and view the top students for each department.'
            : 'Track department performance, manage student records, and assign faculty quickly.'
        }
        crumbs={[isDean ? 'Dean' : 'Admin', isDean ? 'Dashboard' : 'User Management']}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isDean && <Button variant="outline" onClick={handleReport} loading={reporting}>⬇ PDF Report</Button>}
            <Button variant="outline" onClick={handleExportAnalytics} loading={exportingAnalytics}>⬇ Export Analytics</Button>
            <Button variant="outline" onClick={handleExportUsers} loading={exportingUsers}>⬇ Export Users</Button>
          </div>
        }
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Students" value={studentCount} sub="Managed learners" accent="brand" />
        <StatCard label="Faculty" value={facultyCount} sub="Teaching staff" accent="leaf" />
        <StatCard label="Admins" value={adminCount} sub="HOD/Dean accounts" accent="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Performance Analytics</h2>
                <p className="text-sm text-slate-400 mt-1">{chartTitle}</p>
              </div>
              {isDean && (
                <div className="w-full max-w-xs">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Department</label>
                  <Select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="!bg-card !border-rule">
                    <option value="all">All departments</option>
                    {deanDepartmentOptions.map((department) => (
                      <option key={department._id} value={department._id}>{department.name}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            <div className="h-72">
              {filteredAnalytics.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredAnalytics} onClick={(entry) => isDean && entry?.activePayload?.[0]?.payload?.departmentId && setSelectedDepartment(entry.activePayload[0].payload.departmentId)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 12 }} width={40} />
                    <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }} />
                    <Bar dataKey="performance" name="Performance" radius={[3, 3, 0, 0]} maxBarSize={48}>
                      {filteredAnalytics.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={['var(--color-brand-500)', 'var(--color-leaf-500)', 'var(--color-amber-500)', 'var(--color-sky-500)', 'var(--color-violet-500)', 'var(--color-teal-500)'][index % 6]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : loadErrors.analytics ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm font-medium text-ink">Could not load analytics</p>
                  <p className="max-w-sm text-sm text-slate-400">Something went wrong while fetching analytics. Try again.</p>
                  <Button variant="outline" size="sm" onClick={loadAnalytics}>Retry</Button>
                </div>
              ) : (
                <EmptyState icon="▤" title="No analytics data yet" description="Analytics will appear here once students start earning STAR points." />
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">AI Department Summary</h2>
                <p className="text-sm text-slate-400 mt-1">Generated from recent department analytics.</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadAiSummary} loading={aiSummaryLoading}>Refresh</Button>
            </div>
            {aiSummaryLoading ? <LoadingState rows={2} /> : <p className="text-sm leading-7 text-slate-600">{aiSummary || 'AI summary is not available yet.'}</p>}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Performance Trends</h2>
                <p className="text-sm text-slate-400 mt-1">Monthly STAR points with a 6-month forecast.</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadTrends}>Refresh</Button>
            </div>
            {trends.series.length ? (
              <>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends.series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--color-slate-400)', fontSize: 11 }} width={40} />
                      <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }} />
                      <Bar dataKey="points" name="Points" fill="var(--color-brand-500)" radius={[3, 3, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {trends.forecast && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50/60 px-3 py-2 font-mono text-xs text-brand-700">
                    ⟶ {trends.forecast.nextMonth}: ~{trends.forecast.nextPoints} pts projected
                  </p>
                )}
                {trends.narrative && <p className="mt-3 text-sm leading-7 text-slate-600">{trends.narrative}</p>}
              </>
            ) : loadErrors.trends ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-rule bg-card/50 px-6 py-12 text-center">
                <p className="text-sm font-medium text-ink">Could not load trends</p>
                <p className="max-w-sm text-sm text-slate-400">Something went wrong while fetching performance trends. Try again.</p>
                <Button variant="outline" size="sm" onClick={loadTrends}>Retry</Button>
              </div>
            ) : (
              <EmptyState icon="⟶" title="No trend data yet" description="Monthly trends will appear as students earn approved points." />
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-4">
              <h2 className="font-display text-lg font-semibold text-ink">Vertical-wise Institution Points</h2>
              <p className="text-sm text-slate-400 mt-1">Approved STAR points by vertical across the institution.</p>
            </div>
            {verticalChartData.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={verticalChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid horizontal={false} stroke="var(--color-rule)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-slate-400)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} axisLine={false} tickLine={false} width={96} />
                    <Tooltip cursor={{ fill: 'var(--color-paper)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-rule)', background: 'var(--color-card)' }} />
                    <Bar dataKey="points" radius={[0, 3, 3, 0]} maxBarSize={18}>
                      {verticalChartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : loadErrors.deptStats ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-rule bg-card/50 px-6 py-12 text-center">
                <p className="text-sm font-medium text-ink">Could not load vertical data</p>
                <p className="max-w-sm text-sm text-slate-400">Something went wrong while fetching vertical-wise points. Try again.</p>
                <Button variant="outline" size="sm" onClick={loadDepartmentStats}>Retry</Button>
              </div>
            ) : (
              <EmptyState icon="▦" title="No vertical data" description="Vertical-wise points will appear once submissions are approved." />
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Recent Activity</h2>
                <p className="text-sm text-slate-400 mt-1">Latest audit-log events across the system.</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadAuditLogs}>Refresh</Button>
            </div>
            {auditLogs.length ? (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log._id} className="flex items-start gap-3 rounded-md border border-rule px-3 py-2.5 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-paper font-mono text-[10px] text-slate-400">·</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{log.action}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {log.actorId?.name || 'System'} · {new Date(log.createdAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                    {!isHod && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirm({
                            id: log._id,
                            title: 'Remove audit log',
                            message: `Remove this recent activity (${log.action})? This action cannot be undone.`,
                            confirmLabel: 'Remove',
                            onConfirm: () => confirmDeleteRecentLog(log._id),
                          })
                        }
                      >
                        &times;
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : loadErrors.auditLogs ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-rule bg-card/50 px-6 py-12 text-center">
                <p className="text-sm font-medium text-ink">Could not load recent activity</p>
                <p className="max-w-sm text-sm text-slate-400">Something went wrong while fetching audit logs. Try again.</p>
                <Button variant="outline" size="sm" onClick={loadAuditLogs}>Retry</Button>
              </div>
            ) : (
              <EmptyState icon="◷" title="No recent activity" description="Audit events will appear here as users take actions." />
            )}
          </Card>

          <AiInsightsPanel />

          {!isHod && (
            <Card className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">Schools</h2>
                  <p className="text-sm text-slate-400 mt-1">Manage the schools available across the institution.</p>
                </div>
                <Button
                  onClick={() => {
                    setEditingSchoolId('')
                    setSchoolForm(initialSchoolForm)
                    setSchoolPanelOpen(true)
                  }}
                >
                  + Add School
                </Button>
              </div>
              {schools.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                      <tr>
                        <th className="text-left font-medium px-3 py-2.5">School</th>
                        <th className="text-left font-medium px-3 py-2.5">Code</th>
                        <th className="text-left font-medium px-3 py-2.5">Description</th>
                        <th className="text-left font-medium px-3 py-2.5">Status</th>
                        <th className="text-right font-medium px-3 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map((school) => (
                        <tr key={school._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                          <td className="px-3 py-2.5 font-medium text-ink">{school.name}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{school.code || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500 max-w-[220px] truncate">{school.description || '—'}</td>
                          <td className="px-3 py-2.5"><StatusBadge status={school.status || 'Active'} /></td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => startEditingSchool(school)}>Edit</Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  setConfirm({
                                    id: school._id,
                                    title: 'Delete school',
                                    message: `Are you sure you want to delete ${school.name || 'this school'}? Schools with linked departments or users cannot be deleted.`,
                                    confirmLabel: 'Delete',
                                    onConfirm: () => confirmDeleteSchool(school._id),
                                  })
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : loadErrors.schools ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-rule bg-card/50 px-6 py-12 text-center">
                  <p className="text-sm font-medium text-ink">Could not load schools</p>
                  <p className="max-w-sm text-sm text-slate-400">Something went wrong while fetching schools. Try again.</p>
                  <Button variant="outline" size="sm" onClick={loadSchools}>Retry</Button>
                </div>
              ) : (
                <EmptyState icon="▣" title="No schools yet" description="Create a school to start organising departments, faculty and students." />
              )}
            </Card>
          )}

          {isDean && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="font-display text-lg font-semibold text-ink">Add Department</h2>
                <p className="text-sm text-slate-400 mt-1">Create a new department for your school only.</p>
                <form onSubmit={submitDepartment} className="mt-4 space-y-3">
                  <Field label="Department name">
                    <Input required value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} placeholder="Department name" />
                  </Field>
                  <Field label="Code">
                    <Input required value={departmentForm.code} onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })} placeholder="Code (for example BCA)" />
                  </Field>
                  <Field label="School">
                    <div className="flex gap-2">
                      <Select value={departmentForm.schoolId} onChange={(e) => setDepartmentForm({ ...departmentForm, schoolId: e.target.value })} className="flex-1">
                        <option value="">Select school</option>
                        {lookups.schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingSchoolId('')
                          setSchoolForm(initialSchoolForm)
                          setSchoolPanelOpen(true)
                        }}
                      >
                        + New
                      </Button>
                    </div>
                    {!lookups.schools.length && <p className="mt-1.5 text-xs text-amber-700">No schools yet — create one first using &quot;+ New&quot;.</p>}
                  </Field>
                  <Field label="Status">
                    <Select value={departmentForm.status} onChange={(e) => setDepartmentForm({ ...departmentForm, status: e.target.value })}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </Select>
                  </Field>
                  <Button type="submit" className="w-full">Create Department</Button>
                </form>
              </Card>

              <Card className="p-5">
                <h2 className="font-display text-lg font-semibold text-ink">Add HOD</h2>
                <p className="text-sm text-slate-400 mt-1">Assign a head of department within your school.</p>
                <form onSubmit={submitHod} className="mt-4 space-y-3">
                  <Field label="HOD name">
                    <Input required value={hodForm.name} onChange={(e) => setHodForm({ ...hodForm, name: e.target.value })} placeholder="HOD name" />
                  </Field>
                  <Field label="Email">
                    <Input required type="email" value={hodForm.email} onChange={(e) => setHodForm({ ...hodForm, email: e.target.value })} placeholder="Email" />
                  </Field>
                  <Field label="Password">
                    <Input required type="password" minLength="6" value={hodForm.password} onChange={(e) => setHodForm({ ...hodForm, password: e.target.value })} placeholder="Password" />
                  </Field>
                  <Field label="School">
                    <Select value={hodForm.schoolId} onChange={(e) => {
                      const selectedSchoolId = e.target.value
                      setHodForm({ ...hodForm, schoolId: selectedSchoolId, departmentId: '' })
                    }}>
                      <option value="">Select school</option>
                      {lookups.schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Department">
                    <Select value={hodForm.departmentId} onChange={(e) => setHodForm({ ...hodForm, departmentId: e.target.value })} disabled={!hodForm.schoolId}>
                      <option value="">Select department</option>
                      {lookups.departments.filter((department) => (department.schoolId?._id || department.schoolId || '').toString() === hodForm.schoolId.toString()).map((department) => (
                        <option key={department._id} value={department._id}>{department.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select value={hodForm.status} onChange={(e) => setHodForm({ ...hodForm, status: e.target.value })}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </Select>
                  </Field>
                  <Button type="submit" className="w-full">Create HOD</Button>
                </form>
              </Card>
            </div>
          )}
        </div>

        {isDean ? (
          <Card className="p-5 self-start">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Department performance view</h2>
                <p className="text-sm text-slate-400 mt-1">Choose a department to view its top 3 students by approved performance points.</p>
              </div>
              <div className="w-full max-w-xs">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Department</label>
                <Select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="!bg-card !border-rule">
                  <option value="all">All departments</option>
                  {deanDepartmentOptions.map((department) => (
                    <option key={department._id} value={department._id}>{department.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            {selectedDepartment !== 'all' ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-ink">Top 3 students in {selectedDepartmentName}</h3>
                    <p className="text-sm text-slate-400 mt-1">Ranked by average approved points.</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {topStudentsForDepartment.length ? topStudentsForDepartment.map((student, index) => (
                    <div key={student._id} className="flex items-center justify-between rounded-md bg-card px-3 py-2 text-sm border border-rule">
                      <span className="font-medium text-ink">{index + 1}. {student.name}</span>
                      <span className="text-slate-500">{student.totalPoints || 0} pts</span>
                    </div>
                  )) : <div className="text-sm text-slate-400">No student performance data yet for this department.</div>}
                </div>
              </div>
            ) : (
              <EmptyState icon="★" title="Pick a department" description="Choose a department to see its top-performing students." />
            )}
          </Card>
        ) : (
          <Card className="p-5 self-start">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">User Management</h2>
                <p className="text-sm text-slate-400 mt-1">Add or edit students, faculty, HODs, and deans.</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users"
                  className="!w-auto min-w-[160px] !bg-card !border-rule"
                />
        <Button onClick={() => {
          setEditingId('')
          setForm({
            ...initialUserForm,
            schoolId: isHod ? (currentUser.schoolId || '') : '',
            school: isHod ? (currentUser.school || '') : '',
            departmentId: isHod ? (currentUser.departmentId || '') : '',
            department: isHod ? (currentUser.department || '') : '',
          })
          setUserPanelOpen(true)
        }}>+ Add User</Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={userPanelOpen}
        onClose={() => { setUserPanelOpen(false); setEditingId(''); setForm(initialUserForm) }}
        size="md"
        title={editingId ? 'Edit User' : 'Add User'}
        subtitle={editingId ? `Editing ${form.name || 'user'}` : 'Create a student, faculty, HOD, or dean account.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setUserPanelOpen(false); setEditingId(''); setForm(initialUserForm) }}>Cancel</Button>
            <Button form="user-form" type="submit">{editingId ? 'Update User' : 'Create User'}</Button>
          </>
        }
      >
        {editingId && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50/70 px-3 py-2 text-sm text-brand-700">
            <span aria-hidden="true">✎</span>
            <span>Editing <strong>{form.name || 'this user'}</strong> — changes are saved on submit.</span>
          </div>
        )}
        <form id="user-form" onSubmit={submitUser} className="space-y-3">
              <Field label="Role">
                <Select
                  value={isDean ? 'admin' : form.role}
                  onChange={(e) => {
                    const nextRole = e.target.value
                    if (isDean) {
                      setForm({ ...form, role: 'admin', accountType: 'hod' })
                      return
                    }
                    if (isHod && nextRole === 'admin') {
                      setForm({ ...form, role: 'student', accountType: null })
                      return
                    }
                    setForm({ ...form, role: nextRole, accountType: nextRole === 'admin' ? form.accountType || 'hod' : null })
                  }}
                >
                  {isDean ? (
                    <option value="admin">Admin (HOD)</option>
                  ) : (
                    <>
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                      {!isDean && !isHod && <option value="admin">Admin</option>}
                      {isDean && <option value="admin">Admin (HOD)</option>}
                    </>
                  )}
                </Select>
                {isDean && <p className="mt-1.5 text-xs text-slate-500">Dean accounts can only create HOD users.</p>}
              </Field>
              {(form.role === 'admin' || isDean) && (
                <Field label="Account type">
                  <Select value={form.accountType || 'hod'} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                    <option value="hod">HOD</option>
                    {!isDean && <option value="dean">Dean</option>}
                  </Select>
                </Field>
              )}
              <Field label="Name">
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
              </Field>
              {form.role !== 'student' && (
                <Field label="Email">
                  <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
                </Field>
              )}
              {!isHod && (
                <Field label="School">
                  <Select
                    value={form.schoolId}
                    onChange={(event) => {
                      const selectedSchoolId = event.target.value
                      const selectedSchool = lookups.schools.find((school) => school._id === selectedSchoolId)
                      setForm({ ...form, schoolId: selectedSchoolId, school: selectedSchool?.name || '', departmentId: '', department: '' })
                    }}
                  >
                    <option value="">Select school</option>
                    {lookups.schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
                  </Select>
                </Field>
              )}
              {!isHod && (form.role === 'student' || form.role === 'faculty' || (form.role === 'admin' && form.accountType === 'hod')) && (
                <Field label="Department">
                  <Select
                    value={form.departmentId}
                    onChange={(event) => {
                      const selectedDepartmentId = event.target.value
                      const selectedDepartment = selectedDepartmentOptions.find((department) => department._id === selectedDepartmentId)
                      setForm({ ...form, departmentId: selectedDepartmentId, department: selectedDepartment?.name || '' })
                    }}
                  >
                    <option value="">Select department</option>
                    {selectedDepartmentOptions.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
                  </Select>
                </Field>
              )}
              {isHod && (
                <div className="rounded-md border border-rule bg-paper/60 px-3 py-2.5 text-sm">
                  <p className="text-xs text-slate-400 mb-0.5">Department</p>
                  <p className="font-medium text-ink">{currentUser.department || 'Your department'}</p>
                </div>
              )}
              {form.role === 'student' && (
                <Field label="Register number">
                  <Input required value={form.registerNo} onChange={(e) => setForm({ ...form, registerNo: e.target.value })} placeholder="Register number" />
                </Field>
              )}
              {form.role === 'faculty' && (
                <Field label="Assigned year">
                  <Input value={form.assignedYear} onChange={(e) => setForm({ ...form, assignedYear: e.target.value })} placeholder="Assigned year" />
                </Field>
              )}
              {form.role === 'student' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Year">
                      <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Year" />
                    </Field>
                    <Field label="Batch">
                      <Input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="Batch" />
                    </Field>
                    <Field label="Section">
                      <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Section" />
                    </Field>
                  </div>
                  <Field label="Assigned faculty">
                    <Select value={form.assignedTeacher} onChange={(e) => setForm({ ...form, assignedTeacher: e.target.value })}>
                      <option value="">Select assigned faculty</option>
                      {facultyForSelectedDepartment.map((member) => (
                        <option key={member._id} value={member._id}>{member.name}</option>
                      ))}
                    </Select>
                  </Field>
                </>
              )}
              {!editingId && (
                <Field label="Password">
                  <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" />
                </Field>
              )}
            </form>
      </Modal>

      <Modal
        open={schoolPanelOpen}
        onClose={() => { setSchoolPanelOpen(false); setEditingSchoolId(''); setSchoolForm(initialSchoolForm) }}
        size="md"
        title={editingSchoolId ? 'Edit School' : 'Add School'}
        subtitle={editingSchoolId ? `Editing ${schoolForm.name || 'school'}` : 'Create a new school to organise departments, faculty, and students.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setSchoolPanelOpen(false); setEditingSchoolId(''); setSchoolForm(initialSchoolForm) }}>Cancel</Button>
            <Button form="school-form" type="submit" loading={savingSchool}>{editingSchoolId ? 'Update School' : 'Create School'}</Button>
          </>
        }
      >
        <form id="school-form" onSubmit={submitSchool} className="space-y-3">
          <Field label="School name">
            <Input required value={schoolForm.name} onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })} placeholder="School name (for example STAR)" />
          </Field>
          <Field label="Code">
            <Input value={schoolForm.code} onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value })} placeholder="Code (for example STAR)" />
          </Field>
          <Field label="Description">
            <Input value={schoolForm.description} onChange={(e) => setSchoolForm({ ...schoolForm, description: e.target.value })} placeholder="Short description" />
          </Field>
          <Field label="Status">
            <Select value={schoolForm.status} onChange={(e) => setSchoolForm({ ...schoolForm, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </Field>
        </form>
      </Modal>

      {!isDean && (
        <Card className="p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-ink">Users</h2>
          </div>
          <div className="space-y-6">
            {[
              { title: 'HOD & Dean', users: groupedUsers.hodDean || [] },
              { title: 'Faculty', users: groupedUsers.facultyUsers || [] },
              { title: 'Students', users: paginatedStudents || [] },
            ].map((group) => (
              <div key={group.title}>
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h3 className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">{group.title}</h3>
                  {group.title === 'Students' && (
                    <div className="flex w-full max-w-xs flex-col gap-2 md:w-auto">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Filter by Faculty</label>
                      <Select
                        value={selectedFaculty}
                        onChange={(event) => setSelectedFaculty(event.target.value)}
                        className="!bg-card !border-rule"
                      >
                        <option value="all">All Faculties</option>
                        {facultyFilterOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>

                {Array.isArray(group.users) && group.users.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-paper/60 text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                        <tr>
                          <th className="text-left font-medium px-3 py-2.5">Name</th>
                          {group.title === 'Students' ? (
                            <>
                              <th className="text-left font-medium px-3 py-2.5">Register</th>
                              <th className="text-left font-medium px-3 py-2.5">Faculty</th>
                              <th className="text-left font-medium px-3 py-2.5">Status</th>
                            </>
                          ) : (
                            <>
                              <th className="text-left font-medium px-3 py-2.5">Role</th>
                              <th className="text-left font-medium px-3 py-2.5">Identifier</th>
                            </>
                          )}
                          <th className="text-right font-medium px-3 py-2.5">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.users.map((user) => (
                          <tr key={user._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                            <td className="px-3 py-2.5 font-medium text-ink">
                              <div className="flex items-center gap-2.5">
                                <span className="h-8 w-8 rounded-full bg-ink text-paper flex items-center justify-center font-semibold text-xs shrink-0">
                                  {user.name?.[0] || '?'}
                                </span>
                                {user.name}
                              </div>
                            </td>
                            {group.title === 'Students' ? (
                              <>
                                <td className="px-3 py-2.5 text-slate-500">{user.registerNo || user.registerNumber || user.regNo || '—'}</td>
                                <td className="px-3 py-2.5 text-slate-500">{user.recommendedFaculty || user.assignedTeacher || user.assignedFacultyName || user.facultyName || user.assignedFacultyId || '—'}</td>
                                <td className="px-3 py-2.5"><StatusBadge status={user.status || 'Active'} /></td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2.5 text-slate-500">{user.role}{user.accountType ? ` / ${user.accountType}` : ''}</td>
                                <td className="px-3 py-2.5 text-slate-500">{user.registerNo || user.registerNumber || user.regNo || user.email || '—'}</td>
                              </>
                            )}
                            <td className="px-3 py-2.5 text-right">{actionButtons(user, group.title === 'Students')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon="●" title={group.title === 'Students' ? 'No students found' : `No ${group.title.toLowerCase()} found`} description={group.title === 'Students' ? 'No students found for this faculty.' : `No ${group.title.toLowerCase()} accounts exist yet.`} />
                )}
                {group.title === 'Students' && totalStudentPages > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="font-mono text-[11px] text-slate-400">
                      Page {studentsPage} of {totalStudentPages} · {(filteredStudentUsers || []).length} students
                    </p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={studentsPage <= 1} onClick={() => setStudentsPage((prev) => Math.max(1, prev - 1))}>Prev</Button>
                      <Button size="sm" variant="outline" disabled={studentsPage >= totalStudentPages} onClick={() => setStudentsPage((prev) => Math.min(totalStudentPages, prev + 1))}>Next</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone || 'danger'}
        onConfirm={confirm?.onConfirm}
      />
    </>
  )

  return embedded ? (
    pageContent
  ) : (
    <Shell role={isHod ? 'hod' : 'principal'} userName={currentUser.name || 'Admin'} department={currentUser.department || 'User Management'} navLinks={deanNav}>
      {pageContent}
    </Shell>
  )
}
