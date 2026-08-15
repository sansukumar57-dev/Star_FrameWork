const { sendSuccess, sendError } = require('../utils/response');
const { generateActivitySuggestions } = require('../services/activitySuggestionService');
const { getAtRiskStudents, notifyAtRiskStudents } = require('../services/atRiskService');
const { getTrendAnalytics } = require('../services/trendAnalyticsService');
const { listFlaggedDuplicates } = require('../services/duplicateDetectionService');
const { buildDigestForStudent, sendWeeklyDigest } = require('../services/weeklyDigestService');
const User = require('../models/User');

const scopeFrom = (req) => ({
  scopedSchoolId: req.user?.accountType === 'dean' ? req.user.schoolId : null,
  scopedDepartmentId: req.user?.accountType === 'hod' ? req.user.departmentId : null,
});

const suggestActivity = async (req, res, next) => {
  try {
    const { activityName, vertical, maximumPoints } = req.body || {};
    if (!String(activityName || '').trim()) return sendError(res, 400, 'activityName is required');
    const suggestions = await generateActivitySuggestions({ activityName, vertical, maximumPoints });
    return sendSuccess(res, 200, 'Activity suggestions generated', suggestions);
  } catch (error) {
    next(error);
  }
};

const getAtRisk = async (req, res, next) => {
  try {
    const result = await getAtRiskStudents(scopeFrom(req));
    return sendSuccess(res, 200, 'At-risk students computed', result);
  } catch (error) {
    next(error);
  }
};

const notifyAtRisk = async (req, res, next) => {
  try {
    const result = await notifyAtRiskStudents(scopeFrom(req));
    return sendSuccess(res, 200, 'At-risk notifications sent', result);
  } catch (error) {
    next(error);
  }
};

const getTrends = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months, 10) || 6;
    const result = await getTrendAnalytics({ ...scopeFrom(req), months });
    return sendSuccess(res, 200, 'Trend analytics generated', result);
  } catch (error) {
    next(error);
  }
};

const getDuplicates = async (req, res, next) => {
  try {
    const result = await listFlaggedDuplicates({ limit: parseInt(req.query.limit, 10) || 50 });
    return sendSuccess(res, 200, 'Flagged duplicate submissions', result);
  } catch (error) {
    next(error);
  }
};

const previewDigest = async (req, res, next) => {
  try {
    const { studentId } = req.body || {};
    const student = studentId
      ? await User.findById(studentId)
      : await User.findOne({ role: 'student', status: 'Active' }).select('_id');
    if (!student) return sendError(res, 404, 'No student found to generate a preview');
    const digest = await buildDigestForStudent(student._id);
    if (!digest) return sendError(res, 404, 'Student not found');
    return sendSuccess(res, 200, 'Digest preview generated', digest);
  } catch (error) {
    next(error);
  }
};

const sendDigest = async (req, res, next) => {
  try {
    const result = await sendWeeklyDigest(scopeFrom(req));
    return sendSuccess(res, 200, 'Weekly digest sent', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  suggestActivity,
  getAtRisk,
  notifyAtRisk,
  getTrends,
  getDuplicates,
  previewDigest,
  sendDigest,
};