import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Shell from '../components/Shell.jsx'
import { Button, PageHeader, Card, Toast, Field } from '../components/UI.jsx'
import { getLookups, bulkUploadUsers, downloadBulkTemplate, bulkAssignFaculty } from '../utils/api.js'
import * as XLSX from 'xlsx'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

export default function BulkStudentUpload() {
  const [schools, setSchools] = useState([])
  const [departments, setDepartments] = useState([])
  const [faculty, setFaculty] = useState([])
  const [schoolInput, setSchoolInput] = useState('')
  const [departmentInput, setDepartmentInput] = useState('')
  const [facultyInput, setFacultyInput] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [summary, setSummary] = useState(null)
  const [toast, setToast] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [assignFile, setAssignFile] = useState(null)
  const [assignUploading, setAssignUploading] = useState(false)
  const [assignSummary, setAssignSummary] = useState(null)

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
    if (currentUser?.school) setSchoolInput(currentUser.school)
    if (currentUser?.department) setDepartmentInput(currentUser.department)
  }, [currentUser?.accountType, currentUser?.school, currentUser?.department])

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

  function handleFileSelect(event) {
    const selectedFile = event.target.files?.[0] || null
    setFile(selectedFile)
    setSummary(null)
    if (!selectedFile) {
      setPreviewData(null)
      setShowPreview(false)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (jsonData.length === 0) {
          notify('The Excel file is empty.', 'error')
          setFile(null)
          return
        }

        const headers = jsonData[0].map((h) => String(h || '').toLowerCase().trim())
        const rows = jsonData.slice(1).filter((row) => row.some((cell) => cell != null && String(cell).trim() !== ''))

        const parsedRows = rows.map((row, index) => {
          const getVal = (possibleHeaders) => {
            for (const h of possibleHeaders) {
              const idx = headers.indexOf(h)
              if (idx !== -1 && row[idx] != null) return String(row[idx]).trim()
            }
            return ''
          }

          const name = getVal(['student name', 'studentname', 'name'])
          const regNo = getVal(['reg no', 'regno', 'reg no.'])
          const email = getVal(['email'])
          const password = getVal(['password'])
          const section = getVal(['section'])

          const errors = []
          if (!name) errors.push('Missing student name')
          if (!regNo) errors.push('Missing reg no')
          if (!email) errors.push('Missing email')
          if (!password) errors.push('Missing password')

          return { rowNumber: index + 2, name, regNo, email, password, section, errors, valid: errors.length === 0 }
        })

        setPreviewData({ totalRows: parsedRows.length, rows: parsedRows })
        setShowPreview(true)
      } catch {
        notify('Unable to parse the Excel file. Please check the format.', 'error')
        setFile(null)
        setPreviewData(null)
        setShowPreview(false)
      }
    }
    reader.readAsArrayBuffer(selectedFile)
  }

  async function handleUpload(event) {
    event?.preventDefault?.()
    const schoolText = schoolInput.trim()
    const departmentText = departmentInput.trim()
    const facultyText = facultyInput.trim()
    if (!file || !schoolText || !departmentText || !facultyText) {
      notify('Provide the school, department, faculty (pick or type a name), and Excel file before uploading.', 'error')
      return
    }

    const resolveId = (list, text) => {
      const match = list.find((item) => String(item.name || '').trim().toLowerCase() === text.toLowerCase())
      return match?._id || ''
    }

    const resolvedSchoolId = resolveId(schools, schoolText)
    const resolvedDepartmentId = resolveId(departments, departmentText)
    const resolvedFacultyId = resolveId(faculty, facultyText)

    try {
      setUploading(true)
      setToast(null)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('schoolId', resolvedSchoolId)
      formData.append('schoolName', schoolText)
      formData.append('departmentId', resolvedDepartmentId)
      formData.append('departmentName', departmentText)
      formData.append('facultyId', resolvedFacultyId)
      formData.append('facultyName', facultyText)

      const data = await bulkUploadUsers(formData)
      const result = data.data || {}
      setSummary(result)

      const failed = result.failureCount || 0
      const duplicated = result.duplicateCount || 0
      const inserted = result.successCount || 0
      if (failed > 0 || duplicated > 0) {
        notify(`Upload finished with ${failed} failed and ${duplicated} duplicate row${failed + duplicated === 1 ? '' : 's'}. Review the summary below.`, 'error')
      } else {
        notify(`Bulk upload completed: ${inserted} student${inserted === 1 ? '' : 's'} inserted.`)
      }

      setFile(null)
      setPreviewData(null)
      setShowPreview(false)
      setSchoolInput('')
      setDepartmentInput('')
      setFacultyInput('')
    } catch (error) {
      notify(error.message || 'Unable to upload students', 'error')
    } finally {
      setUploading(false)
    }
  }

  const matchedSchool = useMemo(() => {
    const text = schoolInput.trim().toLowerCase()
    if (!text) return null
    return schools.find((school) => String(school.name || '').trim().toLowerCase() === text) || null
  }, [schools, schoolInput])

  const visibleDepartments = useMemo(() => {
    if (!matchedSchool) return departments
    const schoolId = matchedSchool._id
    return departments.filter((department) => {
      const departmentSchoolId = department.schoolId?._id || department.schoolId || ''
      return departmentSchoolId.toString() === schoolId.toString()
    })
  }, [departments, matchedSchool])

  const matchedDepartment = useMemo(() => {
    const text = departmentInput.trim().toLowerCase()
    if (!text) return null
    return visibleDepartments.find((department) => String(department.name || '').trim().toLowerCase() === text) || null
  }, [visibleDepartments, departmentInput])

  const visibleFaculty = useMemo(() => {
    if (!matchedDepartment) return faculty
    const departmentId = matchedDepartment._id
    return faculty.filter((member) => {
      const memberDepartmentId = member.departmentId?._id || member.departmentId || ''
      return memberDepartmentId.toString() === departmentId.toString()
    })
  }, [faculty, matchedDepartment])

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

  async function handleAssignUpload(event) {
    event.preventDefault()
    if (!assignFile) {
      notify('Choose the faculty assignment Excel file before uploading.', 'error')
      return
    }

    try {
      setAssignUploading(true)
      const formData = new FormData()
      formData.append('file', assignFile)
      const data = await bulkAssignFaculty(formData)
      const result = data.data || {}
      setAssignSummary(result)
      const failed = (result.failureCount || 0) + (result.notFoundCount || 0)
      if (failed > 0) {
        notify(`Faculty assignment finished with ${failed} row${failed === 1 ? '' : 's'} not assigned. Review the summary below.`, 'error')
      } else {
        notify(`Faculty assignment completed: ${result.successCount || 0} assigned.`)
      }
      event.target.reset()
      setAssignFile(null)
    } catch (error) {
      notify(error.message || 'Unable to assign faculty', 'error')
    } finally {
      setAssignUploading(false)
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
              <Field label="School" hint="Pick from the list or type a new name">
                <input
                  list="bulk-school-options"
                  value={schoolInput}
                  onChange={(event) => setSchoolInput(event.target.value)}
                  placeholder="e.g. STAR"
                  className="block w-full rounded-md border border-rule bg-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <datalist id="bulk-school-options">
                  {schools.map((school) => <option key={school._id} value={school.name} />)}
                </datalist>
              </Field>
              <Field label="Department" hint="Pick from the list or type a new name">
                <input
                  list="bulk-department-options"
                  value={departmentInput}
                  onChange={(event) => setDepartmentInput(event.target.value)}
                  placeholder={matchedSchool ? 'e.g. Computer Science' : 'Select a school first'}
                  className="block w-full rounded-md border border-rule bg-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <datalist id="bulk-department-options">
                  {visibleDepartments.map((department) => <option key={department._id} value={department.name} />)}
                </datalist>
              </Field>
              <Field label="Faculty" hint="Existing faculty account required">
                <input
                  list="bulk-faculty-options"
                  value={facultyInput}
                  onChange={(event) => setFacultyInput(event.target.value)}
                  placeholder={matchedDepartment ? 'e.g. Priya Sharma' : 'Select a department first'}
                  className="block w-full rounded-md border border-rule bg-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <datalist id="bulk-faculty-options">
                  {visibleFaculty.map((member) => <option key={member._id} value={member.name} />)}
                </datalist>
              </Field>
            </div>

            <Field label="Excel file" hint="Only .xlsx and .xls files are accepted.">
              <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-rule bg-paper px-6 py-8 text-center cursor-pointer hover:border-brand-500 focus-within:ring-2 focus-within:ring-brand-400 focus-within:border-brand-500 transition-colors">
                <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={handleFileSelect} />
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

            {!showPreview && (
              <Button type="submit" loading={uploading} disabled={!file || !schoolInput.trim() || !departmentInput.trim() || !facultyInput.trim()} className="w-full md:w-auto">
                {uploading ? 'Uploading…' : 'Upload Students'}
              </Button>
            )}
          </form>
        </Card>

        {showPreview && previewData && (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">File Preview</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                previewData.totalRows > 100 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-leaf-100 text-leaf-700 border border-leaf-200'
              }`}>
                {previewData.totalRows} row{previewData.totalRows !== 1 ? 's' : ''} detected
              </span>
            </div>

            {previewData.totalRows > 100 && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                ⚠ This file contains more than 100 rows. Large uploads may take longer to process.
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left">
                    <th className="pb-2 pr-3 font-mono text-[11px] uppercase tracking-wider text-slate-400">Status</th>
                    <th className="pb-2 pr-3 font-mono text-[11px] uppercase tracking-wider text-slate-400">Row #</th>
                    <th className="pb-2 pr-3 font-mono text-[11px] uppercase tracking-wider text-slate-400">Student Name</th>
                    <th className="pb-2 pr-3 font-mono text-[11px] uppercase tracking-wider text-slate-400">Reg No</th>
                    <th className="pb-2 pr-3 font-mono text-[11px] uppercase tracking-wider text-slate-400">Email</th>
                    <th className="pb-2 pr-3 font-mono text-[11px] uppercase tracking-wider text-slate-400">Password</th>
                    <th className="pb-2 font-mono text-[11px] uppercase tracking-wider text-slate-400">Section</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.slice(0, 10).map((row) => (
                    <tr key={row.rowNumber} className="border-b border-rule/50">
                      <td className="py-2 pr-3">
                        {row.valid ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-leaf-100 text-leaf-600 text-xs font-bold">✓</span>
                        ) : (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-xs font-bold">✗</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-500">{row.rowNumber}</td>
                      <td className="py-2 pr-3 text-ink">{row.name || <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 pr-3 text-ink">{row.regNo || <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 pr-3 text-ink">{row.email || <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 pr-3 font-mono text-slate-400">{row.password ? '••••••••' : <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 text-ink">{row.section || <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewData.totalRows > 10 && (
              <p className="mt-3 text-xs text-slate-400">Showing first 10 of {previewData.totalRows} rows.</p>
            )}

            {previewData.rows.some((r) => !r.valid) && (
              <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-4">
                <h3 className="text-sm font-semibold text-rose-800">Validation Errors</h3>
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5">
                  {previewData.rows.filter((r) => !r.valid).map((row) => (
                    <div key={row.rowNumber} className="text-sm text-rose-700">
                      <span className="font-medium">Row {row.rowNumber}:</span> {row.errors.join(', ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <Button onClick={handleUpload} loading={uploading} disabled={!schoolInput.trim() || !departmentInput.trim() || !facultyInput.trim() || previewData.rows.some((r) => !r.valid)} className="w-full md:w-auto">
                {uploading ? 'Uploading…' : 'Confirm Upload'}
              </Button>
              <Button variant="outline" onClick={() => { setFile(null); setPreviewData(null); setShowPreview(false); }} className="w-full md:w-auto">
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {summary && (
          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Upload Summary</h2>
            {(summary.failureCount || 0) > 0 || (summary.duplicateCount || 0) > 0 ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
                <p className="font-semibold text-rose-800">{(summary.failureCount || 0) + (summary.duplicateCount || 0)} row{(summary.failureCount || 0) + (summary.duplicateCount || 0) === 1 ? '' : 's'} were not inserted.</p>
                <p className="mt-1">{(summary.failureCount || 0)} failed and {(summary.duplicateCount || 0)} duplicate{(summary.duplicateCount || 0) === 1 ? '' : 's'} found. Review the rows below and re-upload the corrected file.</p>
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-leaf-200 bg-leaf-100/60 p-4 text-sm text-leaf-700" role="status">
                All {(summary.successCount || 0)} row{(summary.successCount || 0) === 1 ? '' : 's'} were inserted successfully.
              </div>
            )}
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

        {/* Bulk assign faculty to departments */}
        <Card className="p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Bulk Assign Faculty to Departments</h2>
            <p className="text-sm text-slate-400">Upload an Excel file with faculty <span className="font-medium text-slate-500">email (or name)</span> and <span className="font-medium text-slate-500">department code (or name)</span> to reassign them in one action.</p>
          </div>
          <form onSubmit={handleAssignUpload} className="mt-5 space-y-5">
            <Field label="Faculty assignment Excel file" hint="Only .xlsx and .xls files are accepted.">
              <label className="flex flex-col items-center justify-center rounded-md border border-dashed border-rule bg-paper px-6 py-8 text-center cursor-pointer hover:border-brand-500 focus-within:ring-2 focus-within:ring-brand-400 focus-within:border-brand-500 transition-colors">
                <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => setAssignFile(event.target.files?.[0] || null)} />
                {assignFile ? (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-leaf-200 bg-leaf-100/60 font-mono text-sm text-leaf-600">✓</span>
                    <p className="mt-2 text-sm font-semibold text-ink">{assignFile.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{(assignFile.size / 1024).toFixed(1)} KB — click to change</p>
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
            <Button type="submit" loading={assignUploading} disabled={!assignFile} className="w-full md:w-auto">
              {assignUploading ? 'Assigning…' : 'Assign Faculty'}
            </Button>
          </form>

          {assignSummary && (
            <div className="mt-6 border-t border-rule pt-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-md border border-rule bg-card p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">Total rows</p>
                  <p className="mt-1 text-2xl font-semibold text-ink">{assignSummary.totalRows || 0}</p>
                </div>
                <div className="rounded-md border border-leaf-200 bg-leaf-100/60 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-leaf-600">Assigned</p>
                  <p className="mt-1 text-2xl font-semibold text-leaf-600">{assignSummary.successCount || 0}</p>
                </div>
                <div className="rounded-md border border-rose-200 bg-rose-50/60 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-rose-600">Failed rows</p>
                  <p className="mt-1 text-2xl font-semibold text-rose-600">{assignSummary.failureCount || 0}</p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-700">Not found</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-700">{assignSummary.notFoundCount || 0}</p>
                </div>
              </div>
              {assignSummary.validationErrors?.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-ink">Validation errors</h3>
                  <div className="mt-3 space-y-2">
                    {assignSummary.validationErrors.map((item, index) => (
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
            </div>
          )}
        </Card>
      </div>
    </Shell>
  )
}
