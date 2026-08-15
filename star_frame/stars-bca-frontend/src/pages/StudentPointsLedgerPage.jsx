import React, { useEffect, useState } from 'react'
import { Card, EmptyState, LoadingState, PageHeader, Toast } from '../components/UI.jsx'
import { getStudentPointsHistory } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMonthKey(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function groupByMonth(entries) {
  const groups = []
  let current = null
  for (const entry of entries) {
    const key = formatMonthKey(entry.date)
    if (!current || current.label !== key) {
      current = { label: key, entries: [] }
      groups.push(current)
    }
    current.entries.push(entry)
  }
  return groups
}

const VERTICAL_COLORS = {
  'Technical': 'text-brand-600',
  'Leadership': 'text-amber-600',
  'Community Service': 'text-leaf-600',
  'Sports': 'text-rose-600',
}

function pointsClass(points) {
  if (points > 0) return 'text-leaf-600'
  if (points < 0) return 'text-rose-600'
  return 'text-slate-500'
}

export default function StudentPointsLedgerPage() {
  const [ledger, setLedger] = useState([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await getStudentPointsHistory()
        setLedger(res.data?.ledger || [])
        setTotalPoints(res.data?.totalPoints || 0)
      } catch (error) {
        setToast({ message: error.message || 'Unable to load points history', tone: 'error' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingState rows={4} />

  const groups = groupByMonth(ledger)

  return (
    <div className="space-y-6">
      <PageHeader title="Points Ledger" subtitle="Your earned STAR points timeline" />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Total Points</p>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums leading-none text-ink">{totalPoints}</p>
        </Card>
        <Card className="p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Entries</p>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums leading-none text-ink">{ledger.length}</p>
        </Card>
      </div>

      {/* Timeline */}
      {groups.length > 0 ? (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{group.label}</h2>
              <Card className="divide-y divide-rule overflow-hidden">
                {group.entries.map((entry, i) => (
                  <div key={i} className="flex items-start gap-4 px-5 py-4">
                    <div className="mt-1 flex flex-col items-center">
                      <span className={`h-2 w-2 rounded-full ${entry.points >= 0 ? 'bg-leaf-500' : 'bg-rose-400'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{entry.activityName || 'Activity'}</span>
                        {entry.vertical && (
                          <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${VERTICAL_COLORS[entry.vertical] || 'text-slate-400'}`}>
                            {entry.vertical}
                          </span>
                        )}
                      </div>
                      {entry.note && (
                        <p className="mt-1 text-sm text-slate-500">{entry.note}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-mono text-sm font-semibold tabular-nums ${pointsClass(entry.points)}`}>
                        {entry.points > 0 ? '+' : ''}{entry.points}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">{formatDate(entry.date)}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon="☆" title="No points yet" description="Your points history will appear here once your submissions are approved." />
      )}
    </div>
  )
}
