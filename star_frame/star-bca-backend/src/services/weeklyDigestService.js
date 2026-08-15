const User = require('../models/User');
const Submission = require('../models/Submission');
const { complete, getProvider } = require('./llmService');
const emailService = require('./emailService');
const { EARNED_STATUSES } = require('../utils/approvalStatuses');

const DIGEST_SYSTEM_PROMPT = `You are an encouraging AI coach for the STARS framework at KPR College. Write a warm, natural-language weekly progress summary (5-6 sentences) for a student. Reference their actual numbers from the supplied week context: points earned, approved submissions, pending reviews, streaks, and any deadlines. End with one concrete action. Do not invent facts.`;

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

function formatWeekRange(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-IN', opts)} – ${end.toLocaleDateString('en-IN', opts)}`;
}

async function buildDigestForStudent(studentId, { weekStart = startOfWeek() } = {}) {
  const student = await User.findById(studentId).select('name email department totalPoints currentStreak longestStreak').lean();
  if (!student) return null;

  const submissions = await Submission.find({ studentId, submittedAt: { $gte: weekStart } })
    .populate('activityId', 'activityName vertical maximumPoints deadline')
    .lean();

  const stats = { approved: 0, pending: 0, rejected: 0, points: 0 };
  for (const submission of submissions) {
    if (EARNED_STATUSES.includes(submission.status)) {
      stats.approved += 1;
      stats.points += submission.pointsAwarded || 0;
    } else if (submission.status === 'Pending') {
      stats.pending += 1;
    } else if (submission.status === 'Rejected' || submission.status === 'HODRejected') {
      stats.rejected += 1;
    }
  }

  const topActivity = submissions
    .filter((submission) => EARNED_STATUSES.includes(submission.status))
    .sort((a, b) => (b.pointsAwarded || 0) - (a.pointsAwarded || 0))[0]?.activityId;

  const upcoming = submissions
    .map((submission) => submission.activityId)
    .filter((activity) => activity?.deadline && new Date(activity.deadline) >= new Date())
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];

  const context = {
    studentName: student.name,
    weekRange: formatWeekRange(weekStart),
    stats,
    currentStreak: student.currentStreak || 0,
    longestStreak: student.longestStreak || 0,
    totalPoints: student.totalPoints || 0,
    topActivityName: topActivity?.activityName || '',
    nearestDeadline: upcoming ? { name: upcoming.activityName, date: new Date(upcoming.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) } : null,
  };

  const text = await generateDigestText(context);
  return { student, context, text };
}

function ruleBasedDigest(context) {
  const { studentName, stats, currentStreak, topActivityName, nearestDeadline } = context;
  const parts = [];
  parts.push(`Hi ${studentName || 'there'}, here is your STAR progress for ${context.weekRange}.`);
  if (stats.points > 0) {
    parts.push(`You earned ${stats.points} STAR points across ${stats.approved} approved submission${stats.approved === 1 ? '' : 's'}${topActivityName ? ` — your top one was "${topActivityName}"` : ''}.`);
  } else if (stats.approved === 0 && stats.pending === 0) {
    parts.push(`You did not submit any activities this week, so there were no new points earned.`);
  } else {
    parts.push(`No points were awarded yet this week — ${stats.pending} submission${stats.pending === 1 ? ' is' : 's are'} still waiting for faculty review.`);
  }
  if (currentStreak >= 2) parts.push(`You are on a ${currentStreak}-day active streak — keep it going!`);
  if (nearestDeadline) parts.push(`Don't forget: "${nearestDeadline.name}" is due on ${nearestDeadline.date}.`);
  parts.push(`Small, consistent submissions are the best way to grow your STAR profile.`);
  return parts.join(' ');
}

async function generateDigestText(context) {
  const provider = getProvider();
  if (!provider) return ruleBasedDigest(context);
  try {
    const result = await complete({
      system: DIGEST_SYSTEM_PROMPT,
      user: `Weekly context:\n${JSON.stringify(context, null, 2)}`,
      temperature: 0.5,
      maxTokens: 500,
      timeoutMs: 25000,
      retries: 1,
    });
    const text = String(result.text || '').trim();
    return text || ruleBasedDigest(context);
  } catch (error) {
    console.error('[AI] digest generation failed, using fallback:', error.message);
    return ruleBasedDigest(context);
  }
}

async function sendWeeklyDigest({ scopedSchoolId = null, scopedDepartmentId = null, onlyIfPoints = false } = {}) {
  const studentQuery = { role: 'student', status: { $ne: 'Inactive' }, email: { $ne: null, $ne: '' } };
  if (scopedSchoolId) studentQuery.schoolId = scopedSchoolId;
  if (scopedDepartmentId) studentQuery.departmentId = scopedDepartmentId;

  const students = await User.find(studentQuery).select('_id').lean();
  let sent = 0;
  let skipped = 0;
  const errors = [];

  for (const student of students) {
    try {
      const digest = await buildDigestForStudent(student._id);
      if (!digest) { skipped += 1; continue; }
      if (onlyIfPoints && digest.context.stats.points === 0) { skipped += 1; continue; }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e2e2e2; border-radius: 8px; overflow: hidden;">
          <div style="background: #1a1a1a; color: #fff; padding: 16px 24px;"><strong>STARS-BCA</strong> · Weekly Progress Digest</div>
          <div style="padding: 24px; font-size: 15px; line-height: 1.6;">
            <p>${digest.text.replace(/</g, '&lt;')}</p>
            <p style="margin-top: 20px;"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/student/dashboard" style="color: #1a73e8;">Open your STAR dashboard</a></p>
            <p style="color: #888; font-size: 12px; margin-top: 24px;">KPR College of Arts and Science, Coimbatore</p>
          </div>
        </div>`;
      await emailService.sendMail({ to: digest.student.email, subject: `Your STAR progress — week of ${digest.context.weekRange}`, html });
      sent += 1;
    } catch (error) {
      errors.push({ studentId: student._id, error: error.message });
    }
  }

  return { sent, skipped, errors: errors.length, emailConfigured: emailService.isConfigured(), generatedAt: new Date() };
}

module.exports = { buildDigestForStudent, generateDigestText, ruleBasedDigest, sendWeeklyDigest, startOfWeek };