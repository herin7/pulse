import { callLLM } from '../utils/llmCall.js';
import { getCompetitors, insertIntel } from '../db/competitors.js';

async function searchSerper(query) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 5, tbs: 'qdr:m' }),
  });
  if (!res.ok) return { organic: [] };
  return res.json();
}

async function processCompetitor(userId, competitor) {
  const queries = [
    `${competitor.name} product launch OR new feature OR update`,
    `${competitor.name} funding OR valuation OR raised`,
    `${competitor.name} pricing OR hiring OR layoffs`,
  ];

  const results = await Promise.all(queries.map(searchSerper));

  const seen = new Set();
  const combined = results
    .flatMap((r) => r.organic || [])
    .filter((r) => {
      if (seen.has(r.title)) return false;
      seen.add(r.title);
      return true;
    })
    .map((r) => `${r.title}: ${r.snippet}`)
    .join('\n');

  if (!combined) return;

  const { text } = await callLLM({
    system: 'You are a startup competitive intelligence analyst. Be specific and factual. Output JSON only.',
    messages: [
      {
        role: 'user',
        content: `You are analyzing competitive intelligence for a founder. From these search results about ${competitor.name}, extract the single most strategically significant development from this week.

Output JSON:
{
  "summary": string,
  "category": string,
  "urgency": string
}

- summary: What happened + why it matters to a competing founder. Must include: what changed, how significant, what a competitor should do in response. 2-3 sentences.
- category: exactly one of: funding | product | hiring | pricing | general
- urgency: exactly one of: high | medium | low

If the results contain no meaningful new development (just old news or noise), output: { "summary": "", "category": "general", "urgency": "low" }

Results:
${combined}`,
      },
    ],
    maxTokens: 300,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return;
  const parsed = JSON.parse(jsonMatch[0]);

  if (!parsed.summary) return;

  await insertIntel(
    userId,
    competitor.id,
    competitor.name,
    parsed.summary,
    JSON.stringify(results),
    parsed.category || 'general',
    parsed.urgency || 'low'
  );
}

export async function fetchCompetitorIntel(userId) {
  const competitors = (await getCompetitors(userId)) || [];

  const results = await Promise.allSettled(
    competitors.map((c) => processCompetitor(userId, c))
  );

  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('[CompetitorTracker] Competitor failed:', r.reason);
    }
  }
}

export async function runDailyTracker(userId) {
  try {
    await fetchCompetitorIntel(userId);
  } catch (err) {
    console.error('[CompetitorTracker] Daily tracker failed:', err);
  }
}
