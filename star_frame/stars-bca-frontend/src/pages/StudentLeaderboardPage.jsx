import React, { useEffect, useState } from 'react'
import { Button, Card, EmptyState, LoadingState, Select, Toast } from '../components/UI.jsx'
import { getStudentLeaderboard } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

const SCOPE_OPTIONS = [
  { value: 'batch', label: 'My batch' },
  { value: 'department', label: 'My department' },
  { value: 'year', label: 'My year' },
  { value: 'all', label: 'All students' },
]

export default function StudentLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState({ students: [], myRank: 0, myPoints: 0 })
  const [scope, setScope] = useState('batch')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setLoading(true)
    async function load() {
      try {
        const res = await getStudentLeaderboard(scope)
        setLeaderboard(res.data || { students: [], myRank: 0, myPoints: 0 })
      } catch (error) {
        setToast(error.message || 'Unable to load leaderboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [scope])

  if (loading) return <LoadingState rows={4} />

  const activeScopeLabel = SCOPE_OPTIONS.find((option) => option.value === scope)?.label || 'All students'

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} tone="error" onDismiss={() => setToast('')} />}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">Leaderboard</h1>
          <p className="mt-1.5 text-sm text-slate-500">Students ranked by approved STAR points — filtered to {activeScopeLabel.toLowerCase()}.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={scope} onChange={(event) => setScope(event.target.value)} aria-label="Leaderboard scope" className="w-44">
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      </div>

      {leaderboard.myRank > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 text-center">
            <p className="font-display text-3xl font-semibold text-ink">#{leaderboard.myRank}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Your Rank</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="font-display text-3xl font-semibold text-ink">{leaderboard.myPoints || 0}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Approved Points</p>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        {leaderboard.students && leaderboard.students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-rule bg-paper/60">
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Rank</th>
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Student</th>
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Points</th>
                  <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Streak</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.students.map((student) => (
                  <tr key={student._id} className="border-b border-rule transition-colors hover:bg-paper/60">
                    <td className="px-5 py-4">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-semibold ${
                        student.rank === 1 ? 'bg-amber-100 text-amber-700' : student.rank === 2 ? 'bg-slate-200 text-slate-700' : student.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-paper text-slate-500 border border-rule'
                      }`}>
                        {student.rank}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-ink">{student.name || 'Student'}</p>
                      <p className="text-xs text-slate-400">{student.registerNumber || student.regNo || ''}</p>
                    </td>
                    <td className="px-5 py-4 tabular text-slate-500">{student.totalPoints || 0} pts</td>
                    <td className="px-5 py-4 text-slate-500">{student.submissions ? `${student.submissions} approved` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState icon="☆" title="No leaderboard data yet" description="Earn approved STAR points to appear on the leaderboard." />
          </div>
        )}
      </Card>
    </div>
  )
}
