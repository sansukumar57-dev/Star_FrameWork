import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts'
import { StatCard, Button, PageHeader, Card, Toast, LoadingState, EmptyState } from '../components/UI.jsx'

/**
 * Enhanced Faculty Dashboard
 * Features:
 * - Pending approvals count
 * - Class statistics with charts
 * - STAR % entry for students
 * - Bulk approve/reject functionality
 * - Quick remarks templates
 * - Student performance distribution
 */
export default function EnhancedFacultyDashboard({
  submissions = [],
  stats = { pending: 0, approved: 0, rejected: 0, totalStudents: 0, totalPointsAwarded: 0 },
  students = [],
  onBulkApprove = null,
  onBulkReject = null,
  onExport = null
}) {
  const [loading, setLoading] = useState(true)
  const [selectedSubmissions, setSelectedSubmissions] = useState(new Set())
  const [toast, setToast] = useState('')
  const [performanceData, setPerformanceData] = useState([])
  const [academicData, setAcademicData] = useState([])
  const [statusDistribution, setStatusDistribution] = useState([])

  useEffect(() => {
    // Generate performance analytics
    const pointRanges = [
      { range: '0-100', count: 0, color: '#ef4444' },
      { range: '100-200', count: 0, color: '#f59e0b' },
      { range: '200-300', count: 0, color: '#fbbf24' },
      { range: '300-400', count: 0, color: '#10b981' },
      { range: '400+', count: 0, color: '#3b82f6' }
    ]

    students.forEach(student => {
      const points = student.totalPoints || 0
      if (points < 100) pointRanges[0].count++
      else if (points < 200) pointRanges[1].count++
      else if (points < 300) pointRanges[2].count++
      else if (points < 400) pointRanges[3].count++
      else pointRanges[4].count++
    })

    setPerformanceData(pointRanges)

    // Status distribution
    const distribution = [
      { name: 'Pending', value: stats.pending || 0, fill: '#f59e0b' },
      { name: 'Approved', value: stats.approved || 0, fill: '#10b981' },
      { name: 'Rejected', value: stats.rejected || 0, fill: '#ef4444' }
    ]
    setStatusDistribution(distribution)

    // Academic metrics
    const avgPoints = stats.totalStudents > 0 ? Math.round(stats.totalPointsAwarded / stats.totalStudents) : 0
    setAcademicData([
      { metric: 'Avg Points/Student', value: avgPoints },
      { metric: 'Total Students', value: stats.totalStudents || 0 },
      { metric: 'Points Awarded', value: stats.totalPointsAwarded || 0 },
      { metric: 'Approval Rate', value: stats.totalStudents > 0 ? Math.round((stats.approved / stats.totalStudents) * 100) : 0 }
    ])

    setLoading(false)
  }, [students, stats])

  const toggleSubmissionSelect = (submissionId) => {
    const newSelected = new Set(selectedSubmissions)
    if (newSelected.has(submissionId)) {
      newSelected.delete(submissionId)
    } else {
      newSelected.add(submissionId)
    }
    setSelectedSubmissions(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedSubmissions.size === submissions.length) {
      setSelectedSubmissions(new Set())
    } else {
      setSelectedSubmissions(new Set(submissions.map(s => s._id)))
    }
  }

  const handleBulkApprove = async () => {
    if (selectedSubmissions.size === 0) {
      setToast({ message: 'No submissions selected', tone: 'warning' })
      return
    }
    try {
      await onBulkApprove?.(Array.from(selectedSubmissions))
      setSelectedSubmissions(new Set())
      setToast({ message: `${selectedSubmissions.size} submissions approved`, tone: 'success' })
    } catch (error) {
      setToast({ message: error.message, tone: 'error' })
    }
  }

  const handleBulkReject = async () => {
    if (selectedSubmissions.size === 0) {
      setToast({ message: 'No submissions selected', tone: 'warning' })
      return
    }
    try {
      await onBulkReject?.(Array.from(selectedSubmissions))
      setSelectedSubmissions(new Set())
      setToast({ message: `${selectedSubmissions.size} submissions rejected`, tone: 'success' })
    } catch (error) {
      setToast({ message: error.message, tone: 'error' })
    }
  }

  if (loading) return <LoadingState text="Loading faculty dashboard..." />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Dashboard"
        subtitle="Manage student submissions and track class performance."
      />

      {/* Main Stats Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <StatCard
          label="Pending Review"
          value={stats.pending || 0}
          sub="Awaiting your approval"
          accent="amber"
        />
        <StatCard
          label="Approved"
          value={stats.approved || 0}
          sub="This semester"
          accent="leaf"
        />
        <StatCard
          label="Rejected"
          value={stats.rejected || 0}
          sub="Sent back"
          accent="rose"
        />
        <StatCard
          label="Total Students"
          value={stats.totalStudents || 0}
          sub="In your class"
          accent="brand"
        />
      </motion.div>

      {/* Performance Analytics */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Performance Distribution */}
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-ink mb-4">Student Performance Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6">
                {performanceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Status Distribution */}
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-ink mb-4">Submission Status Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* Class Metrics */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {academicData.map((data, idx) => (
          <Card key={idx} className="p-4">
            <p className="text-xs text-slate-500 mb-1">{data.metric}</p>
            <p className="text-2xl font-bold text-ink">{data.value}</p>
          </Card>
        ))}
      </motion.div>

      {/* Bulk Actions */}
      {selectedSubmissions.size > 0 && (
        <motion.div
          className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-sm font-medium text-blue-700">
            {selectedSubmissions.size} submission(s) selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedSubmissions(new Set())}
            >
              Clear
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleBulkApprove}
            >
              ✓ Approve All
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 hover:bg-rose-700"
              onClick={handleBulkReject}
            >
              ✕ Reject All
            </Button>
          </div>
        </motion.div>
      )}

      {/* Pending Submissions Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display text-lg font-semibold text-ink">Pending Submissions</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onExport?.()}
            >
              📥 Export
            </Button>
          </div>

          {submissions.length === 0 ? (
            <EmptyState
              icon="✓"
              title="All caught up!"
              description="No pending submissions to review."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper/60 border-b border-rule">
                  <tr className="text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                    <th className="text-left font-medium px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.size === submissions.length && submissions.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left font-medium px-3 py-2.5">Student</th>
                    <th className="text-left font-medium px-3 py-2.5">Activity</th>
                    <th className="text-center font-medium px-3 py-2.5">Suggested</th>
                    <th className="text-right font-medium px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.slice(0, 10).map((submission) => (
                    <tr key={submission._id} className="border-b border-rule hover:bg-paper/60">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedSubmissions.has(submission._id)}
                          onChange={() => toggleSubmissionSelect(submission._id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-ink">{submission.studentId?.name || 'Student'}</p>
                        <p className="text-xs text-slate-400">{submission.studentId?.regNo || ''}</p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {submission.activityId?.activityName || 'Activity'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-blue-600">
                        {submission.suggestedPoints || 0} pts
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button size="sm" variant="outline">Review</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
