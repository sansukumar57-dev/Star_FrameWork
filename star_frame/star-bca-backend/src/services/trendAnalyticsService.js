const Submission = require('../models/Submission');
const User = require('../models/User');
const { complete, getProvider } = require('./llmService');

const NARRATIVE_SYSTEM_PROMPT = `You are an academic analytics assistant for a college principal. Given monthly STAR points trend data, write a 3-4 sentence narrative: describe the overall direction, the strongest and weakest months, any spikes or slumps, and the projected next month. Be specific with the numbers. Do not invent data outside the provided series.`;

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastMonths(count, now = new Date()) {
  const months = [];
  const cursor = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const copy = new Date(cursor);
    copy.setUTCMonth(copy.getUTCMonth() - i);
    months.push({ key: monthKey(copy), label: copy.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }), start: copy });
  }
  return months;
}

// Simple least-squares linear regression on {x, y} points; returns slope, intercept, and next forecast.
function linearForecast(points) {
  if (points.length < 2) return { slope: 0, intercept: points[0]?.y || 0, next: points[0]?.y || 0 };
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const denominator = n * sumX2 - sumX * sumX || 1;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const next = Math.max(0, Math.round(slope * n + intercept));
  return { slope, intercept, next };
}

function ruleBasedNarrative(series, forecast, best, weakest) {
  const deltas = [];
  for (let i = 1; i < series.length; i += 1) deltas.push(series[i].points - series[i - 1].points);
  const trendUp = series.length >= 2 && series[series.length - 1].points >= series[0].points;

  let text = `Over the past ${series.length} months, STAR point accumulation has ${trendUp ? 'been on an upward trajectory' : 'been relatively flat or declining'}, totaling ${series.reduce((sum, m) => sum + m.points, 0)} points.`;
  if (best) text += ` The strongest month was ${best.label} with ${best.points} points.`;
  if (weakest && weakest.points < best?.points) text += ` ${weakest.label} was the quietest month at ${weakest.points} points.`;
  if (series.length >= 2) text += ` If the current pace holds, next month is projected at approximately ${forecast.next} points.`;
  return text;
}

async function getTrendAnalytics({ scopedSchoolId = null, scopedDepartmentId = null, months = 6 } = {}) {
  const monthCount = Math.max(3, Math.min(24, Number(months) || 6));
  const windows = lastMonths(monthCount);
  const since = windows[0].start;

  const studentQuery = { role: 'student', status: 'Active' };
  if (scopedSchoolId) studentQuery.schoolId = scopedSchoolId;
  if (scopedDepartmentId) studentQuery.departmentId = scopedDepartmentId;
  const students = await User.find(studentQuery).select('_id').lean();
  const studentIds = students.map((student) => student._id);

  const rows = await Submission.aggregate([
    {
      $match: {
        status: 'Approved',
        studentId: { $in: studentIds },
        submittedAt: { $gte: since },
      },
    },
    { $lookup: { from: 'activities', localField: 'activityId', foreignField: '_id', as: 'activity' } },
    { $unwind: { path: '$activity', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { month: { $dateToString: { format: '%Y-%m', date: '$submittedAt' } }, vertical: '$activity.vertical' },
        points: { $sum: '$pointsAwarded' },
        count: { $sum: 1 },
      },
    },
  ]);

  const byMonth = new Map();
  const byVertical = new Map();
  for (const row of rows) {
    const month = row._id.month;
    const vertical = String(row._id.vertical || 'General');
    byMonth.set(month, (byMonth.get(month) || 0) + row.points);
    byVertical.set(`${month}::${vertical}`, (byVertical.get(`${month}::${vertical}`) || 0) + row.points);
  }

  const series = windows.map((window, index) => ({
    month: window.key,
    label: window.label,
    points: byMonth.get(window.key) || 0,
  }));

  const best = [...series].sort((a, b) => b.points - a.points)[0];
  const weakest = [...series].sort((a, b) => a.points - b.points)[0];
  const forecast = linearForecast(series.map((month, index) => ({ x: index, y: month.points })));

  const verticalTrend = {};
  for (const window of windows) {
    const verticals = {};
    for (const [key, points] of byVertical.entries()) {
      if (key.startsWith(`${window.key}::`)) verticals[key.split('::')[1]] = points;
    }
    if (Object.keys(verticals).length) verticalTrend[window.key] = verticals;
  }

  const narrative = await generateNarrative(series, forecast, best, weakest);

  const nextMonthWindow = lastMonths(monthCount + 1, new Date())[monthCount];

  return {
    generatedAt: new Date(),
    months: monthCount,
    series,
    verticalTrend,
    forecast: { nextMonth: nextMonthWindow.label, nextPoints: forecast.next, slope: Math.round(forecast.slope * 100) / 100 },
    best: best && best.points > 0 ? best : null,
    weakest: weakest ? weakest : null,
    narrative,
  };
}

async function generateNarrative(series, forecast, best, weakest) {
  const provider = getProvider();
  const fallback = ruleBasedNarrative(series, forecast, best, weakest);
  if (!provider) return { text: fallback, provider: 'rule-engine', model: 'rule-based-fallback' };
  try {
    const result = await complete({
      system: NARRATIVE_SYSTEM_PROMPT,
      user: `Monthly series (points per month):\n${JSON.stringify(series, null, 2)}\nProjected next month: ${forecast.next}`,
      temperature: 0.3,
      maxTokens: 400,
      timeoutMs: 20000,
      retries: 1,
    });
    const text = String(result.text || '').trim();
    return { text: text || fallback, provider: result.provider, model: result.model };
  } catch (error) {
    console.error('[AI] trend narrative failed, using fallback:', error.message);
    return { text: fallback, provider: 'rule-engine', model: 'rule-based-fallback' };
  }
}

module.exports = { getTrendAnalytics, linearForecast, ruleBasedNarrative };