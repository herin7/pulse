import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { chunkText } from '../utils/chunkText.js';
import { getLogContext, logger } from '../utils/logger.js';

const router = Router();
const GITHUB_HEADERS = { 'User-Agent': 'pulse' };

async function fetchGithubSummary(username, req) {
  if (!username) {
    return { githubText: '', warnings: [] };
  }

  try {
    const [profileRes, starredReposRes, allReposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers: GITHUB_HEADERS }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=stars&per_page=10`, { headers: GITHUB_HEADERS }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100`, { headers: GITHUB_HEADERS }),
    ]);

    if (!profileRes.ok) {
      logger.warn('GitHub profile fetch returned non-200', {
        ...getLogContext(req),
        githubUsername: username,
        status: profileRes.status,
      });
      return { githubText: '', warnings: ['GitHub data could not be fetched. You can redo onboarding later to include it.'] };
    }

    const profile = await profileRes.json();
    const starredRepos = starredReposRes.ok ? await starredReposRes.json() : [];
    const allRepos = allReposRes.ok ? await allReposRes.json() : [];
    const repoList = starredRepos
      .map((repo) => `${repo.name} (${repo.language || 'unknown'}, ${repo.stargazers_count} stars): ${repo.description || 'no description'}`)
      .join('; ');
    const languageCounts = allRepos.reduce((accumulator, repo) => {
      if (repo.language) accumulator[repo.language] = (accumulator[repo.language] || 0) + 1;
      return accumulator;
    }, {});
    const topLanguages = Object.entries(languageCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([language]) => language).join(', ');

    return {
      githubText: `GitHub Profile: ${profile.name || username}. Bio: ${profile.bio || 'N/A'}. Blog: ${profile.blog || 'N/A'}. Public repos: ${profile.public_repos}. Followers: ${profile.followers}. Top repos: ${repoList}. Primary languages: ${topLanguages}.`,
      warnings: [],
    };
  } catch (error) {
    logger.warn('GitHub fetch failed during ingest', {
      ...getLogContext(req),
      error: error.message,
      githubUsername: username,
    });
    return { githubText: '', warnings: ['GitHub data could not be fetched. You can redo onboarding later to include it.'] };
  }
}

router.post('/api/ingest', requireAuth, asyncHandler(async (req, res) => {
  const { githubUsername, linkedinPaste, llmDump } = req.body;
  const { githubText, warnings } = await fetchGithubSummary(githubUsername, req);
  const chunks = [
    { text: llmDump || '', source: 'ai_self_report' },
    { text: linkedinPaste || '', source: 'linkedin' },
    { text: githubText, source: 'github' },
  ].flatMap(({ source, text }) => text ? chunkText(text, { source }) : []);

  if (!chunks.length) {
    throw new AppError('At least one source is required for ingest', 400, 'EMPTY_INGEST');
  }

  req.session.ingestDone = true;
  req.session.userId = req.user.id;
  res.json({ chunks, userId: req.user.id, warnings });
}));

export default router;
