import React, { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spinner } from './components/UI.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'

const Login = lazy(() => import('./pages/Login.jsx'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard.jsx'))
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard.jsx'))
const PrincipalDashboard = lazy(() => import('./pages/PrincipalDashboard.jsx'))
const HODDashboard = lazy(() => import('./pages/HODDashboard.jsx'))
const EditStudent = lazy(() => import('./pages/EditStudent.jsx'))
const BulkStudentUpload = lazy(() => import('./pages/BulkStudentUpload.jsx'))
const ActivityManagement = lazy(() => import('./pages/ActivityManagement.jsx'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage.jsx'))
const AcademicYearPage = lazy(() => import('./pages/AcademicYearPage.jsx'))

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('./pages/Login.jsx').catch(() => {})
  }, [])

  if (loading) {
    return <LoadingScreen onComplete={() => setLoading(false)} />
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/student/*" element={<StudentDashboard />} />
        <Route path="/faculty/*" element={<FacultyDashboard />} />
        <Route path="/principal/*" element={<PrincipalDashboard />} />
        <Route path="/hod/*" element={<HODDashboard />} />
        <Route path="/principal/edit-student/:id" element={<EditStudent />} />
        <Route path="/principal/bulk-upload" element={<BulkStudentUpload />} />
        <Route path="/principal/activities" element={<ActivityManagement />} />
        <Route path="/principal/audit-logs" element={<AuditLogsPage />} />
        <Route path="/principal/academic-year" element={<AcademicYearPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
