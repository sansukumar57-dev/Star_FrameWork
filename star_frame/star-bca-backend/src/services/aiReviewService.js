const Submission = require('../models/Submission');
const Activity = require('../models/Activity');
const { calculateSubmissionScore } = require('../utils/scoringEngine');
const { complete, getProvider } = require('./llmService');

function clampPoints(value, maxPoints) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(Math.round(parsed), maxPoints));
}

function normalizeRecommendation(value) {
  const key = String(value || '').toLowerCase();
  if (key.startsWith('approv')) return 'Approve';
  if (key.startsWith('reject')) return 'Reject';
  return 'Review';
}

function buildPrompt(activity, submission) {
  const levels = Array.isArray(activity?.levels) && activity.levels.length
    ? activity.levels.map((level) => `${level.label} = ${level.points} SP`).join(', ')
    : 'None defined';

  const evidence = submission?.certificateFile
    ? {
        fileName: submission.certificateFile.fileName || '',
        contentType: submission.certificateFile.contentType || '',
        size: submission.certificateFile.size || 0,
      }
    : null;

  return {
    activity: {
      name: activity?.activityName || '',
      vertical: activity?.vertical || '',
      maximumPoints: Number(activity?.maximumPoints || 0),
      description: activity?.description || '',
      levels,
    },
    submission: {
      activityType: submission?.activityType || '',
      visitType: submission?.visitType || '',
      durationWeeks: submission?.durationWeeks || '',
      selectedLevel: submission?.selectedLevel || '',
      projectUrl: submission?.projectUrl || submission?.proofUrl || '',
      description: submission?.description || '',
      evidence,
    },
  };
}

const SYSTEM_PROMPT = `You are the AI evidence reviewer for the STARS framework at KPR College (Student Activity Reward Points System).

Review each student activity submission and decide whether the provided evidence supports the claim. Evaluate:
- Does the description match the activity and its type?
- Does the stated level match what is claimed?
- Is the proof URL or certificate plausible and relevant?
- Should the submission be approved, rejected, or manually reviewed?

Return STRICT JSON only, with exactly this shape:
{
  "recommendation": "Approve" | "Reject" | "Review",
  "suggestedPoints": <integer between 0 and maximumPoints>,
  "confidence": <integer 0-100>,
  "reasoning": "<2-3 sentence explanation>",
  "flags": ["<concern or note>"]
}`;

async function runLlmReview(activity, submission) {
  const data = buildPrompt(activity, submission);
  const image = submission?.certificateFile;

  const result = await complete({
    system: SYSTEM_PROMPT,
    user: `Review this STAR framework submission as JSON:\n${JSON.stringify(data, null, 2)}`,
    image: image?.data
      ? { data: image.data, contentType: image.contentType || 'application/octet-stream' }
      : null,
    json: true,
    temperature: 0.2,
    maxTokens: 2048,
    timeoutMs: 30000,
    retries: 1,
  });

  return {
    ...result.parsed,
    provider: result.provider,
    model: result.model,
  };
}

function ruleBasedReview(activity, submission) {
  const calculated = calculateSubmissionScore(activity, submission);
  const description = String(submission?.description || '').trim();
  const proofUrl = String(submission?.projectUrl || submission?.proofUrl || '').trim();
  const hasFile = Boolean(submission?.certificateFile);
  const hasLevel = Boolean(String(submission?.selectedLevel || '').trim());

  const flags = [];
  let recommendation = 'Approve';
  let confidence = 62;

  if (!description && !proofUrl && !hasFile) {
    recommendation = 'Reject';
    confidence = 80;
    flags.push('No description, proof URL, or certificate provided');
  }

  if (hasLevel) {
    const levels = Array.isArray(activity?.levels) ? activity.levels : [];
    const match = levels.find((level) => String(level.label).toLowerCase() === String(submission.selectedLevel).toLowerCase());
    if (!match && levels.length > 0) {
      if (recommendation !== 'Reject') recommendation = 'Review';
      flags.push(`Selected level "${submission.selectedLevel}" is not listed for this activity`);
    }
  } else if (Array.isArray(activity?.levels) && activity.levels.length > 0) {
    if (recommendation !== 'Reject') recommendation = 'Review';
    flags.push('No certification level selected for a leveled activity');
  }

  if (!proofUrl && !hasFile) {
    flags.push('No proof URL or certificate attached');
    if (recommendation !== 'Reject') recommendation = 'Review';
  }

  if (!description) {
    flags.push('Submission has no student description');
  }

  if (recommendation === 'Approve' && flags.length > 1) recommendation = 'Review';

  return {
    recommendation,
    suggestedPoints: calculated.suggestedPoints,
    confidence,
    reasoning: recommendation === 'Reject'
      ? 'Evidence is missing or insufficient to support this claim.'
      : `Rule-based analysis suggests ${calculated.suggestedPoints} SP. ${flags.join(' ') || 'Evidence appears consistent with the activity.'}`,
    flags,
    provider: 'rule-engine',
    model: 'rule-based-fallback',
  };
}

async function reviewSubmission(submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw new Error('Submission not found');

  const activity = await Activity.findById(submission.activityId);
  if (!activity) throw new Error('Activity not found');

  const maxPoints = Number(activity.maximumPoints || 0);
  const provider = getProvider();

  let review;
  let fallbackReason = '';
  if (provider) {
    try {
      review = await runLlmReview(activity, submission);
    } catch (error) {
      fallbackReason = error.message;
      console.error('[AI] review failed, falling back to rule engine:', error.message);
    }
  }

  if (!review) {
    review = ruleBasedReview(activity, submission);
  }

  const flags = Array.isArray(review.flags) ? review.flags.map((flag) => String(flag).slice(0, 300)) : [];
  if (fallbackReason) flags.unshift(fallbackReason);

  const normalized = {
    provider: review.provider || 'rule-engine',
    model: review.model || 'unknown',
    recommendation: normalizeRecommendation(review.recommendation),
    suggestedPoints: clampPoints(review.suggestedPoints, maxPoints),
    confidence: clampPoints(review.confidence, 100),
    reasoning: String(review.reasoning || '').slice(0, 2000),
    flags,
    reviewedAt: new Date(),
  };

  await Submission.findByIdAndUpdate(submissionId, { $set: { aiReview: normalized } });

  return normalized;
}

module.exports = { reviewSubmission, getProvider, ruleBasedReview };
