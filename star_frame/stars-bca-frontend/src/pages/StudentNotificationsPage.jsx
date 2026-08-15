import React, { useCallback, useEffect, useMemo, useState } from 'react'
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

const PRIORITY_TONE = {
  Overdue: 'border-rose-300 bg-rose-50 text-rose-700',
  Important: 'border-amber-300 bg-amber-50 text-amber-700',
  Upcoming: 'border-brand-200 bg-brand-50 text-brand-700',
}

function priorityOf(notification) {
  if (notification.type !== 'deadline') return null
  const title = notification.title || ''
  if (title.startsWith('Overdue')) return 'Overdue'
  if (title.startsWith('Important')) return 'Important'
  return 'Upcoming'
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
      const nextUnread = Math.max(0, unread - 1)
      setUnread(nextUnread)
      onUnreadChange?.(nextUnread)
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

  const grouped = useMemo(() => {
    const order = ['Overdue', 'Important', 'Upcoming']
    const groups = []
    const remainder = []
    for (const n of notifications) {
      const priority = priorityOf(n)
      if (priority) {
        let group = groups.find((g) => g.priority === priority)
        if (!group) {
          group = { priority, items: [] }
          groups.push(group)
        }
        group.items.push(n)
      } else {
        remainder.push(n)
      }
    }
    groups.sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority))
    return { groups, remainder }
  }, [notifications])

  if (loading) return <LoadingState rows={4} />

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">Notifications</h1>
          <p className="mt-1.5 text-sm text-slate-500">Priority deadline alerts and updates on your submissions.</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={handleMarkAll}>Mark all as read</Button>
        )}
      </div>

      {grouped.groups.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {grouped.groups.map((group) => (
            <div key={group.priority} className={`rounded-md border px-4 py-3 ${PRIORITY_TONE[group.priority]}`}>
              <p className="font-display text-[11px] uppercase tracking-[0.18em] opacity-80">{group.priority}</p>
              <p className="tabular mt-1 font-display text-2xl font-semibold">{group.items.length}</p>
              <p className="text-xs opacity-70">pending activity deadline{group.items.length === 1 ? '' : 's'}</p>
            </div>
          ))}
        </div>
      )}

      {notifications.length > 0 ? (
        <Card className="divide-y divide-rule">
          {grouped.groups.map((group) => (
            <div key={group.priority}>
              <div className="border-b border-rule bg-paper/60 px-5 py-2.5">
                <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {group.priority} — {group.items.length}
                </p>
              </div>
              {group.items.map((notification) => (
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
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${PRIORITY_TONE[group.priority]}`}>
                        {group.priority}
                      </span>
                    </span>
                    {notification.message && <span className="mt-1 block text-sm text-slate-500">{notification.message}</span>}
                    <span className="mt-1 block font-mono text-[11px] text-slate-400">{new Date(notification.createdAt).toLocaleString()}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}

          {grouped.remainder.length > 0 && (
            <>
              <div className="border-b border-rule bg-paper/60 px-5 py-2.5">
                <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Other updates — {grouped.remainder.length}</p>
              </div>
              {grouped.remainder.map((notification) => (
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
            </>
          )}
        </Card>
      ) : (
        <EmptyState icon="○" title="No notifications yet" description="Priority deadline alerts and updates about your submissions will appear here." />
      )}
    </div>
  )
}
