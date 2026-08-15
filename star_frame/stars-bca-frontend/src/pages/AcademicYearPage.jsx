import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Shell from '../components/Shell.jsx'
import { Button, Card, Field, Input, Select, Toast, LoadingState, ConfirmDialog, EmptyState } from '../components/UI.jsx'
import { getAcademicSettings, updateAcademicSettings, rolloverAcademicYear, previewDeadlineNotifications, broadcastDeadlineNotifications } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

export default function AcademicYearPage() {
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('stars_user') || '{}') } catch { return {} }
  }, [])
  const [settings, setSettings] = useState({ academicYear: '', semesterOpen: true })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [confirmRollover, setConfirmRollover] = useState(null)
  const [newYear, setNewYear] = useState('')
  const [targetBatch, setTargetBatch] = useState('')
  const [rolloverLoading, setRolloverLoading] = useState(false)
  const [broadcastWindow, setBroadcastWindow] = useState(7)
  const [broadcastPreview, setBroadcastPreview] = useState(null)
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [confirmBroadcast, setConfirmBroadcast] = useState(false)

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
      const res = await getAcademicSettings()
      const data = res.data || {}
      setSettings({ academicYear: data.academicYear || '', semesterOpen: data.semesterOpen !== false })
      setNewYear(data.academicYear ? `${Number(String(data.academicYear).split('-')[0]) + 1}-${Number(String(data.academicYear).split('-')[1] || Number(String(data.academicYear).split('-')[0]) + 1) + 1}` : '')
    } catch (error) {
      notify(error.message || 'Unable to load academic settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings(e) {
    e.preventDefault()
    try {
      await updateAcademicSettings(settings)
      notify('Academic settings saved.')
      await load()
    } catch (error) {
      notify(error.message || 'Unable to save settings', 'error')
    }
  }

  async function runRollover() {
    if (!confirmRollover) return
    setRolloverLoading(true)
    try {
      await rolloverAcademicYear({ newAcademicYear: confirmRollover.newYear, targetBatch: confirmRollover.targetBatch })
      notify(`Academic year rolled over to ${confirmRollover.newYear}.`)
      setConfirmRollover(null)
      await load()
    } catch (error) {
      notify(error.message || 'Unable to roll over the academic year', 'error')
    } finally {
      setRolloverLoading(false)
    }
  }

  async function loadBroadcastPreview() {
    setBroadcastLoading(true)
    try {
      const res = await previewDeadlineNotifications(broadcastWindow)
      setBroadcastPreview(res.data?.items || [])
    } catch (error) {
      notify(error.message || 'Unable to preview deadline notifications', 'error')
    } finally {
      setBroadcastLoading(false)
    }
  }

  async function runBroadcast() {
    setBroadcasting(true)
    try {
      const res = await broadcastDeadlineNotifications(broadcastWindow)
      const data = res.data || {}
      notify(`Sent ${data.created?.overdue || 0} overdue, ${data.created?.urgent || 0} important, ${data.created?.warning || 0} upcoming deadline alerts to ${data.studentsNotified || 0} students.`)
      setConfirmBroadcast(false)
    } catch (error) {
      notify(error.message || 'Unable to broadcast deadline notifications', 'error')
    } finally {
      setBroadcasting(false)
    }
  }

  if (loading) {
    return (
      <Shell role="principal" userName={currentUser.name || 'Admin'} department={currentUser.department || 'Academic Year'}>
        <LoadingState rows={3} />
      </Shell>
    )
  }

  return (
    <Shell role="principal" userName={currentUser.name || 'Admin'} department={currentUser.department || 'Academic Year'}>
      <div>
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">Academic Year</h1>
        <p className="mt-1.5 text-sm text-slate-500">Set the active academic year, control the submission window, and promote students at rollover.</p>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Current settings</h2>
          <form onSubmit={saveSettings} className="mt-4 space-y-4">
            <Field label="Academic year" hint="Format: e.g. 2025-2026">
              <Input value={settings.academicYear} onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })} placeholder="e.g. 2025-2026" />
            </Field>
            <Field label="Semester open" hint="Students can only submit or resubmit while the semester is open.">
              <Select value={String(settings.semesterOpen)} onChange={(e) => setSettings({ ...settings, semesterOpen: e.target.value === 'true' })}>
                <option value="true">Open</option>
                <option value="false">Closed</option>
              </Select>
            </Field>
            <Button type="submit" className="w-full">Save settings</Button>
          </form>
        </Card>

        <Card className="p-6 self-start">
          <h2 className="font-display text-lg font-semibold text-ink">Year rollover</h2>
          <p className="mt-1 text-sm text-slate-500">Promote all students by one year and switch the active academic year.</p>
          <div className="mt-4 space-y-4">
            <Field label="New academic year">
              <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="e.g. 2026-2027" />
            </Field>
            <Field label="Batch (optional)" hint="Leave empty to promote every batch.">
              <Input value={targetBatch} onChange={(e) => setTargetBatch(e.target.value)} placeholder="e.g. 2025-2028" />
            </Field>
            <Button
              variant="brand"
              className="w-full"
              disabled={!newYear.trim()}
              onClick={() => setConfirmRollover({ newYear: newYear.trim(), targetBatch: targetBatch.trim() })}
            >
              Run rollover
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Deadline alert broadcast</h2>
              <p className="mt-1 text-sm text-slate-500">Send priority deadline notifications to every student whose activity upload deadline is approaching.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Window (days)">
                <Select value={String(broadcastWindow)} onChange={(e) => { setBroadcastWindow(Number(e.target.value)); setBroadcastPreview(null) }}>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                </Select>
              </Field>
              <Button variant="outline" onClick={loadBroadcastPreview} loading={broadcastLoading}>Preview</Button>
              <Button variant="primary" onClick={() => setConfirmBroadcast(true)}>Broadcast now</Button>
            </div>
          </div>

          {broadcastPreview !== null && (
            <div className="mt-5">
              {broadcastPreview.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Upcoming deadlines in the next {broadcastWindow} days</p>
                  {broadcastPreview.map((item) => (
                    <div key={String(item.activityId)} className="flex items-center justify-between gap-3 rounded-md border border-rule bg-paper px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{item.activityName}</p>
                        <p className="font-mono text-[11px] text-slate-400">{item.vertical} · due {new Date(item.deadline).toLocaleDateString()}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${
                        item.priority === 'Overdue' ? 'border-rose-200 bg-rose-50 text-rose-600'
                        : item.priority === 'Important' ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-brand-200 bg-brand-50 text-brand-700'
                      }`}>
                        {item.priority} · {item.daysLeft < 0 ? `${Math.abs(item.daysLeft)}d overdue` : `${item.daysLeft}d left`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon="✓" title="Nothing due soon" description={`No activity deadlines fall within the next ${broadcastWindow} days.`} />
              )}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirmRollover}
        onClose={() => setConfirmRollover(null)}
        title="Run academic year rollover"
        message={`Promote all students${confirmRollover?.targetBatch ? ` in batch ${confirmRollover.targetBatch}` : ''} to the next year and set the academic year to ${confirmRollover?.newYear}? This cannot be undone.`}
        confirmLabel="Roll over"
        tone="success"
        loading={rolloverLoading}
        onConfirm={runRollover}
      />

      <ConfirmDialog
        open={confirmBroadcast}
        onClose={() => setConfirmBroadcast(false)}
        title="Broadcast deadline alerts"
        message={`Send priority deadline notifications to all active students for activities due in the next ${broadcastWindow} days? Students who have already earned approval will be skipped.`}
        confirmLabel="Broadcast"
        tone="primary"
        loading={broadcasting}
        onConfirm={runBroadcast}
      />
    </Shell>
  )
}