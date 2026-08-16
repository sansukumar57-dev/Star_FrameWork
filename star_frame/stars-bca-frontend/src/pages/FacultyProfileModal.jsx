import React, { useEffect, useState } from 'react'
import { Modal, Button, Field, Input } from '../components/UI.jsx'
import { getTeacherProfile, updateTeacherProfile } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

function DefinitionList({ items }) {
  return (
    <dl>
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[150px_1fr] gap-4 border-t border-rule py-2.5 text-sm">
          <dt className="text-slate-400">{item.label}</dt>
          <dd className="font-medium text-ink">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function roleLabel(accountType) {
  if (accountType === 'hod') return 'HOD'
  if (accountType === 'dean') return 'Dean'
  return 'Faculty'
}

export default function FacultyProfileModal({ user, onProfileUpdate }) {
  const [profile, setProfile] = useState(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phoneNumber: '', dob: '' })
  const [validationErrors, setValidationErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let active = true
    getTeacherProfile()
      .then((res) => {
        if (!active) return
        setProfile(res.data)
      })
      .catch((error) => {
        if (!active) return
        setToast(error.message || 'Unable to load profile')
        setTimeout(() => setToast(''), 2400)
      })
    return () => { active = false }
  }, [])

  function openEdit() {
    const current = profile || user || {}
    setEditForm({
      name: current.name || '',
      phoneNumber: current.phoneNumber || current.mobileNumber || '',
      dob: current.dob || '',
    })
    setValidationErrors({})
    setIsEditOpen(true)
  }

  async function handleSave() {
    const nextErrors = {}

    if (!editForm.name.trim()) nextErrors.name = 'Full name is required.'
    if (!editForm.phoneNumber.trim()) nextErrors.phoneNumber = 'Mobile number is required.'
    if (!editForm.dob) nextErrors.dob = 'Date of birth is required.'

    if (Object.keys(nextErrors).length) {
      setValidationErrors(nextErrors)
      setToast('Please complete all required fields before saving.')
      setTimeout(() => setToast(''), 2400)
      return
    }

    try {
      setSaving(true)
      const response = await updateTeacherProfile({
        name: editForm.name.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
        dob: editForm.dob,
      })

      const updatedProfile = response?.data || { ...(profile || {}), ...editForm }
      setProfile(updatedProfile)
      setValidationErrors({})
      setIsEditOpen(false)
      setToast('Profile updated successfully.')
      onProfileUpdate?.(updatedProfile)
      setTimeout(() => setToast(''), 2400)
    } catch (error) {
      setToast(error.message || 'Unable to update profile')
      setTimeout(() => setToast(''), 2400)
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return (
      <div className="w-full animate-pulse space-y-4">
        <div className="h-24 rounded-md bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="h-72 rounded-md bg-slate-100" />
          <div className="space-y-4">
            <div className="h-40 rounded-md bg-slate-100" />
          </div>
        </div>
      </div>
    )
  }

  const label = roleLabel(profile.accountType)

  return (
    <div className="w-full">
      {toast && (
        <div className="border-b border-brand-200 bg-brand-100/70 px-6 py-3 text-sm font-medium text-brand-800">{toast}</div>
      )}

      <div className="flex flex-col gap-4 border-b border-rule px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Faculty profile</p>
          <h3 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-ink">{profile.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{profile.department || 'Department'} · {profile.school || 'School'}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
        </div>
      </div>

      <div className="grid gap-8 p-6 lg:grid-cols-[240px_1fr]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ink font-display text-3xl font-semibold text-paper">
            {profile.name?.[0] || 'F'}
          </div>
          <h4 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink">{profile.name}</h4>
          <p className="mt-1 font-mono text-xs text-slate-400">{profile.email}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-0.5 font-mono text-[11px] font-medium text-brand-700">{label}</span>
          </div>
          <div className="mt-6 w-full">
            <Button className="w-full justify-center" onClick={openEdit}>Edit Profile</Button>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h4 className="font-display text-base font-semibold tracking-tight text-ink">Personal Information</h4>
            <div className="mt-2">
              <DefinitionList
                items={[
                  { label: 'Full Name', value: profile.name },
                  { label: 'Email', value: profile.email },
                  { label: 'Mobile Number', value: profile.phoneNumber },
                  { label: 'Date of Birth', value: profile.dob },
                ]}
              />
            </div>
          </section>

          <section>
            <h4 className="font-display text-base font-semibold tracking-tight text-ink">Academic Information</h4>
            <div className="mt-2">
              <DefinitionList
                items={[
                  { label: 'Department', value: profile.department },
                  { label: 'School', value: profile.school },
                  { label: 'Role', value: label },
                  { label: 'Status', value: profile.status || 'Active' },
                ]}
              />
            </div>
          </section>
        </div>
      </div>

      <Modal open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Profile">
        <div className="space-y-4">
          <Field label="Full Name" error={validationErrors.name}>
            <Input invalid={!!validationErrors.name} value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mobile Number" error={validationErrors.phoneNumber}>
              <Input invalid={!!validationErrors.phoneNumber} value={editForm.phoneNumber} onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: e.target.value }))} />
            </Field>
            <Field label="Date of Birth" error={validationErrors.dob}>
              <Input invalid={!!validationErrors.dob} type="date" value={editForm.dob} onChange={(e) => setEditForm((prev) => ({ ...prev, dob: e.target.value }))} />
            </Field>
          </div>
          <Field label="Email">
            <Input value={profile?.email || ''} readOnly disabled className="!bg-paper !text-slate-500" />
          </Field>
          <p className="text-xs text-slate-400">Department and school are managed by the principal. To change them, contact your administration.</p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </Modal>
    </div>
  )
}