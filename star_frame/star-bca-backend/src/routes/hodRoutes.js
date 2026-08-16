const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const {
  getFacultyApprovedSubmissions,
  getSubmissionDetails,
  approveSubmission,
  rejectSubmission,
  bulkApproveSubmissions,
  bulkRejectSubmissions,
  getDashboardStats,
  exportSubmissions,
  lockSemester,
  unlockSemester,
  getSemesterStatus,
  runAiReview,
} = require('../controllers/hodController');

const router = express.Router();

router.use(authMiddleware, allowRoles('admin'));
router.use((req, res, next) => {
  if (req.user.accountType !== 'hod') return res.status(403).json({ success: false, message: 'HOD access only' });
  next();
});

router.get('/dashboard', getDashboardStats);
router.get('/submissions/pending', getFacultyApprovedSubmissions);
router.get('/submissions/export', exportSubmissions);
router.post('/submissions/bulk-approve', bulkApproveSubmissions);
router.post('/submissions/bulk-reject', bulkRejectSubmissions);
router.get('/submission/:id', getSubmissionDetails);
router.put('/submission/:id/approve', approveSubmission);
router.put('/submission/:id/reject', rejectSubmission);
router.post('/submission/:id/ai-review', runAiReview);
router.put('/semester/lock', lockSemester);
router.put('/semester/unlock', unlockSemester);
router.get('/semester/status', getSemesterStatus);

module.exports = router;
