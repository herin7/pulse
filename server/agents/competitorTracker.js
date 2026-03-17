import { getCompetitors, getRecentSummaries, insertIntel } from '../db/competitors.js';
import { callLLM } from '../utils/llmCall.js';
import { logger } from '../utils/logger.js';

async function searchSerper(query, timeframe = 'qdr:m') {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': process.env.SERPER_API_KEY,
    },
    body: JSON.stringify({ q: query, num: 8, tbs: timeframe }),
  });

  return response.ok ? response.json() : { organic: [] };
}

async function processCompetitor(userId, competitor, timeframe) {
  const existingSummaries = await getRecentSummaries(userId, competitor.id, 5);
  const existingContext = existingSummaries.length
    ? `\nPREVIOUSLY TRACKED INTEL (DO NOT REPEAT THESE):\n- ${existingSummaries.join('\n- ')}`
    : '';
  const queries = [
    `${competitor.name} "product launch" OR "new feature" OR "update"`,
    `${competitor.name} funding OR valuation OR raised`,
    `${competitor.name} pricing OR hiring OR layoffs`,
  ];
  const results = await Promise.all(queries.map((query) => searchSerper(query, timeframe)));
  const seenLinks = new Set();
  const rawLinks = [];
  const combined = results
    .flatMap((result) => result.organic || [])
    .filter((item) => {
      if (!item.link || seenLinks.has(item.link)) return false;
      seenLinks.add(item.link);
      rawLinks.push({ title: item.title, link: item.link, snippet: item.snippet });
      return true;
    })
    .map((item) => `SOURCE: ${item.link}\nTITLE: ${item.title}\nSNIPPET: ${item.snippet}`)
    .join('\n\n---\n\n');

  if (!combined) {
    return;
  }

  const { text } = await callLLM({
    system: 'You are a elite startup competitive intelligence analyst. Your goal is to find high-signal changes and ignore noise. Output JSON only.',
    messages: [{
      role: 'user',
      content: `You are analyzing competitive intelligence for a founder. From these search results about ${competitor.name}, extract the single most strategically significant development.

Output JSON structure:
{ "summary": string, "category": "funding" | "product" | "hiring" | "pricing" | "general", "urgency": "high" | "medium" | "low", "sourceUrl": string }

${existingContext}

SEARCH RESULTS TO ANALYZE:
${combined}

If everything is already covered or irrelevant, output: { "summary": "", "category": "general", "urgency": "low", "sourceUrl": "" }`,
    }],
    maxTokens: 500,
  });

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return;
  const parsed = JSON.parse(match[0]);
  if (!parsed.summary) return;

  await insertIntel(userId, competitor.id, competitor.name, parsed.summary, JSON.stringify(rawLinks), parsed.category || 'general', parsed.urgency || 'low', parsed.sourceUrl || null);
}

export async function fetchCompetitorIntel(userId, force = false) {
  const competitors = await getCompetitors(userId);
  const timeframe = force ? 'qdr:m' : 'qdr:d';
  const results = await Promise.allSettled(competitors.map((competitor) => processCompetitor(userId, competitor, timeframe)));
  results.filter((result) => result.status === 'rejected').forEach((result) => {
    logger.error('Competitor tracking task failed', { error: result.reason?.message || String(result.reason) });
  });
}

export async function runDailyTracker(userId) {
  await fetchCompetitorIntel(userId, false);
}
