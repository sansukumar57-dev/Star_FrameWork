const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const { getPendingSubmissions, exportSubmissions, getSubmissionDetails, approveSubmission, rejectSubmission, bulkApproveSubmissions, bulkRejectSubmissions, getDashboardStats, runAiReview, applyAiReview } = require('../controllers/teacherController');

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

module.exports = router;
