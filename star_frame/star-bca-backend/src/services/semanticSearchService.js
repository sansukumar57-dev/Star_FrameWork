const Activity = require('../models/Activity');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { complete, getProvider } = require('./llmService');

const PARSE_SYSTEM_PROMPT = `You are a search query parser for a college STAR (Student Activity Reward Points) system. Parse the user's natural language query into filters. Reply in strict JSON with this shape (use null when unknown):
{
  "keywords": ["<single words or short phrases to match against activity names/descriptions>"],
  "vertical": "<vertical name, e.g. Sports, Technical, Cultural, or null>",
  "activityType": "<internship | case-study | mini-project | industrial-visit | certificate-course | other | null>",
  "status": "<Approved | Pending | Rejected | null>",
  "from": "<YYYY-MM-DD or null>",
  "to": "<YYYY-MM-DD or null>",
  "year": "<4-digit year or null>"
}`;

const STATUS_ALIASES = { approved: 'Approved', accepted: 'Approved', pending: 'Pending', rejected: 'Rejected', 'under review': 'Pending' };
const TYPE_ALIASES = { internship: 'internship', intern: 'internship', 'case study': 'case-study', 'mini project': 'mini-project', 'mini-project': 'mini-project', 'industrial visit': 'industrial-visit', 'institutional visit': 'institutional-visit', 'certificate course': 'certificate-course', 'certification course': 'certificate-course' };
const KNOWN_VERTICALS = ['Academic', 'Sports', 'Technical', 'Cultural', 'Creative', 'Social', 'Leadership', 'Entrepreneurship'];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ruleBasedParse(rawQuery) {
  const query = String(rawQuery || '');
  const lower = query.toLowerCase();
  const parsed = { keywords: [], vertical: null, activityType: null, status: null, from: null, to: null, year: null };

  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (yearMatch) parsed.year = yearMatch[1];

  for (const alias of Object.keys(STATUS_ALIASES)) {
    if (lower.includes(alias)) { parsed.status = STATUS_ALIASES[alias]; break; }
  }
  for (const alias of Object.keys(TYPE_ALIASES)) {
    if (lower.includes(alias)) { parsed.activityType = TYPE_ALIASES[alias]; break; }
  }
  for (const vertical of KNOWN_VERTICALS) {
    if (lower.includes(vertical.toLowerCase())) { parsed.vertical = vertical; break; }
  }
  if (lower.includes('last year')) parsed.year = String(new Date().getFullYear() - 1);
  if (lower.includes('last month')) parsed.from = startOfLastMonth();

  const stopwords = new Set(['the', 'a', 'an', 'from', 'for', 'and', 'or', 'of', 'in', 'on', 'at', 'with', 'to', 'certificates', 'certificate', 'activities', 'activity', 'submissions', 'submission', 'last', 'year', 'month', 'week', 'show', 'list', 'get', 'find', 'all', 'my', 'for']);
  parsed.keywords = query.split(/\s+/).map((word) => word.replace(/[^a-zA-Z0-9-]/g, '')).filter((word) => word && !stopwords.has(word.toLowerCase())).slice(0, 6);

  return parsed;
}

function startOfLastMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

async function parseQuery(rawQuery) {
  const rule = ruleBasedParse(rawQuery);
  const provider = getProvider();
  if (!provider) return rule;
  try {
    const result = await complete({
      system: PARSE_SYSTEM_PROMPT,
      user: `User query: "${rawQuery}"`,
      json: true,
      temperature: 0,
      maxTokens: 300,
      timeoutMs: 15000,
      retries: 1,
    });
    const parsed = result.parsed;
    if (!parsed || !Array.isArray(parsed.keywords)) return rule;
    const keywords = Array.from(new Set([...rule.keywords, ...parsed.keywords.slice(0, 6).map(String)]));
    return {
      keywords: keywords.slice(0, 8),
      vertical: parsed.vertical || rule.vertical,
      activityType: parsed.activityType || rule.activityType,
      status: parsed.status || rule.status,
      from: parsed.from || rule.from,
      to: parsed.to || rule.to,
      year: parsed.year || rule.year,
    };
  } catch (error) {
    console.error('[AI] query parse failed, using fallback:', error.message);
    return rule;
  }
}

