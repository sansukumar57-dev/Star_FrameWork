const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const name = (file.originalname || '').toLowerCase();
  const mimetype = (file.mimetype || '').toLowerCase();
  const extname = /pdf|png|jpe?g|webp|csv|json|txt|xlsx?|xls|mp4|webm|mov|mkv/.test(path.extname(name));
  const isAllowedMime = [
    'application/pdf',
    'image/png',
    'image/jpg',
    'image/jpeg',
    'image/pjpeg',
    'image/webp',
    'text/csv',
    'application/csv',
    'application/json',
    'text/plain',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska',
  ].includes(mimetype) || /csv|json|txt|xlsx?|xls|mp4|webm|mov|mkv/.test(mimetype);
  if (extname && isAllowedMime) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, PNG, JPG, JPEG, WEBP, Word, CSV, JSON, TXT, Excel, or video files are allowed'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter
});

module.exports = upload;
