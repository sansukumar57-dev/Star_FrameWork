const { User, Submission, Activity } = require('../models');
const { complete, getProvider, providerLabel } = require('./llmService');
const { EARNED_STATUSES } = require('../utils/approvalStatuses');

const COACH_SYSTEM_PROMPT = `You are the AI coach for the STARS framework at KPR College (Student Activity Reward Points System).

A student's progress context is provided. Generate an encouraging, practical coaching response in strict JSON with this shape:
{
  "summary": "<2-3 sentence overview of how the student is doing>",
  "highlights": ["<2-3 strengths or positive facts>"],
  "weakVerticals": ["<verticals needing the most attention>"],
  "nextSteps": ["<2-3 concrete actions for the student>"],
  "suggestedActivities": [{"name": "<activity>", "vertical": "<vertical>", "reason": "<why this is a good next activity>"}]
}

Be specific using the supplied data (points, streaks, pending submissions, weak verticals, upcoming activities). Do not invent activities that are not listed.`;

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

async function buildCoachContext(studentId) {
  const student = await User.findById(studentId).select('name department year batch currentStreak longestStreak academicYear');
  if (!student) return null;

  const [submissions, activities] = await Promise.all([
    Submission.find({ studentId }).populate('activityId', 'activityName vertical maximumPoints'),
    Activity.find({}).select('activityName vertical maximumPoints deadline').sort({ deadline: 1 }).lean(),
  ]);

  const byVertical = {};
  let totalPoints = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  const submittedActivityIds = new Set();

  for (const sub of submissions) {
    const vertical = sub.activityId?.vertical || 'Unknown';
    byVertical[vertical] = byVertical[vertical] || { submitted: 0, points: 0 };
    byVertical[vertical].submitted += 1;
    submittedActivityIds.add(String(sub.activityId?._id || ''));

    if (EARNED_STATUSES.includes(sub.status)) {
      totalPoints += sub.pointsAwarded || 0;
      approvedCount += 1;
      byVertical[vertical].points += sub.pointsAwarded || 0;
    } else if (sub.status === 'Pending') {
      pendingCount += 1;
    } else if (sub.status === 'Rejected' || sub.status === 'HODRejected') {
      rejectedCount += 1;
    }
  }

  const verticalSummary = Object.entries(byVertical).map(([name, value]) => ({
    vertical: name,
    ...value,
  }));

  const suggestedActivities = activities
    .filter((activity) => !submittedActivityIds.has(String(activity._id)))
    .slice(0, 5)
    .map((activity) => ({
      name: activity.activityName,
      vertical: activity.vertical,
      maximumPoints: activity.maximumPoints,
      deadline: activity.deadline || null,
    }));

  return {
    studentName: student.name,
    academicYear: student.academicYear || '',
    totalPoints,
    approvedSubmissions: approvedCount,
    pendingSubmissions: pendingCount,
    rejectedSubmissions: rejectedCount,
    currentStreak: student.currentStreak || 0,
    longestStreak: student.longestStreak || 0,
    verticalSummary,
    suggestedActivities,
  };
}

function ruleBasedInsights(context) {
  const {
    studentName, totalPoints, approvedSubmissions, pendingSubmissions,
    rejectedSubmissions, currentStreak, longestStreak, verticalSummary, suggestedActivities,
  } = context;

  const highlights = [];
  const weakVerticals = [];
  const nextSteps = [];

  highlights.push(`${totalPoints} total STAR points across ${approvedSubmissions} approved submission${approvedSubmissions === 1 ? '' : 's'}.`);
  if (currentStreak >= 2) highlights.push(`${currentStreak}-day active streak (best ${longestStreak} days).`);
  if (pendingSubmissions > 0) highlights.push(`${pendingSubmissions} submission${pendingSubmissions === 1 ? '' : 's'} awaiting review.`);

  if (verticalSummary.length) {
    const sorted = [...verticalSummary].sort((a, b) => a.points - b.points);
    weakVerticals.push(...sorted.slice(0, 2).map((entry) => entry.vertical));
    if (weakVerticals.length) {
      nextSteps.push(`Focus on ${weakVerticals.join(' and ')} — your lowest-scoring vertical${weakVerticals.length > 1 ? 's' : ''}.`);
    }
  }

  if (pendingSubmissions > 0) {
    nextSteps.push('Check your pending submissions and respond quickly if faculty asks for more evidence.');
  } else if (rejectedSubmissions > 0) {
    nextSteps.push('Read the feedback on rejected submissions and improve your evidence before resubmitting.');
  }

  const upcoming = suggestedActivities.filter((activity) => activity.deadline);
  const topSuggestion = suggestedActivities[0];
  if (topSuggestion) {
    nextSteps.push(`Next challenge: "${topSuggestion.name}" (${topSuggestion.vertical}, up to ${topSuggestion.maximumPoints} SP).`);
  }
  if (upcoming.length) {
    const nearest = upcoming[0];
    nextSteps.push(`Don't miss the "${nearest.name}" deadline on ${formatDate(nearest.deadline)}.`);
  }

  if (!nextSteps.length) {
    nextSteps.push('Explore the activity catalog and pick a new challenge to grow your STAR profile.');
  }

  const summary = `${studentName || 'You'} have earned ${totalPoints} STAR points so far. ${currentStreak >= 2 ? `Keep it up — you are on a ${currentStreak}-day streak. ` : ''}Small consistent submissions will keep your points growing.`;

  return {
    summary,
    highlights,
    weakVerticals,
    nextSteps,
    suggestedActivities: suggestedActivities.slice(0, 3).map((activity) => ({
      name: activity.name,
      vertical: activity.vertical,
      reason: activity.deadline
        ? `Open until ${formatDate(activity.deadline)}`
        : 'Available now',
    })),
    provider: 'rule-engine',
    model: 'rule-based-fallback',
  };
}

function sanitizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '')).filter(Boolean).slice(0, 5);
}

async function getCoachInsights(studentId) {
  const context = await buildCoachContext(studentId);
  if (!context) return null;

  const provider = getProvider();
  if (!provider) return ruleBasedInsights(context);

  try {
    const result = await complete({
      system: COACH_SYSTEM_PROMPT,
      user: `Generate personalized coaching for this student:\n${JSON.stringify(context, null, 2)}`,
      json: true,
      temperature: 0.4,
      maxTokens: 1024,
      timeoutMs: 25000,
      retries: 1,
    });

    const parsed = result.parsed;
    const fallback = ruleBasedInsights(context);

    return {
      summary: String(parsed.summary || fallback.summary || '').slice(0, 800),
      highlights: sanitizeArray(parsed.highlights),
      weakVerticals: sanitizeArray(parsed.weakVerticals),
      nextSteps: sanitizeArray(parsed.nextSteps),
      suggestedActivities: Array.isArray(parsed.suggestedActivities)
        ? parsed.suggestedActivities.slice(0, 3).map((entry) => ({
            name: String(entry?.name || '').slice(0, 200),
            vertical: String(entry?.vertical || '').slice(0, 100),
            reason: String(entry?.reason || '').slice(0, 300),
          })).filter((entry) => entry.name)
        : fallback.suggestedActivities,
      provider: result.provider,
      model: result.model,
    };
  } catch (error) {
    console.error('[AI] coach insights failed, using fallback:', error.message);
    return ruleBasedInsights(context);
  }
}

module.exports = { getCoachInsights, ruleBasedInsights, buildCoachContext, providerLabel };