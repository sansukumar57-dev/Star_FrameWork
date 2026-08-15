import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Enhanced File Upload Component with Progress Tracking
 * Features:
 * - File type validation
 * - Progress bar
 * - Drag and drop
 * - Multiple file support
 * - File preview
 */
export default function FileUploadWithProgress({
  onFileSelected = null,
  onUploadProgress = null,
  onUploadComplete = null,
  onUploadError = null,
  acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
  maxSize = 100 * 1024 * 1024, // 100 MB
  multiple = false,
  label = 'Upload Evidence',
  className = ''
}) {
  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [error, setError] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])

  const validationErrors = {
    size: 'File size exceeds maximum allowed',
    type: 'File type not allowed',
    required: 'Please select a file'
  }

  const getFileTypeIcon = (mimeType) => {
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('image')) return '🖼️'
    if (mimeType.includes('video')) return '🎥'
    if (mimeType.includes('word') || mimeType.includes('document')) return '📑'
    return '📎'
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const validateFile = (file) => {
    setError('')

    if (!acceptedTypes.includes(file.type)) {
      setError(validationErrors.type)
      return false
    }

    if (file.size > maxSize) {
      setError(validationErrors.size)
      return false
    }

    return true
  }

  const handleFileSelect = (files) => {
    const fileList = Array.from(files)

    if (!multiple && fileList.length > 1) {
      setError('Only one file can be uploaded at a time')
      return
    }

    for (const file of fileList) {
      if (!validateFile(file)) {
        return
      }
    }

    setSelectedFiles(fileList)
    setError('')
    onFileSelected?.(multiple ? fileList : fileList[0])
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    handleFileSelect(files)
  }

  const handleInputChange = (e) => {
    const files = e.target.files
    if (files) {
      handleFileSelect(files)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const simulateUpload = async (file) => {
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100))
        setUploadProgress(i)
        onUploadProgress?.(i)
      }

      setIsUploading(false)
      setUploadedFile({
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
        uploadedAt: new Date().toLocaleTimeString()
      })
      onUploadComplete?.(file)
    } catch (error) {
      setIsUploading(false)
      setError('Upload failed: ' + error.message)
      onUploadError?.(error)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Upload Area */}
      <motion.div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleUploadClick}
        animate={{
          backgroundColor: isDragging ? '#eff6ff' : '#ffffff',
          borderColor: isDragging ? '#3b82f6' : '#e5e7eb'
        }}
        className="relative border-2 border-dashed rounded-lg p-6 cursor-pointer transition-all"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="text-center">
          <div className="mb-2 text-3xl">📤</div>
          <h3 className="font-medium text-ink mb-1">{label}</h3>
          <p className="text-sm text-slate-400 mb-2">
            Drag and drop your file here or click to browse
          </p>
          <p className="text-xs text-slate-500">
            Max file size: {formatFileSize(maxSize)}
          </p>
        </div>

        {isDragging && (
          <motion.div
            className="absolute inset-0 bg-blue-100 rounded-lg opacity-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
          />
        )}
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          ⚠️ {error}
        </motion.div>
      )}

      {/* Progress Bar */}
      {isUploading && (
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex justify-between text-xs text-slate-600">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full"
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && !isUploading && (
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {selectedFiles.map((file, idx) => (
            <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xl shrink-0">{getFileTypeIcon(file.type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))
                  setUploadProgress(0)
                }}
                className="text-xs text-slate-400 hover:text-rose-600 ml-2 shrink-0"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Upload Button */}
          <button
            onClick={() => simulateUpload(selectedFiles[0])}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Start Upload
          </button>
        </motion.div>
      )}

      {/* Uploaded File Info */}
      {uploadedFile && !isUploading && (
        <motion.div
          className="p-3 rounded-lg bg-green-50 border border-green-200 space-y-1"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <p className="text-sm font-medium text-green-700">File uploaded successfully</p>
          </div>
          <p className="text-xs text-green-600">{uploadedFile.name}</p>
          <p className="text-xs text-green-600">{uploadedFile.uploadedAt}</p>
        </motion.div>
      )}
    </div>
  )
}
