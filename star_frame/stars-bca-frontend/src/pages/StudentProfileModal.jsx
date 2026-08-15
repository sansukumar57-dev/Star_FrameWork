import React, { useEffect, useState } from 'react'
import { Modal, Button, Field, Input } from '../components/UI.jsx'
import { updateStudentProfile, getStudentProfile } from '../utils/api.js'

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

export default function StudentProfileModal({ student, points, onProfileUpdate }) {
  const [profileData, setProfileData] = useState(student)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', department: '', school: '', section: '', semesterBatch: '', phoneNumber: '', dob: '' })
  const [validationErrors, setValidationErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setProfileData(student)
    setEditForm({
      name: student?.name || '',
      department: student?.department || '',
      school: student?.school || '',
      section: student?.section || '',
      semesterBatch: student?.semesterBatch || student?.semester || '',
      phoneNumber: student?.phoneNumber || student?.mobileNumber || '',
      dob: student?.dob || '',
    })
    setValidationErrors({})
  }, [student])

  const statusLabel = profileData?.status === 'Inactive' || profileData?.isActive === false ? 'Inactive' : 'Active'
  const statusTone = statusLabel === 'Active' ? 'bg-leaf-100 text-leaf-600 border-leaf-300/50' : 'bg-amber-100 text-amber-700 border-amber-200'

  function openEdit() {
    setEditForm({
      name: profileData?.name || '',
      department: profileData?.department || '',
      school: profileData?.school || '',
      section: profileData?.section || '',
      semesterBatch: profileData?.semesterBatch || profileData?.semester || '',
      phoneNumber: profileData?.phoneNumber || profileData?.mobileNumber || '',
      dob: profileData?.dob || '',
    })
    setValidationErrors({})
    setIsEditOpen(true)
  }

  async function handleSave() {
    const nextErrors = {}

    if (!editForm.name.trim()) nextErrors.name = 'Full name is required.'
    if (!editForm.department.trim()) nextErrors.department = 'Department is required.'
    if (!editForm.school.trim()) nextErrors.school = 'School is required.'
    if (!editForm.section.trim()) nextErrors.section = 'Section is required.'
    if (!editForm.semesterBatch.trim()) nextErrors.semesterBatch = 'Semester or batch is required.'
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
      const response = await updateStudentProfile({
        name: editForm.name.trim(),
        department: editForm.department.trim(),
        school: editForm.school.trim(),
        section: editForm.section.trim(),
        semesterBatch: editForm.semesterBatch.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
        dob: editForm.dob,
      })

      let updatedStudent = response?.data || { ...profileData, ...editForm, phoneNumber: editForm.phoneNumber.trim(), dob: editForm.dob }

      try {
        const refreshed = await getStudentProfile()
        if (refreshed?.data) {
          updatedStudent = refreshed.data
        }
      } catch (refreshError) {
        console.warn('Unable to refresh profile after update', refreshError)
      }

      setProfileData(updatedStudent)
      onProfileUpdate?.(updatedStudent)
      setValidationErrors({})
      setIsEditOpen(false)
      setToast('Profile updated successfully.')
      setTimeout(() => setToast(''), 2400)
    } catch (error) {
      setToast(error.message || 'Unable to update profile')
      setTimeout(() => setToast(''), 2400)
    } finally {
      setSaving(false)
    }
  }

  if (!profileData) {
    return (
      <div className="w-full animate-pulse space-y-4">
        <div className="h-24 rounded-md bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="h-72 rounded-md bg-slate-100" />
          <div className="space-y-4">
            <div className="h-40 rounded-md bg-slate-100" />
            <div className="h-40 rounded-md bg-slate-100" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {toast && (
        <div className="border-b border-brand-200 bg-brand-100/70 px-6 py-3 text-sm font-medium text-brand-800">{toast}</div>
      )}

      <div className="flex flex-col gap-4 border-b border-rule px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">Student profile</p>
          <h3 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-ink">{profileData.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{profileData.department || 'Department'} · {profileData.school || 'School'}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400">Register No.</p>
          <p className="tabular border-l border-rule pl-3 font-mono text-sm font-medium text-ink">{profileData.registerNumber || profileData.regNo || '—'}</p>
        </div>
      </div>

      <div className="grid gap-8 p-6 lg:grid-cols-[240px_1fr]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ink font-display text-3xl font-semibold text-paper">
            {profileData.name?.[0] || 'S'}
          </div>
          <h4 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink">{profileData.name}</h4>
          <p className="tabular mt-1 font-mono text-xs text-slate-400">{profileData.registerNumber || profileData.regNo || '—'}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <span className={`rounded-full border px-3 py-0.5 font-mono text-[11px] font-medium ${statusTone}`}>{statusLabel}</span>
            <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-0.5 font-mono text-[11px] font-medium text-brand-700">{points} pts</span>
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
                  { label: 'Full Name', value: profileData.name },
                  { label: 'Email', value: profileData.email },
                  { label: 'Mobile Number', value: profileData.phoneNumber || profileData.mobileNumber },
                  { label: 'Date of Birth', value: profileData.dob },
                ]}
              />
            </div>
          </section>

          <section>
            <h4 className="font-display text-base font-semibold tracking-tight text-ink">Academic Information</h4>
            <div className="mt-2">
              <DefinitionList
                items={[
                  { label: 'Register Number', value: profileData.registerNumber || profileData.regNo },
                  { label: 'Department', value: profileData.department },
                  { label: 'School', value: profileData.school },
                  { label: 'Batch', value: profileData.batch },
                  { label: 'Semester', value: profileData.semester },
                  { label: 'Section', value: profileData.section },
                  { label: 'Faculty Mentor', value: profileData.facultyMentor },
                  { label: 'HOD', value: profileData.hod },
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
            <Field label="Department" error={validationErrors.department}>
              <Input invalid={!!validationErrors.department} value={editForm.department} onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))} />
            </Field>
            <Field label="School" error={validationErrors.school}>
              <Input invalid={!!validationErrors.school} value={editForm.school} onChange={(e) => setEditForm((prev) => ({ ...prev, school: e.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Section" error={validationErrors.section}>
              <Input invalid={!!validationErrors.section} value={editForm.section} onChange={(e) => setEditForm((prev) => ({ ...prev, section: e.target.value }))} />
            </Field>
            <Field label="Semester / Batch" error={validationErrors.semesterBatch}>
              <Input invalid={!!validationErrors.semesterBatch} value={editForm.semesterBatch} onChange={(e) => setEditForm((prev) => ({ ...prev, semesterBatch: e.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mobile Number" error={validationErrors.phoneNumber}>
              <Input invalid={!!validationErrors.phoneNumber} value={editForm.phoneNumber} onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: e.target.value }))} />
            </Field>
            <Field label="Date of Birth" error={validationErrors.dob}>
              <Input invalid={!!validationErrors.dob} type="date" value={editForm.dob} onChange={(e) => setEditForm((prev) => ({ ...prev, dob: e.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Register Number">
              <Input value={profileData?.registerNumber || profileData?.regNo || ''} readOnly disabled className="!bg-paper !text-slate-500" />
            </Field>
            <Field label="Email">
              <Input value={profileData?.email || ''} readOnly disabled className="!bg-paper !text-slate-500" />
            </Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </Modal>
    </div>
  )
}