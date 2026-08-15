import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Shell from '../components/Shell.jsx'
import { Button, Card, Field, Input, Select, Toast, LoadingState, ConfirmDialog } from '../components/UI.jsx'
import { getAcademicSettings, updateAcademicSettings, rolloverAcademicYear } from '../utils/api.js'

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
    </Shell>
  )
}