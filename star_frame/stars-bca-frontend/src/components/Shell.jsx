import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../utils/theme.jsx'
import kprcasLogo from '../assets/kprcas.jpg'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

export function Logo({ size = 40, className = '' }) {
  return (
    <img
      src={kprcasLogo}
      alt="KPR CAS logo"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  )
}

export const NAV = {
  student: [
    { to: '/student', label: 'Dashboard', icon: '\u2302' },
    { to: '/student/tasks', label: 'STAR Tasks', icon: '\u2605' },
    { to: '/student/submissions', label: 'My Submissions', icon: '\u2713' },
    { to: '/student/points-ledger', label: 'Points Ledger', icon: '\u25C8' },
    { to: '/student/bookmarks', label: 'Bookmarks', icon: '\u2606' },
    { to: '/student/leaderboard', label: 'Leaderboard', icon: '\u25C8' },
    { to: '/student/notifications', label: 'Notifications', icon: '\u26A0' },
  ],
  faculty: [
    { to: '/faculty', label: 'Dashboard', icon: '\u2302' },
    { to: '/faculty/reviews', label: 'Review Submissions', icon: '\u2713' },
  ],
  principal: [
    { to: '/principal', label: 'Performance Dashboard', icon: '\u25C8' },
    { to: '/principal/bulk-upload', label: 'Bulk Student Upload', icon: '\u2191' },
    { to: '/principal/activities', label: 'Activities', icon: '\u2605' },
    { to: '/principal/audit-logs', label: 'Audit Logs', icon: '\u2691' },
    { to: '/principal/academic-year', label: 'Academic Year', icon: '\u26BF' },
  ],
  hod: [
    { to: '/hod', label: 'Dashboard', icon: '\u2302' },
    { to: '/hod/verify', label: 'Verify Submissions', icon: '\u2713' },
    { to: '/hod/semester', label: 'Semester Lock', icon: '\u26BF' },
    { to: '/principal', label: 'User Management', icon: '\u2699' },
  ],
}

const ROLE_LABEL = { student: 'Student', faculty: 'Faculty', principal: 'Principal', hod: 'HOD' }

export default function Shell({ role, userName, department, children, profileTrigger = null, badges = {}, navLinks = null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const links = navLinks || NAV[role] || []
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [menuOpen])

  function signOut() {
    localStorage.removeItem('stars_token')
    localStorage.removeItem('stars_user')
    navigate('/')
  }

  function navLink(link, mobile = false) {
    const count = badges[link.to]
    return (
      <NavLink
        key={link.to}
        to={link.to}
        end
        className={({ isActive }) =>
          mobile
            ? `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-ink text-paper' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
              }`
            : `relative px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'text-ink' : 'text-slate-500 hover:text-ink'
              }`
        }
      >
        {({ isActive }) => (
          <>
            <span className="w-5 text-center text-xs">{link.icon}</span>
            <span className="flex-1">{link.label}</span>
            {count > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 font-mono text-[10px] font-medium text-paper">
                {count > 99 ? '99+' : count}
              </span>
            )}
            {!mobile && isActive && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-brand-500" />}
          </>
        )}
      </NavLink>
    )
  }

  const avatar = (
    <button
      type="button"
      onClick={profileTrigger || undefined}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-paper transition-colors hover:bg-slate-800 focus-ring"
      aria-label="Open profile"
    >
      {userName?.[0] || '?'}
    </button>
  )

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur">
        {/* Issue row — serif small caps */}
        <div className="hidden border-b border-rule px-6 py-1.5 lg:flex lg:items-center lg:justify-between lg:px-10">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">
            KPR College of Arts and Science · STAR Framework
          </p>
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Academic Year {new Date().getFullYear()}
          </p>
        </div>

        {/* Wordmark row */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-rule bg-card shadow-soft">
              <Logo size={26} />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-none tracking-tight">STARS-BCA</p>
              <p className="mt-1 font-display text-[10px] uppercase tracking-[0.22em] text-slate-400">
                {ROLE_LABEL[role]} Portal
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            {department && (
              <span className="hidden border border-rule px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500 sm:inline-flex">
                {department}
              </span>
            )}
            {profileTrigger ? (
              <div className="flex items-center gap-2">
                {avatar}
                <span className="hidden text-sm font-medium text-ink lg:inline">{userName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-paper">{userName?.[0] || '?'}</div>
                <span className="hidden text-sm font-medium text-ink lg:inline">{userName}</span>
              </div>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-slate-500 transition-colors hover:border-slate-300 hover:text-ink focus-ring"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '\u2600' : '\u263E'}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-full border border-rule px-3.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-ink focus-ring"
            >
              Sign out
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus-ring md:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Nav row — desktop */}
        <nav className="hidden border-t border-rule md:block">
          <div className="flex items-center px-4 sm:px-6 lg:px-10">{links.map((link) => navLink(link))}</div>
        </nav>
      </header>

      <main className="flex-1 animate-fade-in px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>

      {/* Colophon */}
      <footer className="border-t border-rule px-4 py-5 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">STARS-BCA · STAR Framework Management System</p>
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">KPR College of Arts and Science, Coimbatore</p>
        </div>
      </footer>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 transform flex-col bg-card shadow-modal transition-transform duration-200 ease-out">
            <div className="flex items-center justify-between border-b border-rule px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-rule bg-paper">
                  <Logo size={22} />
                </div>
                <p className="font-display text-base font-semibold tracking-tight">STARS-BCA</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="text-2xl leading-none text-slate-400 hover:text-ink"
                aria-label="Close menu"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              <p className="px-3 pb-2 font-display text-[10px] uppercase tracking-[0.22em] text-slate-400">
                {ROLE_LABEL[role]} Portal · {userName || ''}
              </p>
              {links.map((link) => navLink(link, true))}
            </div>
            <div className="border-t border-rule p-4">
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink"
              >
                <span className="w-5 text-center text-xs">&#x2190;</span>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}