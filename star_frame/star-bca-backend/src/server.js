const app = require('./app');
const { broadcastDeadlineAlerts } = require('./services/deadlineBroadcastService');
const { sendWeeklyDigest } = require('./services/weeklyDigestService');
const { notifyAtRiskStudents } = require('./services/atRiskService');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const BROADCAST_INTERVAL_MS = Math.max(60 * 60 * 1000, parseInt(process.env.DEADLINE_BROADCAST_INTERVAL_MS || (6 * 60 * 60 * 1000), 10) || 6 * 60 * 60 * 1000);
const BROADCAST_WINDOW_DAYS = Math.max(1, parseInt(process.env.DEADLINE_BROADCAST_WINDOW_DAYS || '7', 10) || 7);

async function runDeadlineBroadcast() {
  if (process.env.DEADLINE_BROADCAST_ENABLED === 'false') return;
  try {
    const result = await broadcastDeadlineAlerts({ windowDays: BROADCAST_WINDOW_DAYS });
    console.log(`[scheduler] deadline broadcast complete: ${result.total} notifications (${result.created.overdue} overdue, ${result.created.urgent} urgent, ${result.created.warning} upcoming, ${result.refreshed} refreshed)`);
  } catch (error) {
    console.error('[scheduler] deadline broadcast failed:', error.message);
  }
}

const BROADCAST_JOB_DELAY_MS = Math.min(60 * 1000, BROADCAST_INTERVAL_MS / 2);

setTimeout(() => {
  runDeadlineBroadcast();
  setInterval(runDeadlineBroadcast, BROADCAST_INTERVAL_MS);
}, BROADCAST_JOB_DELAY_MS);

// ---- Weekly digest + at-risk notifier -------------------------------------
const DIGEST_DAY = Number(process.env.WEEKLY_DIGEST_DAY ?? 0); // 0 = Sunday
const DIGEST_HOUR = Number(process.env.WEEKLY_DIGEST_HOUR ?? 9);
const DIGEST_ENABLED = process.env.WEEKLY_DIGEST_ENABLED !== 'false';
const AT_RISK_ENABLED = process.env.AT_RISK_NOTIFY_ENABLED !== 'false';

const dailyJobs = new Map();
const DAILY_CHECK_MS = 30 * 60 * 1000;

function shouldRunToday(key, dayOfWeek, hour) {
  const now = new Date();
  if (now.getDay() !== dayOfWeek || now.getHours() !== hour) return false;
  const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  if (dailyJobs.get(key) === dateKey) return false;
  dailyJobs.set(key, dateKey);
  return true;
}

async function runWeeklyDigest() {
  if (!DIGEST_ENABLED) return;
  if (!shouldRunToday('digest', DIGEST_DAY, DIGEST_HOUR)) return;
  try {
    const result = await sendWeeklyDigest();
    console.log(`[scheduler] weekly digest complete: ${result.sent} sent, ${result.skipped} skipped, email configured: ${result.emailConfigured}`);
  } catch (error) {
    console.error('[scheduler] weekly digest failed:', error.message);
  }
}

async function runAtRiskNotify() {
  if (!AT_RISK_ENABLED) return;
  if (!shouldRunToday('at-risk', DIGEST_DAY, DIGEST_HOUR)) return;
  try {
    const result = await notifyAtRiskStudents();
    console.log(`[scheduler] at-risk notify complete: ${result.targets} students flagged, ${result.studentNotified} notified, ${result.facultyNotified} faculty notified`);
  } catch (error) {
    console.error('[scheduler] at-risk notify failed:', error.message);
  }
}

setTimeout(() => {
  runWeeklyDigest();
  runAtRiskNotify();
  setInterval(() => {
    runWeeklyDigest();
    runAtRiskNotify();
  }, DAILY_CHECK_MS);
}, BROADCAST_JOB_DELAY_MS + 5 * 1000);