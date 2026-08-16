import React, { useEffect, useState } from 'react'
import { Button, Card, EmptyState, LoadingState, Toast } from '../components/UI.jsx'
import { getStudentBookmarks, toggleStudentBookmark } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function BookmarkCard({ activity, onSubmitActivity, onRemove }) {
  const isPastDeadline = activity.deadline && new Date(activity.deadline) < new Date()
  const activityId = activity._id || activity.activityId

  return (
    <Card className="flex flex-col p-5 transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-semibold leading-snug text-ink">
          {activity.activityName || activity.name || 'Untitled Activity'}
        </h3>
        <button
          type="button"
          onClick={() => onRemove(activityId)}
          className="shrink-0 text-slate-300 transition-colors hover:text-rose-500 focus-ring"
          aria-label="Remove bookmark"
          title="Remove bookmark"
        >
          ★
        </button>
      </div>

      {activity.vertical && (
        <span className="mt-2 inline-flex w-fit items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-brand-700">
          {activity.vertical}
        </span>
      )}

      <div className="mt-auto pt-4 text-sm text-slate-500">
        <div className="flex items-center justify-between">
          <span className="tabular font-mono text-xs text-slate-400">Max {activity.maximumPoints ?? activity.maxPoints ?? 0} pts</span>
          {activity.deadline && (
            <span className={`font-mono text-xs ${isPastDeadline ? 'text-rose-500' : 'text-slate-400'}`}>
              Due {formatDate(activity.deadline)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <Button
          size="sm"
          className="w-full"
          disabled={isPastDeadline}
          onClick={() => onSubmitActivity({
            id: activityId,
            name: activity.activityName || activity.name || 'Activity',
            description: activity.description || 'Upload supporting evidence',
            maxPoints: activity.maximumPoints ?? activity.maxPoints ?? 0,
            deadline: activity.deadline || '',
            category: 'cert',
            vertical: activity.vertical || '',
          })}
        >
          {isPastDeadline ? 'Deadline passed' : 'Submit from bookmark'}
        </Button>
      </div>
    </Card>
  )
}

export default function StudentBookmarksPage({ onSubmitActivity }) {
  const [bookmarks, setBookmarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await getStudentBookmarks()
        setBookmarks(res.data?.bookmarks || res.data || [])
      } catch (error) {
        setToast(error.message || 'Unable to load bookmarks')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleRemove(activityId) {
    if (!activityId) return
    try {
      await toggleStudentBookmark(activityId)
      setBookmarks((prev) => prev.filter((activity) => (activity._id || activity.activityId) !== activityId))
      setToast('Bookmark removed.')
      window.setTimeout(() => setToast(''), 2600)
    } catch (error) {
      setToast(error.message || 'Unable to remove bookmark')
    }
  }

  if (loading) return <LoadingState rows={4} />

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} tone={toast.toLowerCase().includes('unable') ? 'error' : 'success'} onDismiss={() => setToast('')} />}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">Bookmarked Activities</h1>
          <p className="mt-1.5 text-sm text-slate-500">Activities you&apos;ve saved for later — submit from here directly.</p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
      </div>

      {bookmarks.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bookmarks.map((activity) => (
            <BookmarkCard
              key={activity._id || activity.activityId || activity.activityName}
              activity={activity}
              onSubmitActivity={onSubmitActivity}
              onRemove={handleRemove}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="☆"
          title="No bookmarks yet"
          description="Save activities you're interested in and they'll show up here."
        />
      )}
    </div>
  )
}
