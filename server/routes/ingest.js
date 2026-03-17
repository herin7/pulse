import { Router } from 'express';

import * as notion from '../services/notionService.js';
import { ingestRateLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { chunkText } from '../utils/chunkText.js';
import { getLogContext, logger } from '../utils/logger.js';
import { ingestBodySchema, ingestSourceBodySchema } from '../validators/ingestValidator.js';

const router = Router();
const GITHUB_HEADERS = { 'User-Agent': 'pulse' };
const SOURCE_KEYS = ['selfReport', 'linkedin', 'github', 'notion'];

async function fetchGithub(username, req) {
  if (!username) return { chunks: [], status: 'skipped', warnings: [] };
  try {
    const [profileRes, starredRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers: GITHUB_HEADERS }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=stars&per_page=10`, { headers: GITHUB_HEADERS }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100`, { headers: GITHUB_HEADERS }),
    ]);
    if (!profileRes.ok) return { chunks: [], status: 'failed', warnings: ['GitHub data could not be fetched. You can redo onboarding later to include it.'] };
    const profile = await profileRes.json();
    const starred = starredRes.ok ? await starredRes.json() : [];
    const repos = reposRes.ok ? await reposRes.json() : [];
    const languages = Object.entries(repos.reduce((acc, repo) => (repo.language ? { ...acc, [repo.language]: (acc[repo.language] || 0) + 1 } : acc), {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name).join(', ');
    const summary = `GitHub Profile: ${profile.name || username}. Bio: ${profile.bio || 'N/A'}. Public repos: ${profile.public_repos}. Followers: ${profile.followers}. Top repos: ${starred.map((repo) => `${repo.name} (${repo.language || 'unknown'}, ${repo.stargazers_count} stars): ${repo.description || 'no description'}`).join('; ')}. Primary languages: ${languages}.`;
    return { chunks: chunkText(summary, { source: 'github' }), status: 'success', warnings: [] };
  } catch (error) {
    logger.warn('GitHub fetch failed during ingest', { ...getLogContext(req), error: error.message, githubUsername: username });
    return { chunks: [], status: 'failed', warnings: ['GitHub data could not be fetched. You can redo onboarding later to include it.'] };
  }
}

async function fetchNotion(req) {
  if (!notion.isEnabled()) return { chunks: [], pagesIndexed: 0, status: 'not_configured', warnings: [] };
  try {
    const pages = await notion.fetchFounderProfile();
    if (!pages?.length) return { chunks: [], pagesIndexed: 0, status: 'empty', warnings: ['Connected but no relevant Notion pages were found. Share pages with your integration in Notion.'] };
    const text = pages.map((page) => [page.properties, page.content].filter(Boolean).join('\n')).join('\n\n');
    return { chunks: chunkText(text, { source: 'notion' }), pagesIndexed: pages.length, status: 'success', warnings: [] };
  } catch (error) {
    logger.warn('Notion fetch failed during ingest', { ...getLogContext(req), error: error.message });
    return { chunks: [], pagesIndexed: 0, status: 'failed', warnings: ['Notion data could not be fetched. You can connect or share pages later.'] };
  }
}

function fetchInlineSource(source, body) {
  if (source === 'selfReport') return { chunks: body.llmDump ? chunkText(body.llmDump, { source: 'ai_self_report' }) : [], status: body.llmDump ? 'success' : 'skipped', warnings: [] };
  if (source === 'linkedin') return { chunks: body.linkedinPaste ? chunkText(body.linkedinPaste, { source: 'linkedin' }) : [], status: body.linkedinPaste ? 'success' : 'skipped', warnings: [] };
  return null;
}

async function loadSource(source, body, req) {
  if (source === 'github') return fetchGithub(body.githubUsername, req);
  if (source === 'notion') return fetchNotion(req);
  return fetchInlineSource(source, body);
}

function summarizeSources(results) {
  return results.reduce((acc, [key, value]) => ({ ...acc, [key]: value.status }), {});
}

router.post('/api/ingest/source', requireAuth, ingestRateLimit, validateBody(ingestSourceBodySchema), asyncHandler(async (req, res) => {
  const result = await loadSource(req.body.source, req.body, req);
  res.json({ chunks: result.chunks, pagesIndexed: result.pagesIndexed || 0, source: req.body.source, status: result.status, warnings: result.warnings || [] });
}));

router.post('/api/ingest', requireAuth, ingestRateLimit, validateBody(ingestBodySchema), asyncHandler(async (req, res) => {
  const results = await Promise.all(SOURCE_KEYS.map(async (source) => [source, await loadSource(source, req.body, req)]));
  const chunks = results.flatMap(([, value]) => value.chunks || []);
  if (!chunks.length) throw new AppError('At least one source is required for ingest', 400, 'EMPTY_INGEST');
  req.session.ingestDone = true;
  req.session.userId = req.user.id;
  res.json({
    success: true,
    chunks,
    chunksStored: chunks.length,
    pagesIndexed: { notion: results.find(([key]) => key === 'notion')?.[1].pagesIndexed || 0 },
    sources: summarizeSources(results),
    userId: req.user.id,
    warnings: results.flatMap(([, value]) => value.warnings || []),
  });
}));

export default router;
