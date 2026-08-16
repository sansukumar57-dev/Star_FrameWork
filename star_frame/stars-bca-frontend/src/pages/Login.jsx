import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser } from '../utils/api.js'
import { Logo } from '../components/Shell.jsx'
import { Modal, Button } from '../components/UI.jsx'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2C11 5.1 11.5 5 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.3M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

const ROLES = [
  { id: 'student', label: 'Student' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'admin', label: 'Admin' },
]

const ADMIN_PORTALS = [
  {
    id: 'hod',
    label: 'HOD',
    description: 'Head of Department — verify submissions, manage semester locks',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    path: '/hod',
    color: 'text-violet-600 bg-violet-50 border-violet-200',
    active: 'ring-2 ring-violet-500 border-violet-400 bg-violet-50',
  },
  {
    id: 'dean',
    label: 'Dean',
    description: 'Dean of Academics — department analytics and AI summaries',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    path: '/principal',
    color: 'text-sky-600 bg-sky-50 border-sky-200',
    active: 'ring-2 ring-sky-500 border-sky-400 bg-sky-50',
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'System Administrator — user management, activities, audit logs',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    path: '/principal',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    active: 'ring-2 ring-amber-500 border-amber-400 bg-amber-50',
  },
]

export default function Login() {
  const [role, setRole] = useState('student')
  const [showPassword, setShowPassword] = useState(false)
  const [register, setRegister] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [showAdminPicker, setShowAdminPicker] = useState(false)
  const [selectedPortal, setSelectedPortal] = useState('hod')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!register || !password) {
      setError('Please fill in both fields to continue.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const response = await loginUser(role, register, password)
      const authData = response?.data || response
      if (!authData?.token) {
        throw new Error('Authentication did not return a token')
      }
      localStorage.setItem('stars_token', authData.token)
      localStorage.setItem('stars_user', JSON.stringify(authData.user || {}))
      const userRole = authData.user?.role
      const accountType = authData.user?.accountType
      if (userRole === 'student') return navigate('/student')
      if (userRole === 'faculty') return navigate('/faculty')
      // Admin: show portal picker
      const defaultPortal = accountType === 'hod' ? 'hod' : accountType === 'dean' ? 'dean' : 'admin'
      setSelectedPortal(defaultPortal)
      setShowAdminPicker(true)
    } catch (err) {
      const message = err?.message || 'Login failed'
      setError(message.includes('Invalid') || message.includes('credentials') ? 'Invalid credentials. Please check your username and password.' : message)
    } finally {
      setLoading(false)
    }
  }

  const idLabel = role === 'student' ? 'Register number' : role === 'faculty' ? 'Faculty email' : 'Admin email'
  const idPlaceholder =
    role === 'student' ? 'Enter your Register number' : role === 'faculty' ? 'Enter your faculty email' : 'Enter your admin email'

  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      {/* Masthead column */}
      <div className="hidden flex-col justify-between p-10 lg:p-14 md:flex md:w-1/2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-rule bg-card shadow-soft">
            <Logo size={28} />
          </div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-slate-500">KPR College of Arts Science and Research</p>
        </div>

        <div className="max-w-lg">
          <h1 className="font-display text-5xl font-semibold leading-[1.04] tracking-[-0.02em] text-ink lg:text-6xl">STARS-BCA</h1>
          <div className="mt-4 w-20 border-t-2 border-ink" aria-hidden="true" />
          <p className="mt-7 text-base leading-[1.7] text-slate-600">
            The Student STAR Framework keeps a running record of achievement across ten verticals — academic, innovation,
            leadership, and community — in one maintained ledger.
          </p>
        </div>

        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-slate-500">STAR Framework · Management System</p>
      </div>

      {/* Hairline divider */}
      <div className="hidden w-px bg-rule md:block" aria-hidden="true" />

      {/* Form column */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-rule bg-card shadow-soft">
              <Logo size={26} />
            </div>
            <div>
              <p className="font-display text-lg font-semibold leading-none tracking-tight">STARS-BCA</p>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Student Portal</p>
            </div>
          </div>

          <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink">Sign in</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">Choose your role and enter your credentials.</p>

          <div className="mt-7 flex gap-6 border-b border-rule">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors focus-ring ${
                  role === r.id ? 'border-ink text-ink' : 'border-transparent text-slate-400 hover:text-ink'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-600">{idLabel}</label>
              <input
                value={register}
                onChange={(e) => setRegister(e.target.value)}
                placeholder={idPlaceholder}
                className="mt-2 w-full rounded-md border border-rule bg-card px-3.5 py-3 text-base text-ink placeholder:text-slate-500 focus-ring focus:border-brand-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Password</label>
              <div className="relative mt-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-md border border-rule bg-card px-3.5 py-3 pr-11 text-base text-ink placeholder:text-slate-500 focus-ring focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={() => setShowForgot(true)} className="text-sm font-medium text-brand-500 hover:text-brand-600">
                Forgot Password?
              </button>
            </div>

            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand-600 py-3 font-medium text-paper transition-colors hover:bg-brand-700 focus-ring disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      {/* Admin portal picker */}
      <Modal
        open={showAdminPicker}
        onClose={() => {}}
        title="Select your portal"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setShowAdminPicker(false)
                setLoading(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const portal = ADMIN_PORTALS.find((p) => p.id === selectedPortal)
                localStorage.setItem('stars_portal', portal.id)
                setShowAdminPicker(false)
                navigate(portal.path)
              }}
            >
              Continue
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500 mb-5">You have admin access. Choose which portal you want to open.</p>
        <div className="space-y-3">
          {ADMIN_PORTALS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPortal(p.id)}
              className={`w-full flex items-start gap-4 rounded-lg border p-4 text-left transition-all ${
                selectedPortal === p.id ? p.active : 'border-rule bg-card hover:border-slate-300'
              }`}
            >
              <span className={`mt-0.5 rounded-md p-2 border ${p.color}`}>{p.icon}</span>
              <div>
                <p className="font-semibold text-ink text-sm">{p.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{p.description}</p>
              </div>
              {selectedPortal === p.id && (
                <svg className="ml-auto mt-1 shrink-0 text-brand-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={showForgot}
        onClose={() => setShowForgot(false)}
        title="Reset your password"
        footer={
          <Button onClick={() => setShowForgot(false)}>Got it</Button>
        }
      >
        <div className="space-y-4 text-sm text-slate-600">
          <div className="rounded-md bg-brand-50 p-4">
            <p className="font-semibold text-ink">Password resets are handled by your department admin.</p>
          </div>
          <ul className="space-y-2 list-disc pl-5">
            <li><span className="font-medium text-ink">Students &amp; faculty:</span> ask your HOD or department admin to reset your password. They can do this from the Admin dashboard.</li>
            <li><span className="font-medium text-ink">Admins (HOD/Dean):</span> sign in with your existing credentials, then reset your own password from the user management panel.</li>
            <li>After a reset, your password is set to <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">Welcome@123</code>. Change it the next time you sign in.</li>
          </ul>
          <p className="text-xs text-slate-400">If you still cannot sign in, contact the system administrator.</p>
        </div>
      </Modal>
    </div>
  )
}