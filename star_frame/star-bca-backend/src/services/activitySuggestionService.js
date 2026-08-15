const { complete, getProvider } = require('./llmService');

const SUGGEST_SYSTEM_PROMPT = `You are an assistant for a college STAR (Student Activity Reward Points) system. Given an activity name, vertical and maximum points, propose a concise description and 3 achievement levels in strict JSON with this shape:
{
  "description": "<1-2 sentence description of what the student does and how evidence is assessed>",
  "levels": [
    { "label": "Level 1", "points": <number> },
    { "label": "Level 2", "points": <number> },
    { "label": "Level 3", "points": <number> }
  ]
}
Level labels should be realistic (e.g. Participation, Commendable, Outstanding). Points must be strictly increasing, rounded to sensible numbers, and never exceed the maximum points.`;

function ruleBasedSuggestions({ activityName, vertical, maximumPoints }) {
  const max = Math.max(1, Math.round(Number(maximumPoints) || 100));
  const label = String(activityName || '').trim() || 'This activity';
  const description = `${label} — a ${String(vertical || 'co-curricular').trim()} activity. Students complete the activity, upload evidence of participation or achievement, and are assessed against the levels below for STAR points.`;
  return {
    description,
    levels: [
      { label: 'Level 1', points: Math.max(1, Math.round(max * 0.4)) },
      { label: 'Level 2', points: Math.max(1, Math.round(max * 0.7)) },
      { label: 'Level 3', points: max },
    ],
  };
}

// Single purpose: propose a description + levels for a new activity.
async function generateActivitySuggestions({ activityName, vertical, maximumPoints }) {
  const fallback = ruleBasedSuggestions({ activityName, vertical, maximumPoints });
  const provider = getProvider();
  if (!provider) {
    return { ...fallback, provider: 'rule-engine', model: 'rule-based-fallback' };
  }

  try {
    const result = await complete({
      system: SUGGEST_SYSTEM_PROMPT,
      user: `Activity: "${String(activityName || '')}"\nVertical: ${String(vertical || 'unspecified')}\nMaximum points: ${Math.round(Number(maximumPoints) || 100)}`,
      json: true,
      temperature: 0.4,
      maxTokens: 512,
      timeoutMs: 20000,
      retries: 1,
    });

    const parsed = result.parsed;
    if (!parsed) throw new Error('unparseable response');

    const max = Math.max(1, Math.round(Number(maximumPoints) || 100));
    const levels = Array.isArray(parsed.levels)
      ? parsed.levels
          .slice(0, 4)
          .map((level) => ({
            label: String(level?.label || '').slice(0, 60),
            points: Math.max(1, Math.min(max, Math.round(Number(level?.points) || 0))),
          }))
          .filter((level) => level.label && level.points > 0)
      : fallback.levels;

    return {
      description: String(parsed.description || fallback.description || '').trim().slice(0, 600),
      levels: levels.length >= 2 ? levels : fallback.levels,
      provider: result.provider,
      model: result.model,
    };
  } catch (error) {
    console.error('[AI] activity suggestion failed, using fallback:', error.message);
    return { ...fallback, provider: 'rule-engine', model: 'rule-based-fallback' };
  }
}

module.exports = { generateActivitySuggestions, ruleBasedSuggestions };