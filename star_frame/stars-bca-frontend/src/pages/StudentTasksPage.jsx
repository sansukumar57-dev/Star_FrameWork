import React, { useState, useMemo, useEffect } from 'react'
import { Button, CategoryTag, Card, Input, EmptyState } from '../components/UI.jsx'
import { getStudentBookmarks, toggleStudentBookmark } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const DAY_MS = 86400000

function deadlineTone(task) {
  if (!task.deadline) return 'text-slate-400'
  const daysLeft = (new Date(task.deadline) - Date.now()) / DAY_MS
  if (daysLeft < 0) return 'font-medium text-rose-600'
  if (daysLeft < 3) return 'font-medium text-rose-500'
  if (daysLeft < 7) return 'font-medium text-amber-600'
  return 'text-slate-400'
}

function deadlineLabel(task) {
  if (!task.deadline) return null
  const daysLeft = Math.floor((new Date(task.deadline) - Date.now()) / DAY_MS)
  const due = `Due ${new Date(task.deadline).toLocaleDateString()}`
  if (daysLeft < 0) return `${due} (${Math.abs(daysLeft)}d overdue)`
  if (daysLeft < 3) return `${due} (${daysLeft}d left)`
  return due
}

export default function StudentTasksPage({
  selectedVertical,
  setSelectedVertical,
  verticalOptions,
  groupedTasks,
  pendingTasks,
  activityMeta,
  activityPage,
  totalActivityPages,
  setActivityPage,
  openUpload,
  categoryById,
}) {
  const [search, setSearch] = useState('')
  const [showBookmarked, setShowBookmarked] = useState(false)
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set())

  useEffect(() => {
    getStudentBookmarks()
      .then((res) => {
        const ids = (res?.data?.bookmarks || []).map((b) => String(b._id || b))
        setBookmarkedIds(new Set(ids))
      })
      .catch(() => {})
  }, [])

  async function handleToggleBookmark(activityId) {
    const id = String(activityId)
    setBookmarkedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    try {
      await toggleStudentBookmark(activityId)
    } catch {
      setBookmarkedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }
  }

  const filteredGroups = useMemo(() => {
    let groups = groupedTasks
    if (showBookmarked) {
      groups = groups.map((group) => ({
        ...group,
        items: group.items.filter((task) => bookmarkedIds.has(String(task.id))),
      })).filter((group) => group.items.length > 0)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      groups = groups.map((group) => ({
        ...group,
        items: group.items.filter((task) => String(task.name).toLowerCase().includes(q) || String(task.description).toLowerCase().includes(q)),
      })).filter((group) => group.items.length > 0)
    }
    return groups
  }, [groupedTasks, search, showBookmarked, bookmarkedIds])

  const bookmarkedCount = useMemo(
    () => groupedTasks.reduce((sum, group) => sum + group.items.filter((task) => bookmarkedIds.has(String(task.id))).length, 0),
    [groupedTasks, bookmarkedIds]
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">STAR Tasks</h1>
          <p className="mt-1.5 text-sm text-slate-500">Select a vertical and submit supporting evidence for the next activity.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end md:w-auto">
          <div className="w-full max-w-xs">
            <label className="mb-1.5 block font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Search</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities..."
            />
          </div>
          <Button
            variant={showBookmarked ? 'primary' : 'outline'}
            size="md"
            onClick={() => setShowBookmarked((prev) => !prev)}
            className="sm:mb-0"
          >
            ★ Bookmarked{bookmarkedCount > 0 ? ` (${bookmarkedCount})` : ''}
          </Button>
        </div>
      </div>

      {/* Vertical pill selector */}
      <div>
        <label className="mb-2 block font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Vertical</label>
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Vertical selector">
          {verticalOptions.map((option) => {
            const short = String(option).replace(/Vertical\s*\d+\s*-\s*/, '')
            const active = option === selectedVertical
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedVertical(option)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 font-mono text-xs font-medium transition-colors focus-ring ${
                  active
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-rule bg-card text-slate-500 hover:border-brand-300 hover:text-ink'
                }`}
              >
                {short}
              </button>
            )
          })}
        </div>
      </div>

      <Card>
        <div className="border-b border-rule px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {['Academic Performance', 'Co-curricular', 'Extension', 'Research'].map((tag) => (
              <span key={tag} className="rounded-full border border-rule bg-paper px-3 py-0.5 font-mono text-[11px] text-slate-500">{tag}</span>
            ))}
          </div>
        </div>

        <div className="px-6 py-2">
          {(search.trim() || showBookmarked) && filteredGroups.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">
              {showBookmarked && !search.trim() ? 'No bookmarked tasks in this vertical yet.' : `No activities match "${search}"`}
            </p>
          )}
          {filteredGroups.map((group) => (
            <section key={group.key}>
              <h3 className="border-t border-rule py-4 font-display text-base font-semibold tracking-tight text-ink">{group.heading}</h3>
              {group.items.length > 0 ? group.items.map((task) => {
                const cat = categoryById(task.category)
                return (
                  <div key={task.id} className="flex flex-col gap-3 border-t border-rule py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryTag category={cat} />
                        {task.deadline && (
                          <span className={`font-mono text-xs ${deadlineTone(task)}`}>
                            {task.important && <span className="mr-1 uppercase tracking-[0.1em]">Important</span>}{deadlineLabel(task)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate font-display text-base font-semibold text-ink">{task.name}</p>
                      <p className="mt-0.5 truncate text-sm text-slate-500">{task.description}</p>
                      <p className="tabular mt-1 font-mono text-xs text-slate-400">Max {task.maxPoints} pts · Max {task.maxStarPct}% STAR</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleToggleBookmark(task.id)}
                        className={`rounded-full p-1.5 transition-colors focus-ring ${bookmarkedIds.has(String(task.id)) ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                        aria-label={bookmarkedIds.has(String(task.id)) ? 'Remove bookmark' : 'Bookmark activity'}
                      >
                        {bookmarkedIds.has(String(task.id)) ? '★' : '☆'}
                      </button>
                      <Button onClick={() => openUpload(task)}>Upload</Button>
                    </div>
                  </div>
                )
              }) : (
                <p className="border-t border-rule py-4 text-sm text-slate-400">No pending items in this activity section.</p>
              )}
            </section>
          ))}

          {pendingTasks.length === 0 && (
            <div className="py-6">
              <EmptyState
                icon="★"
                title="All caught up"
                description="You've submitted evidence for every available task — new tasks will appear here."
              />
            </div>
          )}

          {activityMeta.total > activityMeta.limit && (
            <div className="flex items-center justify-between gap-3 border-t border-rule py-4">
              <Button variant="ghost" onClick={() => setActivityPage((page) => Math.max(1, page - 1))} disabled={activityPage <= 1}>
                Previous
              </Button>
              <span className="font-mono text-sm text-slate-400">Page {activityPage} of {totalActivityPages}</span>
              <Button variant="ghost" onClick={() => setActivityPage((page) => Math.min(totalActivityPages, page + 1))} disabled={activityPage >= totalActivityPages}>
                Next
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}