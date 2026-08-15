const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Supported file types
const ALLOWED_MIME_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'video/mp4': ['.mp4'],
  'video/mpeg': ['.mpeg'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

/**
 * Validate file type and size
 */
function validateFile(file) {
  const errors = [];

  if (!file) {
    errors.push('No file provided');
    return { valid: false, errors };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    errors.push(`File type ${file.mimetype} is not allowed. Allowed types: PDF, Images, Videos, Word documents`);
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ALLOWED_MIME_TYPES[file.mimetype] || [];
  if (!allowedExts.includes(ext)) {
    errors.push(`File extension ${ext} does not match the file type`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate unique filename to avoid collisions
 */
function generateUniqueFilename(originalFilename, studentId) {
  const ext = path.extname(originalFilename);
  const name = path.basename(originalFilename, ext);
  const timestamp = Date.now();
  const hash = crypto.randomBytes(4).toString('hex');
  
  return `${studentId}_${name}_${timestamp}_${hash}${ext}`;
}

/**
 * Handle file upload with progress tracking
 * Returns progress tracker object
 */
function createProgressTracker(file) {
  return {
    filename: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    uploaded: 0,
    percentage: 0,
    startTime: Date.now(),
    status: 'uploading',
    error: null
  };
}

/**
 * Update progress
 */
function updateProgress(tracker, bytesUploaded) {
  tracker.uploaded = bytesUploaded;
  tracker.percentage = Math.round((bytesUploaded / tracker.size) * 100);
  
  if (tracker.percentage === 100) {
    tracker.status = 'completed';
  }
  
  return tracker;
}

/**
 * Save uploaded file to disk with chunked upload support
 */
async function saveUploadedFile(file, studentId, customDir = null) {
  try {
    const validation = validateFile(file);
    if (!validation.valid) {
      const error = new Error('File validation failed');
      error.details = validation.errors;
      throw error;
    }

    // Create directory if it doesn't exist
    const uploadPath = customDir || path.join(UPLOAD_DIR, 'submissions', studentId);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Generate unique filename
    const filename = generateUniqueFilename(file.originalname, studentId);
    const filepath = path.join(uploadPath, filename);

    // Save file
    await file.mv(filepath);

    return {
      originalName: file.originalname,
      savedName: filename,
      filepath: filepath,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date()
    };
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
}

/**
 * Delete uploaded file
 */
async function deleteUploadedFile(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

/**
 * Get file stream for download
 */
async function getFileStream(filepath) {
  try {
    if (!fs.existsSync(filepath)) {
      throw new Error('File not found');
    }
    return fs.createReadStream(filepath);
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
}

/**
 * Clean up old uploads (older than specified days)
 */
async function cleanupOldUploads(daysOld = 30) {
  try {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const uploadPath = path.join(UPLOAD_DIR, 'submissions');

    if (!fs.existsSync(uploadPath)) {
      return { deleted: 0, errors: [] };
    }

    const results = { deleted: 0, errors: [] };
    
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        
        if (stats.isDirectory()) {
          walkDir(filepath);
          // Try to remove empty directory
          try {
            if (fs.readdirSync(filepath).length === 0) {
              fs.rmdirSync(filepath);
            }
          } catch (e) {
            // Ignore errors for non-empty directories
          }
        } else if (stats.mtime.getTime() < cutoffTime) {
          try {
            fs.unlinkSync(filepath);
            results.deleted++;
          } catch (error) {
            results.errors.push({ file: filepath, error: error.message });
          }
        }
      });
    };

    walkDir(uploadPath);
    return results;
  } catch (error) {
    console.error('Error cleaning up uploads:', error);
    throw error;
  }
}

module.exports = {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  validateFile,
  generateUniqueFilename,
  createProgressTracker,
  updateProgress,
  saveUploadedFile,
  deleteUploadedFile,
  getFileStream,
  cleanupOldUploads
};
