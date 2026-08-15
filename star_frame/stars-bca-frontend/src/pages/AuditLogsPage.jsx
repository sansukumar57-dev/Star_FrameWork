import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Shell from '../components/Shell.jsx'
import { Card, Input, EmptyState, LoadingState, Toast, Button } from '../components/UI.jsx'
import { getAuditLogs } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

export default function AuditLogsPage() {
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, tone = 'error') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      load()
    }, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query])

  async function load() {
    try {
      setLoading(true)
      const res = await getAuditLogs(page, 25, query)
      setLogs(res.data?.logs || [])
      setTotal(res.data?.total || 0)
    } catch (error) {
      notify(error.message || 'Unable to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 25))

  return (
    <Shell role="principal" userName={currentUser.name || 'Admin'} department={currentUser.department || 'Audit Logs'}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">Audit Logs</h1>
          <p className="mt-1.5 text-sm text-slate-500">A record of user, department, activity, and review actions across the system.</p>
        </div>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by action…" className="!w-full md:!w-64 !bg-card !border-rule" />
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <Card className="mt-6 overflow-hidden">
        {loading ? (
          <LoadingState rows={5} />
        ) : logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-rule bg-paper/60">
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Action</th>
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Actor</th>
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Entity</th>
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Details</th>
                    <th className="px-5 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-b border-rule align-top transition-colors hover:bg-paper/60">
                      <td className="px-5 py-3.5">
                        <span className="rounded-full border border-rule px-2.5 py-0.5 font-mono text-[11px] text-slate-600">{log.action}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-ink">{log.actorId?.name || 'System'}</p>
                        <p className="text-xs text-slate-400">{log.actorId?.email || ''}</p>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{log.entityType || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-500 max-w-[280px]">
                        {log.details ? <span className="block truncate font-mono text-xs">{JSON.stringify(log.details)}</span> : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <p className="font-mono text-xs text-slate-400">{total} log{total === 1 ? '' : 's'}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</Button>
                <span className="font-mono text-xs text-slate-500">Page {page} of {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>Next</Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6">
            <EmptyState icon="≡" title="No audit logs" description={query ? 'No logs match that action filter.' : 'Actions will be recorded here as they happen.'} />
          </div>
        )}
      </Card>
    </Shell>
  )
}