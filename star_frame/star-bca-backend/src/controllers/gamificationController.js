const {
  getStudentStats,
  getStudentBadges,
  getDepartmentLeaderboard
} = require('../services/gamificationService');
const { getCoachInsights } = require('../services/coachService');

const handleError = (res, error, statusCode = 500) => {
  console.error('Error:', error);
  res.status(statusCode).json({
    success: false,
    message: error.message || 'An error occurred',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

/**
 * Get student stats including points, streak, badges
 */
async function getStudentStatsController(req, res) {
  try {
    const { studentId } = req.params;
    
    const stats = await getStudentStats(studentId);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or is not a valid student'
      });
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * Get student badges
 */
async function getStudentBadgesController(req, res) {
  try {
    const { studentId } = req.params;
    const { academicYear } = req.query;
    
    const badges = await getStudentBadges(studentId, academicYear);

    res.json({
      success: true,
      data: badges
    });
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * Get department leaderboard
 */
async function getDepartmentLeaderboardController(req, res) {
  try {
    const { departmentId } = req.params;
    const { academicYear, limit = 10 } = req.query;
    
    const leaderboard = await getDepartmentLeaderboard(
      departmentId,
      academicYear,
      Math.min(parseInt(limit) || 10, 100)
    );

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * Get AI coaching insights for a student (progress summary, next steps)
 */
async function getStudentCoachInsightsController(req, res) {
  try {
    const { studentId } = req.params;

    const insights = await getCoachInsights(studentId);

    if (!insights) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or is not a valid student'
      });
    }

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    handleError(res, error);
  }
}

module.exports = {
  getStudentStats: getStudentStatsController,
  getStudentBadges: getStudentBadgesController,
  getDepartmentLeaderboard: getDepartmentLeaderboardController,
  getStudentCoachInsights: getStudentCoachInsightsController
};
