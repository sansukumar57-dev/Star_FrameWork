import React from 'react'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const LEDGER_TICKS = {
  brand: 'bg-brand-500',
  leaf: 'bg-leaf-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
}

const STAT_ICONS = {
  brand: '◈',
  leaf: '✓',
  amber: '◔',
  rose: '✕',
  slate: '·',
}

export function StatCard({ label, value, sub, accent = 'brand', icon = STAT_ICONS[accent] || '·', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-lg border border-rule bg-card p-5 ${
        onClick ? 'cursor-pointer transition-colors hover:border-slate-300' : ''
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${LEDGER_TICKS[accent] || LEDGER_TICKS.brand}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="tabular mt-2 font-display text-3xl font-semibold leading-none text-ink">{value}</p>
          {sub && <p className="mt-1.5 text-xs text-slate-400">{sub}</p>}
        </div>
        {icon ? (
          <span aria-hidden="true" className={`mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-md font-mono text-sm ${
            accent === 'leaf' ? 'bg-leaf-100 text-leaf-600' : accent === 'amber' ? 'bg-amber-100 text-amber-700' : accent === 'rose' ? 'bg-rose-100 text-rose-600' : accent === 'slate' ? 'bg-slate-100 text-slate-600' : 'bg-brand-100 text-brand-700'
          }`}>
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  )
}

const STATUS_TONES = {
  Approved: 'bg-leaf-100 text-leaf-600 border-leaf-300/50',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  FacultyApproved: 'bg-brand-50 text-brand-700 border-brand-200',
  HODApproved: 'bg-leaf-100 text-leaf-600 border-leaf-300/50',
  Rejected: 'bg-rose-50 text-rose-600 border-rose-200',
  HODRejected: 'bg-rose-50 text-rose-600 border-rose-200',
  Active: 'bg-leaf-100 text-leaf-600 border-leaf-300/50',
  Inactive: 'bg-rose-50 text-rose-600 border-rose-200',
}

export const STATUS_LABELS = {
  Approved: 'Approved',
  Pending: 'Under Review',
  FacultyApproved: 'Pending HOD Review',
  HODApproved: 'Fully Approved',
  Rejected: 'Rejected',
  HODRejected: 'Rejected by HOD',
  Active: 'Active',
  Inactive: 'Inactive',
}

export function StatusBadge({ status }) {
  const tone = STATUS_TONES[status] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function ProgressRing({ percent = 0, size: _size = 88, stroke: _stroke = 9, color = 'var(--color-brand-500)', animate = true }) {
  const target = Math.min(100, Math.max(0, Math.round(percent)))
  const [display, setDisplay] = React.useState(animate ? 0 : target)

  React.useEffect(() => {
    if (!animate) {
      setDisplay(target)
      return undefined
    }
    let raf
    const start = performance.now()
    const duration = 700
    const tick = (now) => {
      const elapsed = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - elapsed, 3)
      setDisplay(Math.round(target * eased))
      if (elapsed < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, animate])

  return (
    <div className="w-full">
      <p className="tabular font-display text-4xl font-semibold leading-none text-ink">{display}%</p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${display}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'lg' }) {
  if (!open) return null
  const maxWidth = size === 'md' ? 'max-w-xl lg:max-w-2xl' : 'max-w-[90vw] lg:max-w-[1280px]'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 lg:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-xl border border-rule bg-card shadow-modal`}>
        <div className="flex items-center justify-between border-b border-rule px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="ml-4 shrink-0 rounded-full p-1 text-2xl leading-none text-slate-400 transition-colors hover:text-ink focus-ring" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-rule bg-card px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>
  )
}

export function CategoryTag({ category }) {
  if (!category) return null
  return (
    <span
      className="whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium"
      style={{ backgroundColor: `${category.color}14`, color: category.color, borderColor: `${category.color}30` }}
    >
      {category.name}
    </span>
  )
}

export function Button({ children, variant = 'primary', size = 'md', loading = false, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-medium focus-ring transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-brand-600 text-paper hover:bg-brand-700',
    success: 'bg-leaf-500 text-white hover:bg-leaf-600',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-ink',
    outline: 'bg-transparent text-ink border border-rule hover:border-slate-300 hover:bg-card',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  }
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={props.disabled || loading} {...props}>
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
        </svg>
      )}
      {children}
    </button>
  )
}

export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }
  return (
    <svg className={`animate-spin text-brand-500 ${sizes[size]} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const inputBase =
  'w-full rounded-md border border-rule bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 focus-ring focus:border-brand-400 disabled:opacity-50 disabled:cursor-not-allowed'

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-sm font-medium text-slate-600">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-medium text-rose-500">{error}</p>}
    </div>
  )
}

export function Input({ className = '', invalid, ...props }) {
  return <input className={`${inputBase} ${invalid ? '!border-rose-300 !bg-rose-50' : ''} ${className}`} {...props} />
}

export function Select({ className = '', invalid, value, children, ...props }) {
  const isEmpty = value === undefined || value === null || value === ''
  return (
    <select className={`${inputBase} ${invalid ? '!border-rose-300 !bg-rose-50 !text-rose-700' : ''} ${isEmpty && !invalid ? 'text-slate-400' : ''} ${className}`} value={value} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className = '', invalid, ...props }) {
  return <textarea className={`${inputBase} ${invalid ? '!border-rose-300 !bg-rose-50' : ''} ${className}`} {...props} />
}

const TOAST_TONES = {
  success: 'border-leaf-300 bg-leaf-100/70 text-leaf-700',
  error: 'border-rose-300 bg-rose-100/70 text-rose-700',
  info: 'border-brand-300 bg-brand-100/70 text-brand-800',
  warning: 'border-amber-300 bg-amber-100/70 text-amber-800',
}

export function Toast({ message, tone = 'success', onDismiss }) {
  return (
    <div
      role="status"
      className={`mb-6 flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm font-medium animate-[fadeInDown_0.2s_ease-out] ${TOAST_TONES[tone] || TOAST_TONES.success}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 leading-none opacity-60 hover:opacity-100" aria-label="Dismiss">
          &times;
        </button>
      )}
    </div>
  )
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-lg border border-rule bg-card ${className}`} {...props}>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, crumbs = [] }) {
  return (
    <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-400">
            {crumbs.map((crumb, index) => (
              <span key={crumb} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden="true">/</span>}
                <span className={index === crumbs.length - 1 ? 'text-ink' : ''}>{crumb}</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon = '·', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-rule bg-card/50 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-rule bg-paper shadow-soft">
        <svg viewBox="0 0 48 48" fill="none" className="h-8 w-8" aria-hidden="true">
          <circle cx="24" cy="24" r="20" stroke="var(--color-rule)" strokeWidth="2" />
          <circle cx="24" cy="24" r="13" stroke="var(--color-rule)" strokeWidth="2" />
          <path d="M24 4v7M24 37v7M4 24h7M37 24h7" stroke="var(--color-slate-400)" strokeWidth="2" strokeLinecap="round" />
          <text x="24" y="28" textAnchor="middle" fontSize="9" fill="var(--color-brand-500)" fontWeight="600">{icon}</text>
        </svg>
      </div>
      <p className="mt-4 font-display text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ rows = 1, className = '' }) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-lg border border-rule bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="h-4 w-1/3 rounded bg-slate-200" />
            <div className="h-6 w-14 rounded-full bg-slate-100" />
          </div>
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
          <div className="mt-3 flex items-center gap-2">
            <div className="h-3 w-16 rounded bg-slate-100" />
            <div className="h-3 w-24 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', loading = false, inputLabel, inputValue, onInputChange, inputPlaceholder = '' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={tone === 'success' ? 'success' : tone === 'primary' ? 'primary' : 'danger'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {message && <p className="text-sm text-slate-500">{message}</p>}
        {inputLabel && (
          <Field label={inputLabel} hint="This feedback will be visible to the student.">
            <Textarea
              value={inputValue || ''}
              onChange={(e) => onInputChange?.(e.target.value)}
              placeholder={inputPlaceholder}
              rows={3}
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}