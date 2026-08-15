import React, { useCallback, useEffect, useState } from 'react'
import { Button, Card, EmptyState, LoadingState, Toast } from '../components/UI.jsx'
import { getStudentNotifications, markNotificationRead, markAllNotificationsRead } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const TYPE_LABEL = {
  submission: 'Submission',
  appeal: 'Appeal',
  semester: 'Semester',
  deadline: 'Deadline',
  system: 'System',
}

export default function StudentNotificationsPage({ onUnreadChange }) {
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    try {
      const res = await getStudentNotifications(1, 50)
      setNotifications(res.data?.notifications || [])
      setUnread(res.data?.unread || 0)
      onUnreadChange?.(res.data?.unread || 0)
    } catch (error) {
      notify(error.message || 'Unable to load notifications', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id)
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)))
      setUnread((prev) => Math.max(0, prev - 1))
      onUnreadChange?.(Math.max(0, unread - 1))
    } catch (error) {
      notify(error.message || 'Unable to update notification', 'error')
    }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnread(0)
      onUnreadChange?.(0)
    } catch (error) {
      notify(error.message || 'Unable to update notifications', 'error')
    }
  }

  if (loading) return <LoadingState rows={4} />

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">Notifications</h1>
          <p className="mt-1.5 text-sm text-slate-500">Updates on your submissions, appeals, and semester changes.</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={handleMarkAll}>Mark all as read</Button>
        )}
      </div>

      {notifications.length > 0 ? (
        <Card className="divide-y divide-rule">
          {notifications.map((notification) => (
            <button
              key={notification._id}
              type="button"
              onClick={() => !notification.read && handleMarkRead(notification._id)}
              className={`flex w-full items-start gap-4 px-5 py-4 text-left transition-colors ${notification.read ? 'opacity-70' : 'hover:bg-paper/60'}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read ? 'bg-slate-200' : 'bg-brand-500'}`} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{notification.title}</span>
                  <span className="rounded-full border border-rule px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                    {TYPE_LABEL[notification.type] || notification.type}
                  </span>
                </span>
                {notification.message && <span className="mt-1 block text-sm text-slate-500">{notification.message}</span>}
                <span className="mt-1 block font-mono text-[11px] text-slate-400">{new Date(notification.createdAt).toLocaleString()}</span>
              </span>
            </button>
          ))}
        </Card>
      ) : (
        <EmptyState icon="○" title="No notifications yet" description="Updates about your submissions will appear here." />
      )}
    </div>
  )
}