function buildActivityQuery(parsed) {
  const query = {};
  if (parsed.keywords.length) {
    const pattern = parsed.keywords.map(escapeRegex).join('|');
    query.$or = [
      { activityName: { $regex: pattern, $options: 'i' } },
      { description: { $regex: pattern, $options: 'i' } },
    ];
  }
  if (parsed.vertical) query.vertical = { $regex: new RegExp(escapeRegex(parsed.vertical), 'i') };
  return query;
}

// Map a parsed (possibly informal) vertical label onto a real vertical stored in
// the DB. Unknown labels (e.g. "Technical") are dropped instead of filtering out
// every result.
function normalizeVertical(parsedVertical, realVerticals) {
  if (!parsedVertical) return null;
  const parsedLabel = String(parsedVertical).toLowerCase();
  for (const real of realVerticals) {
    const realLabel = String(real).toLowerCase();
    if (realLabel.includes(parsedLabel) || parsedLabel.includes(realLabel)) return real;
  }
  return null;
}

async function semanticSearch({ query, scopedSchoolId = null, scopedDepartmentId = null, limit = 10 } = {}) {
  const parsed = await parseQuery(query);
  const realVerticals = await Activity.distinct('vertical').lean();
  parsed.vertical = normalizeVertical(parsed.vertical, realVerticals);

  const activityQuery = buildActivityQuery(parsed);
  const activities = await Activity.find(activityQuery)
    .select('activityName vertical maximumPoints description deadline')
    .sort({ deadline: 1 })
    .limit(Number(limit) || 10)
    .lean();

  const submissionQuery = {};
  if (parsed.status) submissionQuery.status = parsed.status;
  if (parsed.from || parsed.to) {
    submissionQuery.submittedAt = {};
    if (parsed.from) submissionQuery.submittedAt.$gte = new Date(parsed.from);
    if (parsed.to) submissionQuery.submittedAt.$lte = new Date(`${parsed.to}T23:59:59`);
  }
  if (parsed.year) {
    submissionQuery.submittedAt = { $gte: new Date(`${parsed.year}-01-01`), $lte: new Date(`${parsed.year}-12-31T23:59:59`) };
  }

  const students = await User.find(
    { role: 'student', ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}), ...(scopedDepartmentId ? { departmentId: scopedDepartmentId } : {}) }
  ).select('_id').lean();
  submissionQuery.studentId = { $in: students.map((student) => student._id) };

  let submissions = await Submission.find(submissionQuery)
    .populate('activityId', 'activityName vertical maximumPoints')
    .sort({ submittedAt: -1 })
    .limit(Number(limit) || 10)
    .lean();

  if (parsed.keywords.length) {
    const lowerKeywords = parsed.keywords.map((keyword) => keyword.toLowerCase());
    submissions = submissions.filter((submission) => {
      const name = String(submission.activityId?.activityName || '').toLowerCase();
      return lowerKeywords.some((keyword) => name.includes(keyword));
    });
  }

  const ranked = submissions.map((submission) => ({
    id: submission._id,
    activityName: submission.activityId?.activityName || '',
    vertical: submission.activityId?.vertical || '',
    status: submission.status,
    pointsAwarded: submission.pointsAwarded || 0,
    submittedAt: submission.submittedAt,
  }));

  return {
    query: String(query || ''),
    parsed,
    activities: activities.map((activity) => ({
      id: activity._id,
      name: activity.activityName,
      vertical: activity.vertical,
      maximumPoints: activity.maximumPoints,
      deadline: activity.deadline,
    })),
    submissions: ranked,
  };
}

module.exports = { semanticSearch, parseQuery, ruleBasedParse };