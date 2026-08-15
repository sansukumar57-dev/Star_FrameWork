import { useEffect, useRef } from 'react'
import { useToast } from '../components/ToastProvider.jsx'
import { getStudentNotifications } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const SEEN_KEY = 'stars_seen_submission_notifications'

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function persistSeen(seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)))
  } catch {
    /* ignore */
  }
}

/**
 * Polls the student notification inbox and raises a toast whenever a new
 * submission status-change notification arrives (approved, rejected, etc.).
 */
export default function useSubmissionStatusToasts({ enabled = true, intervalMs = 20000, onUnreadChange } = {}) {
  const { push } = useToast()
  const seenRef = useRef(loadSeen())
  const enabledRef = useRef(enabled)
  const onUnreadChangeRef = useRef(onUnreadChange)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    onUnreadChangeRef.current = onUnreadChange
  }, [onUnreadChange])

  useEffect(() => {
    if (!enabled) return undefined

    let active = true
    let timer

    async function poll() {
      try {
        const res = await getStudentNotifications(1, 20)
        const notifications = res.data?.notifications || []
        onUnreadChangeRef.current?.(res.data?.unread || 0)

        for (const notification of notifications) {
          if (notification.type !== 'submission') continue
          const id = String(notification._id)
          if (seenRef.current.has(id)) continue
          seenRef.current.add(id)
          if (!active) continue

          const title = String(notification.title || '')
          let tone = 'info'
          let message = notification.message || title
          if (/reject/i.test(title)) tone = 'error'
          else if (/approve/i.test(title)) tone = 'success'
          else if (/appeal/i.test(title)) tone = 'info'

          push(message, tone, { link: notification.link || '/student/submissions' })
        }
        persistSeen(seenRef.current)
      } catch {
        /* silent — retry on next poll */
      }
    }

    poll()
    timer = setInterval(poll, intervalMs)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [enabled, intervalMs, push])
}