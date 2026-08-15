import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line, Legend } from 'recharts'
import { StatCard, Button, PageHeader, Card, Toast, LoadingState } from '../components/UI.jsx'

/**
 * Enhanced Principal Dashboard
 * Features:
 * - Institution-wide statistics
 * - Department rankings and comparisons
 * - Student performance trends
 * - Export reports (PDF, Excel)
 * - Academic year management
 * - System health overview
 */
export default function EnhancedPrincipalDashboard({
  _analytics = {},
  departments = [],
  users = { students: 0, faculty: 0, admin: 0 },
  onExportReport = null,
  onExportAnalytics = null
}) {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [departmentRankings, setDepartmentRankings] = useState([])
  const [performanceTrends, setPerformanceTrends] = useState([])
  const [institutionMetrics, setInstitutionMetrics] = useState({})
  const [exportingReport, setExportingReport] = useState(false)
  const [exportingAnalytics, setExportingAnalytics] = useState(false)

  useEffect(() => {
    // Process department rankings
    if (Array.isArray(departments)) {
      const rankings = departments
        .map((dept, idx) => ({
          rank: idx + 1,
          name: dept.name,
          students: dept.totalStudents || 0,
          avgPoints: dept.avgPoints || 0,
          submissions: dept.totalSubmissions || 0,
          approvalRate: dept.approvalRate || 0,
          color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]
        }))
        .sort((a, b) => (b.avgPoints - a.avgPoints))

      setDepartmentRankings(rankings.slice(0, 10))
    }

    // Generate performance trends (simulated)
    const trends = []
    for (let i = 0; i < 12; i++) {
      trends.push({
        month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
        submissions: Math.floor(Math.random() * 200) + 100,
        approvals: Math.floor(Math.random() * 150) + 50,
        points: Math.floor(Math.random() * 3000) + 2000
      })
    }
    setPerformanceTrends(trends)

    // Institution metrics
    const totalSubmissions = departments.reduce((sum, dept) => sum + (dept.totalSubmissions || 0), 0)
    const totalApprovals = departments.reduce((sum, dept) => sum + (dept.approvedSubmissions || 0), 0)
    const avgDeptPoints = departments.length > 0
      ? Math.round(departments.reduce((sum, dept) => sum + (dept.avgPoints || 0), 0) / departments.length)
      : 0

    setInstitutionMetrics({
      totalStudents: users.students || 0,
      totalFaculty: users.faculty || 0,
      totalDepartments: departments.length,
      totalSubmissions,
      totalApprovals,
      approvalRate: totalSubmissions > 0 ? Math.round((totalApprovals / totalSubmissions) * 100) : 0,
      avgDepartmentPoints: avgDeptPoints,
      topDepartment: departmentRankings[0]?.name || 'N/A'
    })

    setLoading(false)
  }, [departments, users, departmentRankings])

  const handleExportReport = async () => {
    setExportingReport(true)
    try {
      await onExportReport?.()
      setToast({ message: 'Institution report exported successfully', tone: 'success' })
    } catch (error) {
      setToast({ message: error.message, tone: 'error' })
    } finally {
      setExportingReport(false)
    }
  }

  const handleExportAnalytics = async () => {
    setExportingAnalytics(true)
    try {
      await onExportAnalytics?.()
      setToast({ message: 'Analytics exported successfully', tone: 'success' })
    } catch (error) {
      setToast({ message: error.message, tone: 'error' })
    } finally {
      setExportingAnalytics(false)
    }
  }

  if (loading) return <LoadingState text="Loading principal dashboard..." />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Principal Dashboard"
        subtitle="Institution-wide analytics and department performance."
      />

      {/* Main Stats Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <StatCard
          label="Total Students"
          value={institutionMetrics.totalStudents}
          sub="Across all departments"
          accent="brand"
        />
        <StatCard
          label="Total Submissions"
          value={institutionMetrics.totalSubmissions}
          sub={`${institutionMetrics.approvalRate}% approved`}
          accent="leaf"
        />
        <StatCard
          label="Faculty Members"
          value={institutionMetrics.totalFaculty}
          sub="Active"
          accent="amber"
        />
        <StatCard
          label="Departments"
          value={institutionMetrics.totalDepartments}
          sub={`Avg: ${institutionMetrics.avgDepartmentPoints} pts`}
          accent="rose"
        />
      </motion.div>

      {/* Export Actions */}
      <motion.div
        className="flex gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Button
          onClick={handleExportReport}
          disabled={exportingReport}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {exportingReport ? '...' : '📄'} Export PDF Report
        </Button>
        <Button
          onClick={handleExportAnalytics}
          disabled={exportingAnalytics}
          variant="outline"
        >
          {exportingAnalytics ? '...' : '📊'} Export Analytics
        </Button>
      </motion.div>

      {/* Performance Trends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-ink mb-4">Annual Performance Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="submissions"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Submissions"
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="approvals"
                stroke="#10b981"
                strokeWidth={2}
                name="Approvals"
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* Department Rankings and Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-ink mb-4">Department Rankings</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={departmentRankings}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="avgPoints" fill="#3b82f6" name="Avg Points" />
              <Bar yAxisId="left" dataKey="submissions" fill="#10b981" name="Submissions" />
            </BarChart>
          </ResponsiveContainer>

          {/* Rankings Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper/60 border-b border-rule">
                <tr className="text-slate-400 text-[11px] uppercase tracking-[0.14em]">
                  <th className="text-left font-medium px-3 py-2.5">Rank</th>
                  <th className="text-left font-medium px-3 py-2.5">Department</th>
                  <th className="text-center font-medium px-3 py-2.5">Students</th>
                  <th className="text-center font-medium px-3 py-2.5">Avg Points</th>
                  <th className="text-center font-medium px-3 py-2.5">Approval Rate</th>
                </tr>
              </thead>
              <tbody>
                {departmentRankings.map((dept) => (
                  <tr key={dept.name} className="border-b border-rule hover:bg-paper/60">
                    <td className="px-3 py-2.5 font-bold text-lg text-slate-400">#{dept.rank}</td>
                    <td className="px-3 py-2.5 font-medium text-ink">{dept.name}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{dept.students}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-blue-600">{dept.avgPoints}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        {dept.approvalRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      {/* System Health Overview */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="p-5">
          <h3 className="font-medium text-ink mb-3">User Distribution</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Students</span>
              <span className="font-semibold text-ink">{institutionMetrics.totalStudents}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{
                width: `${Math.min(100, (institutionMetrics.totalStudents / (institutionMetrics.totalFaculty + institutionMetrics.totalStudents)) * 100)}%`
              }}></div>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Faculty</span>
              <span className="font-semibold text-ink">{institutionMetrics.totalFaculty}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{
                width: `${Math.min(100, (institutionMetrics.totalFaculty / (institutionMetrics.totalFaculty + institutionMetrics.totalStudents)) * 100)}%`
              }}></div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-medium text-ink mb-3">Approval Metrics</h3>
          <div className="text-center mb-3">
            <div className="text-3xl font-bold text-green-600">{institutionMetrics.approvalRate}%</div>
            <p className="text-xs text-slate-500 mt-1">Overall Approval Rate</p>
          </div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Total Approvals</span>
              <span className="font-semibold">{institutionMetrics.totalApprovals}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Submissions</span>
              <span className="font-semibold">{institutionMetrics.totalSubmissions}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-medium text-ink mb-3">Performance Summary</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500">Top Department</p>
              <p className="font-semibold text-ink">{institutionMetrics.topDepartment}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Institution Average</p>
              <p className="text-2xl font-bold text-blue-600">{institutionMetrics.avgDepartmentPoints}</p>
              <p className="text-xs text-slate-500">points per department</p>
            </div>
          </div>
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
