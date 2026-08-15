import React, { useMemo, useState } from 'react'
import { Button, StatusBadge, Card, EmptyState, Modal, Field, Textarea, Toast } from '../components/UI.jsx'
import { appealSubmission } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const FILTERS = ['All', 'Pending', 'FacultyApproved', 'Approved', 'Rejected', 'HODRejected']

export default function StudentSubmissionsPage({ submissions, openUpload, openEvidence }) {
  const [filter, setFilter] = useState('All')
  const [appealing, setAppealing] = useState(null)
  const [appealReason, setAppealReason] = useState('')
  const [toast, setToast] = useState('')

  const filteredSubmissions = useMemo(() => {
    if (filter === 'All') return submissions
    return submissions.filter((submission) => submission.status === filter)
  }, [filter, submissions])

  async function submitAppeal() {
    if (!appealing) return
    if (!appealReason.trim()) {
      setToast('Please describe why you are appealing this rejection.')
      return
    }
    try {
      await appealSubmission(appealing._id, appealReason.trim())
      setToast('Appeal submitted — your faculty will review it shortly.')
      setAppealing(null)
      setAppealReason('')
    } catch (error) {
      setToast(error.message || 'Unable to submit appeal')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">My Submissions</h1>
          <p className="mt-1.5 text-sm text-slate-500">Track your submitted tasks, approvals, and review comments.</p>
        </div>
        <div className="flex flex-wrap gap-5 border-b border-rule">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`-mb-px border-b-2 pb-2.5 font-mono text-xs uppercase tracking-[0.1em] transition-colors focus-ring ${
                filter === option ? 'border-ink text-ink' : 'border-transparent text-slate-400 hover:text-ink'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {filteredSubmissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-rule bg-paper/60">
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Task</th>
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Activity</th>
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Submitted</th>
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Status</th>
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Points</th>
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Review</th>
                  <th className="px-5 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((submission) => {
                  const taskName = submission.activityId?.activityName || submission.activityName || 'Activity'
                  const activityName = submission.activityType || submission.activityId?.activityName || '—'
                  const points = submission.pointsAwarded ?? submission.suggestedPoints ?? submission.activityId?.maximumPoints ?? '—'

                  return (
                    <tr key={submission._id} className="border-b border-rule align-top transition-colors hover:bg-paper/60">
                      <td className="px-5 py-4">
                        <p className="font-medium text-ink">{taskName}</p>
                        {submission.activityId?.vertical && <p className="mt-0.5 text-xs text-slate-400">{submission.activityId.vertical}</p>}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{activityName}</td>
                      <td className="tabular px-5 py-4 text-slate-500">{new Date(submission.submittedAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4"><StatusBadge status={submission.status} /></td>
                      <td className="tabular px-5 py-4 text-slate-500">{points === '—' ? points : `${points} pts`}</td>
                      <td className="px-5 py-4 text-slate-500 max-w-[220px]">{submission.teacherRemarks || '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          {['Rejected', 'HODRejected'].includes(submission.status) && !submission.appeal?.status && (
                            <Button size="sm" variant="outline" onClick={() => setAppealing(submission)}>Appeal</Button>
                          )}
                          {['Rejected', 'HODRejected'].includes(submission.status) && (
                            <Button size="sm" variant="ghost" onClick={() => openUpload({
                              id: submission.activityId?._id || submission.activityId,
                              name: taskName,
                              description: submission.description || 'Upload supporting evidence',
                              maxPoints: submission.activityId?.maximumPoints || 0,
                              deadline: '',
                              category: 'cert',
                              vertical: submission.activityId?.vertical || submission.vertical || '',
                            })}>Re-upload</Button>
                          )}
                          {submission.certificateFile?.fileName && (
                            <Button size="sm" variant="ghost" onClick={() => openEvidence(submission._id)}>View evidence</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              icon="·"
              title="No submissions found"
              description={filter === 'All' ? "You haven't submitted any tasks yet." : `No submissions with the status "${filter}".`}
            />
          </div>
        )}
      </Card>

      {toast && <Toast message={toast} tone={toast.toLowerCase().includes('please') || toast.toLowerCase().includes('unable') ? 'error' : 'success'} onDismiss={() => setToast('')} />}

      <Modal
        open={!!appealing}
        onClose={() => { setAppealing(null); setAppealReason('') }}
        title={`Appeal rejection — ${appealing?.activityId?.activityName || 'Activity'}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setAppealing(null); setAppealReason('') }}>Cancel</Button>
            <Button onClick={submitAppeal} disabled={!appealReason.trim()}>Submit appeal</Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 mb-4">
          Explain why you believe this submission was rejected in error. Your faculty mentor will review the appeal and the original evidence.
        </p>
        <Field label="Reason for appeal" hint="Visible to your faculty and HOD.">
          <Textarea value={appealReason} onChange={(e) => setAppealReason(e.target.value)} rows={4} placeholder="Describe why the rejection should be reconsidered…" />
        </Field>
      </Modal>
    </div>
  )
}