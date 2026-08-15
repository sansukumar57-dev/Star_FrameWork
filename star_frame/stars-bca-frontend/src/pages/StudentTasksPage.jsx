import React from 'react'
import { Button, CategoryTag, Card, Select, EmptyState } from '../components/UI.jsx'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

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
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">STAR Tasks</h1>
          <p className="mt-1.5 text-sm text-slate-500">Select a vertical and submit supporting evidence for the next activity.</p>
        </div>
        <div className="w-full max-w-xs">
          <label className="mb-1.5 block font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Vertical</label>
          <Select value={selectedVertical} onChange={(e) => setSelectedVertical(e.target.value)}>
            {verticalOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
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
          {groupedTasks.map((group) => (
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
                          <span className={`font-mono text-xs ${task.important ? 'font-medium text-amber-600' : 'text-slate-400'}`}>
                            {task.important && <span className="mr-1 uppercase tracking-[0.1em]">Important</span>}Due {new Date(task.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate font-display text-base font-semibold text-ink">{task.name}</p>
                      <p className="mt-0.5 truncate text-sm text-slate-500">{task.description}</p>
                      <p className="tabular mt-1 font-mono text-xs text-slate-400">Max {task.maxPoints} pts · Max {task.maxStarPct}% STAR</p>
                    </div>
                    <Button onClick={() => openUpload(task)} className="shrink-0 self-start sm:self-auto">Upload</Button>
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