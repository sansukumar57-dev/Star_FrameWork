const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getPendingSubmissions, exportSubmissions, getSubmissionDetails, approveSubmission, rejectSubmission, bulkApproveSubmissions, bulkRejectSubmissions, getDashboardStats, getFacultyStudents, updateStudentRecords, bulkUpdateStudentRecords, runAiReview, applyAiReview, exportTeacherReport, getAiClearedCount, autoApproveAiCleared } = require('../controllers/teacherController');

const router = express.Router();

router.use(authMiddleware, allowRoles('faculty', 'teacher'));

router.get('/submissions/pending', getPendingSubmissions);
router.get('/submissions/export', exportSubmissions);
router.post('/submissions/bulk-approve', bulkApproveSubmissions);
router.post('/submissions/bulk-reject', bulkRejectSubmissions);
router.get('/submission/:id', getSubmissionDetails);
router.put('/submission/:id/approve', approveSubmission);
router.put('/submission/:id/reject', rejectSubmission);
router.post('/submission/:id/ai-review', runAiReview);
router.post('/submission/:id/ai-apply', applyAiReview);
router.get('/dashboard', getDashboardStats);
router.get('/students', getFacultyStudents);
router.put('/student/:id/records', updateStudentRecords);
router.post('/students/records/bulk-upload', upload.single('file'), bulkUpdateStudentRecords);
router.get('/report', exportTeacherReport);
router.get('/submissions/ai-cleared-count', getAiClearedCount);
router.post('/submissions/auto-approve-ai', autoApproveAiCleared);

module.exports = router;
