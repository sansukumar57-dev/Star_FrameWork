import React, { createContext, useCallback, useContext, useMemo, useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const ToastContext = createContext(null)

const TONE = {
  success: 'border-leaf-300 bg-leaf-100/90 text-leaf-700',
  error: 'border-rose-300 bg-rose-100/90 text-rose-700',
  info: 'border-brand-300 bg-brand-100/90 text-brand-800',
  warning: 'border-amber-300 bg-amber-100/90 text-amber-800',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((message, tone = 'success', options = {}) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, tone, duration: options.duration ?? 3800, link: options.link || null }])
    return id
  }, [])

  useEffect(() => {
    const timers = toasts
      .filter((toast) => toast.duration > 0)
      .map((toast) => setTimeout(() => dismiss(toast.id), toast.duration))
    return () => timers.forEach(clearTimeout)
  }, [toasts, dismiss])

  const api = useMemo(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:top-6" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`pointer-events-auto flex w-full max-w-md items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm font-medium shadow-soft ${TONE[toast.tone] || TONE.success}`}
              role="status"
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 leading-none opacity-60 transition-opacity hover:opacity-100"
                aria-label="Dismiss"
              >
                &times;
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export default ToastProvider