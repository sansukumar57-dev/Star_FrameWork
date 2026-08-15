const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const {
  getStudentStats,
  getStudentBadges,
  getDepartmentLeaderboard,
  getStudentCoachInsights
} = require('../controllers/gamificationController');

const router = express.Router();

router.use(authMiddleware);

// Student stats and gamification
router.get('/student/:studentId/stats', getStudentStats);
router.get('/student/:studentId/badges', getStudentBadges);
router.get('/student/:studentId/coach', getStudentCoachInsights);

// Leaderboards
router.get('/leaderboard/department/:departmentId', getDepartmentLeaderboard);

module.exports = router;
