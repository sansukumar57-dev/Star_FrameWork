const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getPendingSubmissions, exportSubmissions, getSubmissionDetails, approveSubmission, rejectSubmission, bulkApproveSubmissions, bulkRejectSubmissions, getDashboardStats, getFacultyProfile, updateFacultyProfile, getFacultyStudents, updateStudentRecords, bulkUpdateStudentRecords, deleteAssignedStudent, runAiReview, applyAiReview, exportTeacherReport, getAiClearedCount, autoApproveAiCleared, teacherValidators } = require('../controllers/teacherController');

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
router.get('/profile', getFacultyProfile);
router.put('/profile', teacherValidators.updateProfile, updateFacultyProfile);
router.get('/students', getFacultyStudents);
router.put('/student/:id/records', updateStudentRecords);
router.delete('/student/:id', deleteAssignedStudent);
router.post('/students/records/bulk-upload', upload.single('file'), bulkUpdateStudentRecords);
router.get('/report', exportTeacherReport);
router.get('/submissions/ai-cleared-count', getAiClearedCount);
router.post('/submissions/auto-approve-ai', autoApproveAiCleared);

module.exports = router;
