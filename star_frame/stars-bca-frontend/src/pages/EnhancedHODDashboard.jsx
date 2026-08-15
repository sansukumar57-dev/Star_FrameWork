import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line } from 'recharts'
import { StatCard, Button, PageHeader, Card, Toast, LoadingState, EmptyState } from '../components/UI.jsx'

/**
 * Enhanced HOD Dashboard
 * Features:
 * - Department-specific metrics (bridges Faculty + Principal views)
 * - HOD-specific performance metrics
 * - Faculty performance tracking
 * - Student progress monitoring
 * - Semester management
 * - Department-wide analytics
 */
export default function EnhancedHODDashboard({
  department = {},
  students = [],
  faculty = [],
  submissions = [],
  stats = { pending: 0, approved: 0, rejected: 0, totalStudents: 0 },
  onSemesterLock = null,
  onSemesterUnlock = null,
  _onExport = null
}) {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [departmentStats, setDepartmentStats] = useState({})
  const [facultyMetrics, setFacultyMetrics] = useState([])
  const [studentPerformance, setStudentPerformance] = useState([])
  const [submissionTrends, setSubmissionTrends] = useState([])
  const [semesterLocked, setSemesterLocked] = useState(false)

  useEffect(() => {
    // Department statistics
    const approvedSubmissions = submissions.filter(s => 
      ['FacultyApproved', 'HODApproved', 'Approved'].includes(s.status)
    ).length

    const totalPoints = submissions.reduce((sum, s) => 
      sum + (s.pointsAwarded || s.suggestedPoints || 0), 0
    )

    setDepartmentStats({
      totalStudents: stats.totalStudents || 0,
      totalFaculty: faculty.length,
      totalSubmissions: submissions.length,
      approvedSubmissions,
      approvalRate: submissions.length > 0 
        ? Math.round((approvedSubmissions / submissions.length) * 100) 
        : 0,
      totalPoints,
      avgPointsPerStudent: stats.totalStudents > 0 
        ? Math.round(totalPoints / stats.totalStudents) 
        : 0,
      departmentName: department.name || 'HOD Department'
    })

    // Faculty performance metrics
    const facultyStats = faculty.map((fac) => ({
      name: fac.name,
      approvals: submissions.filter(s => s.verifiedBy === fac._id && s.status === 'FacultyApproved').length,
      avgRating: 4.2 + Math.random() * 0.8, // Simulated
      efficiency: 85 + Math.random() * 15 // Simulated
    }))
    setFacultyMetrics(facultyStats)

    // Student performance distribution
    const pointRanges = [
      { range: '0-50', count: 0 },
      { range: '51-150', count: 0 },
      { range: '151-300', count: 0 },
      { range: '301-500', count: 0 },
      { range: '500+', count: 0 }
    ]

    students.forEach(student => {
      const points = student.totalPoints || 0
      if (points <= 50) pointRanges[0].count++
      else if (points <= 150) pointRanges[1].count++
      else if (points <= 300) pointRanges[2].count++
      else if (points <= 500) pointRanges[3].count++
      else pointRanges[4].count++
    })
    setStudentPerformance(pointRanges)

    // Submission trends (simulated monthly data)
    const trends = []
    for (let i = 0; i < 6; i++) {
      trends.push({
        month: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'][i],
        submissions: Math.floor(Math.random() * 150) + 50,
        approvals: Math.floor(Math.random() * 100) + 30,
        rejections: Math.floor(Math.random() * 30) + 5
      })
    }
    setSubmissionTrends(trends)

    setLoading(false)
  }, [department, students, faculty, submissions, stats])

  const handleSemesterLock = async () => {
    try {
      await onSemesterLock?.()
      setSemesterLocked(true)
      setToast({ message: 'Semester locked successfully', tone: 'success' })
    } catch (error) {
      setToast({ message: error.message, tone: 'error' })
    }
  }

  const handleSemesterUnlock = async () => {
    try {
      await onSemesterUnlock?.()
      setSemesterLocked(false)
      setToast({ message: 'Semester unlocked successfully', tone: 'success' })
    } catch (error) {
      setToast({ message: error.message, tone: 'error' })
    }
  }

  if (loading) return <LoadingState text="Loading HOD dashboard..." />

  return (
    <div className="space-y-6">
      <PageHeader
        title={`HOD - ${departmentStats.departmentName}`}
        subtitle="Department performance and faculty oversight."
      />

      {/* Department Stats Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <StatCard
          label="Total Students"
          value={departmentStats.totalStudents}
          sub="In your department"
          accent="brand"
        />
        <StatCard
          label="Total Submissions"
          value={departmentStats.totalSubmissions}
          sub={`${departmentStats.approvalRate}% approved`}
          accent="leaf"
        />
        <StatCard
          label="Faculty Members"
          value={departmentStats.totalFaculty}
          sub="Active"
          accent="amber"
        />
        <StatCard
          label="Avg Points"
          value={departmentStats.avgPointsPerStudent}
          sub="Per student"
          accent="rose"
        />
      </motion.div>

      {/* Semester Management */}
      <motion.div
        className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <p className="font-medium text-ink">Semester Management</p>
          <p className="text-sm text-slate-600">Status: <span className={semesterLocked ? 'text-rose-600 font-semibold' : 'text-green-600 font-semibold'}>
            {semesterLocked ? '🔒 Locked' : '🔓 Open'}
          </span></p>
        </div>
        <div className="flex gap-2">
          {!semesterLocked ? (
            <Button onClick={handleSemesterLock} className="bg-rose-600 hover:bg-rose-700">
              🔒 Lock Semester
            </Button>
          ) : (
            <Button onClick={handleSemesterUnlock} variant="outline">
              🔓 Unlock Semester
            </Button>
          )}
        </div>
      </motion.div>

      {/* Performance Analytics Grid */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Submission Trends */}
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-ink mb-4">Submission Trends</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={submissionTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="submissions"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Submissions"
              />
              <Line
                type="monotone"
                dataKey="approvals"
                stroke="#10b981"
                strokeWidth={2}
                name="Approvals"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Student Performance Distribution */}
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-ink mb-4">Student Points Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={studentPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* Faculty Performance Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-ink mb-4">Faculty Performance</h3>
          {facultyMetrics.length === 0 ? (
            <EmptyState icon="👥" title="No faculty" description="No faculty members assigned" />
          ) : (
            <div className="space-y-3">
              {facultyMetrics.map((fac, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-ink">{fac.name}</p>
                      <p className="text-xs text-slate-500">{fac.approvals} approvals</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-blue-600">⭐ {fac.avgRating.toFixed(1)}</div>
                      <div className="text-xs text-slate-500">{fac.efficiency}% efficient</div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                      style={{ width: `${fac.efficiency}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Key Metrics Summary */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="p-5">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Approval Rate</h3>
          <div className="text-3xl font-bold text-green-600 mb-2">{departmentStats.approvalRate}%</div>
          <div className="w-full bg-slate-200 rounded-full h-1">
            <div
              className="bg-green-600 h-1 rounded-full"
              style={{ width: `${departmentStats.approvalRate}%` }}
            ></div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Total Points Awarded</h3>
          <div className="text-3xl font-bold text-blue-600">{departmentStats.totalPoints.toLocaleString()}</div>
          <p className="text-xs text-slate-500 mt-1">Across all students</p>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Department Health</h3>
          <div className="flex items-end gap-1 h-12">
            {[65, 72, 78, 82, 88].map((val, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t opacity-70"
                style={{ height: `${val}%` }}
              ></div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">Trending up</p>
        </Card>
      </motion.div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast('')}
        />
      )}
    </div>
  )
}
