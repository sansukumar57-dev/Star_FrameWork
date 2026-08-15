const Activity = require('../models/Activity');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Notification = require('../models/Notification');

const DAY_MS = 86400000;

const PRIORITY = {
  overdue: { rank: 3, label: 'Overdue' },
  urgent: { rank: 2, label: 'Important' },
  warning: { rank: 1, label: 'Upcoming' },
};

function classify(daysLeft, important) {
  if (daysLeft < 0) return PRIORITY.overdue;
  if (daysLeft === 0) return PRIORITY.urgent;
  if (important || daysLeft <= 2) return PRIORITY.urgent;
  return PRIORITY.warning;
}

async function fetchUpcomingActivities(windowDays) {
  const from = Date.now() - DAY_MS;
  const to = Date.now() + windowDays * DAY_MS;
  return Activity.find({ deadline: { $ne: null, $gte: new Date(from), $lte: new Date(to) } })
    .select('activityName vertical maximumPoints important deadline')
    .lean();
}

async function buildAlertPlan(windowDays) {
  const now = Date.now();
  const activities = await fetchUpcomingActivities(windowDays);

  const plan = [];
  for (const activity of activities) {
    const deadlineMs = new Date(activity.deadline).getTime();
    const daysLeft = Math.ceil((deadlineMs - now) / DAY_MS);
    const priority = classify(daysLeft, Boolean(activity.important));
    plan.push({ activity, daysLeft, priority });
  }

  plan.sort((a, b) => b.priority.rank - a.priority.rank || a.deadline - b.deadline || a.activity.deadline - b.activity.deadline);
  return plan;
}

/**
 * Create (or refresh) priority deadline notifications for every active student
 * who has not yet earned approval for the activity. Existing notifications are
 * refreshed in place so that a single source of truth is kept per student.
 */
async function broadcastDeadlineAlerts({ windowDays = 7, onlyIfEmpty = false, scopedSchoolId = null, scopedDepartmentId = null } = {}) {
  const plan = await buildAlertPlan(windowDays);

  const studentQuery = { role: 'student', status: { $ne: 'Inactive' } };
  if (scopedSchoolId) studentQuery.schoolId = scopedSchoolId;
  if (scopedDepartmentId) studentQuery.departmentId = scopedDepartmentId;
  const students = await User.find(studentQuery).select('_id').lean();

  const activityIds = plan.map((entry) => entry.activity._id);
  const approved = await Submission.find({ status: 'Approved', activityId: { $in: activityIds } })
    .select('studentId activityId')
    .lean();

  const completedMap = new Map();
  for (const submission of approved) {
    const key = `${String(submission.studentId)}::${String(submission.activityId)}`;
    completedMap.set(key, true);
  }

  const created = { overdue: 0, urgent: 0, warning: 0 };
  let refreshed = 0;

  for (const entry of plan) {
    const { activity, daysLeft, priority } = entry;
    const activityId = String(activity._id);

    for (const student of students) {
      const key = `${String(student._id)}::${activityId}`;
      if (completedMap.has(key)) continue;

      const message = priority.rank === PRIORITY.overdue.rank
        ? `The upload deadline for "${activity.activityName}" passed on ${new Date(activity.deadline).toLocaleDateString()}. Submit evidence to earn up to ${activity.maximumPoints || 0} points.`
        : `Due ${new Date(activity.deadline).toLocaleDateString()} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left) — earn up to ${activity.maximumPoints || 0} points.`;

      const title = `${priority.label}: ${activity.activityName}`;

      const existing = await Notification.findOneAndUpdate(
        { userId: student._id, type: 'deadline', link: activityId },
        { $set: { title, message } },
        { new: true }
      ).lean();

      if (existing) {
        refreshed += 1;
      } else {
        try {
          await Notification.create({
            userId: student._id,
            type: 'deadline',
            title,
            message,
            link: activityId,
          });
          created[priority.label.toLowerCase()] += 1;
        } catch (error) {
          console.error(`[broadcast] failed to create deadline notification for student ${student._id}:`, error.message);
        }
      }
    }
  }

  return {
    windowDays,
    activitiesScanned: activityIds.length,
    studentsNotified: students.length,
    created,
    refreshed,
    total: created.overdue + created.urgent + created.warning + refreshed,
  };
}

module.exports = { broadcastDeadlineAlerts, buildAlertPlan, PRIORITY, classify };