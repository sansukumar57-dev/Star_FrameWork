const { broadcastDeadlineAlerts, buildAlertPlan } = require('../services/deadlineBroadcastService');
const { sendSuccess, sendError } = require('../utils/response');

const broadcastDeadlineNotifications = async (req, res, next) => {
  try {
    const windowDays = Math.max(1, parseInt(req.body.windowDays || req.query.windowDays || '7', 10) || 7);
    const result = await broadcastDeadlineAlerts({ windowDays });
    return sendSuccess(res, 200, 'Deadline notifications broadcast', result);
  } catch (error) {
    next(error);
  }
};

const previewDeadlineNotifications = async (req, res, next) => {
  try {
    const windowDays = Math.max(1, parseInt(req.query.windowDays || '7', 10) || 7);
    const plan = await buildAlertPlan(windowDays);
    const summary = plan.map(({ activity, daysLeft, priority }) => ({
      activityId: activity._id,
      activityName: activity.activityName,
      vertical: activity.vertical || '',
      maximumPoints: activity.maximumPoints || 0,
      deadline: activity.deadline,
      daysLeft,
      priority: priority.label,
      important: Boolean(activity.important),
    }));
    return sendSuccess(res, 200, 'Deadline alert preview', { windowDays, items: summary });
  } catch (error) {
    next(error);
  }
};

module.exports = { broadcastDeadlineNotifications, previewDeadlineNotifications };