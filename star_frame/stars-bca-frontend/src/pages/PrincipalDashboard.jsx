import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Shell, { NAV } from '../components/Shell.jsx'
import { StatCard, Button, PageHeader, Card, Toast, ConfirmDialog, Field, Input, Select, EmptyState, StatusBadge, LoadingState } from '../components/UI.jsx'
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

export default function PrincipalDashboard() {
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(initialUserForm)
  const [departmentForm, setDepartmentForm] = useState(initialDepartmentForm)
  const [hodForm, setHodForm] = useState(initialHodForm)
  const [editingId, setEditingId] = useState('')
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState([])
  const [lookups, setLookups] = useState({ schools: [], departments: [], faculty: [] })
  const [selectedFaculty, setSelectedFaculty] = useState('all')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [confirm, setConfirm] = useState(null)
  const [exportingUsers, setExportingUsers] = useState(false)
  const [exportingAnalytics, setExportingAnalytics] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)

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

  const isDean = currentUser?.accountType === 'dean'
  const isHod = currentUser?.accountType === 'hod'

  const deanNav = useMemo(() => {
    if (!isDean) return null
    return NAV.principal.filter((link) => link.to !== '/principal/bulk-upload')
  }, [isDean])

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    loadUsers()
    loadLookups()
    loadAnalytics()
    loadAiSummary()
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
    } catch (error) {
      console.error(error)
    }
  }

  async function loadAnalytics() {
    try {
      const data = await getAnalytics()
      setAnalytics(data.data?.chartData || [])
    } catch (error) {
      console.error(error)
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
          variant="outline"
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
    return (
      <Shell role={isHod ? 'hod' : 'principal'} userName={currentUser.name || 'Admin'} department={currentUser.department || 'User Management'} navLinks={deanNav}>
        <LoadingState rows={3} />
      </Shell>
    )
  }

  return (
    <Shell role={isHod ? 'hod' : 'principal'} userName={currentUser.name || 'Admin'} department={currentUser.department || 'User Management'} navLinks={deanNav}>
      <PageHeader
        title={isDean ? 'Dean Dashboard' : 'Admin Dashboard'}
        subtitle={
          isDean
            ? 'Review school-wide department performance and view the top students for each department.'
            : 'Track department performance, manage student records, and assign faculty quickly.'
        }
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
                    <Bar dataKey="performance" fill="var(--color-brand-500)" radius={[3, 3, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
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

          <AiInsightsPanel />

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
                    <Select value={departmentForm.schoolId} onChange={(e) => setDepartmentForm({ ...departmentForm, schoolId: e.target.value })}>
                      <option value="">Select school</option>
                      {lookups.schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
                    </Select>
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
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Create / Update User</h2>
                <p className="text-sm text-slate-400 mt-1">Manage students, faculty, HODs, and deans from one form.</p>
              </div>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users"
                className="!w-auto min-w-[160px] !bg-card !border-rule"
              />
            </div>

            <form onSubmit={submitUser} className="space-y-3">
              <Field label="Role">
                <Select
                  value={form.role}
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
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  {!isDean && !isHod && <option value="admin">Admin</option>}
                  {isDean && <option value="admin">Admin (HOD)</option>}
                </Select>
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
              {(form.role === 'student' || form.role === 'faculty' || (form.role === 'admin' && form.accountType === 'hod')) && (
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
              <Button type="submit" className="w-full">{editingId ? 'Update User' : 'Create User'}</Button>
            </form>
          </Card>
        )}
      </div>

      {!isDean && (
        <Card className="p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-ink">Users</h2>
          </div>
          <div className="space-y-6">
            {[
              { title: 'HOD & Dean', users: groupedUsers.hodDean || [] },
              { title: 'Faculty', users: groupedUsers.facultyUsers || [] },
              { title: 'Students', users: filteredStudentUsers || [] },
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
    </Shell>
  )
}
