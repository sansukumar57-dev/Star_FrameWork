import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Shell from '../components/Shell.jsx'
import { Button, PageHeader, Card, Toast, Field, Select } from '../components/UI.jsx'
import { getLookups, bulkUploadUsers, downloadBulkTemplate } from '../utils/api.js'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

export default function BulkStudentUpload() {
  const [schools, setSchools] = useState([])
  const [departments, setDepartments] = useState([])
  const [faculty, setFaculty] = useState([])
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [selectedFacultyId, setSelectedFacultyId] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [summary, setSummary] = useState(null)
  const [toast, setToast] = useState(null)

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('stars_user') || '{}')
    } catch {
      return {}
    }
  }, [])

  const shellRole = currentUser?.accountType === 'hod' ? 'hod' : 'principal'

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    loadLookups()
  }, [])

  useEffect(() => {
    if (currentUser?.accountType !== 'hod') return
    if (currentUser?.schoolId) {
      setSelectedSchoolId(currentUser.schoolId)
    }
    if (currentUser?.departmentId) {
      setSelectedDepartmentId(currentUser.departmentId)
    }
  }, [currentUser?.accountType, currentUser?.schoolId, currentUser?.departmentId])

  async function loadLookups() {
    try {
      const data = await getLookups()
      setSchools(data.data?.schools || [])
      setDepartments(data.data?.departments || [])
      setFaculty(data.data?.faculty || [])
    } catch (error) {
      console.error(error)
    }
  }

  const visibleDepartments = useMemo(() => {
    if (!selectedSchoolId) return departments
    return departments.filter((department) => {
      const departmentSchoolId = department.schoolId?._id || department.schoolId || ''
      return departmentSchoolId.toString() === selectedSchoolId.toString()
    })
  }, [departments, selectedSchoolId])

  const visibleFaculty = useMemo(() => {
    if (!selectedDepartmentId) return faculty
    return faculty.filter((member) => {
      const memberDepartmentId = member.departmentId?._id || member.departmentId || ''
      return memberDepartmentId.toString() === selectedDepartmentId.toString()
    })
  }, [faculty, selectedDepartmentId])

  async function handleUpload(event) {
    event.preventDefault()
    if (!file || !selectedSchoolId || !selectedDepartmentId || !selectedFacultyId) {
      notify('Select the school, department, faculty, and Excel file before uploading.', 'error')
      return
    }

    try {
      setUploading(true)
      setToast(null)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('schoolId', selectedSchoolId)
      formData.append('departmentId', selectedDepartmentId)
      formData.append('facultyId', selectedFacultyId)

      const data = await bulkUploadUsers(formData)
      setSummary(data.data || null)
      notify('Bulk upload completed.')
      event.target.reset()
      setFile(null)
      setSelectedSchoolId('')
      setSelectedDepartmentId('')
      setSelectedFacultyId('')
    } catch (error) {
      notify(error.message || 'Unable to upload students', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true)
    try {
      await downloadBulkTemplate()
    } catch (error) {
      notify(error.message || 'Unable to download template', 'error')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  return (
    <Shell role={shellRole} userName={currentUser.name || 'Admin'} department={currentUser.department || 'Bulk Upload'}>
      <div className="max-w-5xl space-y-6">
        <PageHeader
          title="Bulk Student Upload"
          subtitle="Upload an Excel sheet of students and assign the recommended school, department, and faculty in one action."
          actions={<Button variant="outline" onClick={handleDownloadTemplate} loading={downloadingTemplate}>⬇ Download Template</Button>}
        />

        {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}

        <div className="rounded-md border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-amber-300 bg-amber-100 font-mono text-[11px] font-medium">!</span>
            Excel format instructions
          </h2>
          <p className="mt-2 text-sm text-amber-700">The Excel file should contain these columns in order:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['student name', 'reg no', 'email', 'password', 'section', 'year', 'batch'].map((column) => (
              <span key={column} className="rounded-full bg-card px-3 py-1 text-sm font-medium text-amber-800 border border-amber-200">
                {column}
              </span>
            ))}
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={handleUpload} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Recommended School">
                <Select value={selectedSchoolId} onChange={(event) => {
                  setSelectedSchoolId(event.target.value)
                  setSelectedDepartmentId('')
                  setSelectedFacultyId('')
                }}>
                  <option value="">Select school</option>
                  {schools.map((school) => <option key={school._id} value={school._id}>{school.name}</option>)}
                </Select>
              </Field>
              <Field label="Recommended Department">
                <Select value={selectedDepartmentId} onChange={(event) => {
                  setSelectedDepartmentId(event.target.value)
                  setSelectedFacultyId('')
                }} disabled={!selectedSchoolId}>
                  <option value="">Select department</option>
                  {visibleDepartments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
                </Select>
              </Field>
              <Field label="Recommended Faculty">
                <Select value={selectedFacultyId} onChange={(event) => setSelectedFacultyId(event.target.value)} disabled={!selectedDepartmentId}>
                  <option value="">Select faculty</option>
                  {visibleFaculty.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
                </Select>
              </Field>
            </div>

            <Field label="Excel file" hint="Only .xlsx and .xls files are accepted.">
              <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-rule bg-paper px-6 py-8 text-center cursor-pointer hover:border-brand-500 transition-colors">
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                {file ? (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-leaf-200 bg-leaf-100/60 font-mono text-sm text-leaf-600">✓</span>
                    <p className="mt-2 text-sm font-semibold text-ink">{file.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                  </>
                ) : (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-rule bg-card font-mono text-base text-slate-400">↑</span>
                    <p className="mt-2 text-sm font-medium text-slate-500">Click to choose your Excel file</p>
                    <p className="mt-1 text-xs text-slate-400">.xlsx or .xls</p>
                  </>
                )}
              </label>
            </Field>

            <Button type="submit" loading={uploading} disabled={!file || !selectedSchoolId || !selectedDepartmentId || !selectedFacultyId} className="w-full md:w-auto">
              {uploading ? 'Uploading…' : 'Upload Students'}
            </Button>
          </form>
        </Card>

        {summary && (
          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Upload Summary</h2>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border border-rule bg-card p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">Total rows</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{summary.totalRows || 0}</p>
              </div>
              <div className="rounded-md border border-leaf-200 bg-leaf-100/60 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-leaf-600">Inserted</p>
                <p className="mt-1 text-2xl font-semibold text-leaf-600">{summary.successCount || 0}</p>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50/60 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-rose-600">Failed rows</p>
                <p className="mt-1 text-2xl font-semibold text-rose-600">{summary.failureCount || 0}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-700">Duplicates</p>
                <p className="mt-1 text-2xl font-semibold text-amber-700">{summary.duplicateCount || 0}</p>
              </div>
            </div>

            {summary.validationErrors?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-ink">Validation errors</h3>
                <div className="mt-3 space-y-2">
                  {summary.validationErrors.map((item, index) => (
                    <div key={`${item.rowNumber}-${index}`} className="rounded-md border border-rule p-3 text-sm text-slate-600">
                      <p className="font-medium text-ink">Row {item.rowNumber}</p>
                      <ul className="mt-1 list-disc pl-5 space-y-1">
                        {item.errors.map((error, errorIndex) => <li key={`${error}-${errorIndex}`}>{error}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </Shell>
  )
}
