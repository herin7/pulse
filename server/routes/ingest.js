import { Router } from 'express';
import { chunkText } from '../utils/chunkText.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/api/ingest', requireAuth, async (req, res) => {
  try {
    const { llmDump, linkedinPaste, githubUsername } = req.body;
    const userId = req.user.id;

    let githubText = '';
    let githubFailed = false;

    if (githubUsername) {
      try {
        const headers = { 'User-Agent': 'life-cofounder-app' };

        const [profileRes, starredReposRes, allReposRes] = await Promise.all([
          fetch(`https://api.github.com/users/${encodeURIComponent(githubUsername)}`, { headers }),
          fetch(`https://api.github.com/users/${encodeURIComponent(githubUsername)}/repos?sort=stars&per_page=10`, { headers }),
          fetch(`https://api.github.com/users/${encodeURIComponent(githubUsername)}/repos?per_page=100`, { headers }),
        ]);

        if (profileRes.ok) {
          const profile = await profileRes.json();
          const starredRepos = starredReposRes.ok ? await starredReposRes.json() : [];
          const allRepos = allReposRes.ok ? await allReposRes.json() : [];

          const repoList = starredRepos
            .map((repo) => `${repo.name} (${repo.language || 'unknown'}, ${repo.stargazers_count} stars): ${repo.description || 'no description'}`)
            .join('; ');

          const langCounts = {};
          for (const repo of allRepos) {
            if (repo.language) {
              langCounts[repo.language] = (langCounts[repo.language] || 0) + 1;
            }
          }

          const topLangs = Object.entries(langCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([lang]) => lang)
            .join(', ');

          githubText = `GitHub Profile: ${profile.name || githubUsername}. Bio: ${profile.bio || 'N/A'}. Blog: ${profile.blog || 'N/A'}. Public repos: ${profile.public_repos}. Followers: ${profile.followers}. Top repos: ${repoList}. Primary languages: ${topLangs}.`;
        } else {
          console.warn(`[Ingest] GitHub API returned ${profileRes.status} for ${githubUsername}`);
          githubFailed = true;
        }
      } catch (err) {
        console.warn('[Ingest] GitHub fetch failed, continuing without it:', err.message);
        githubFailed = true;
      }
    }

    const corpus = [
      { text: llmDump || '', source: 'ai_self_report' },
      { text: linkedinPaste || '', source: 'linkedin' },
      { text: githubText, source: 'github' },
    ];

    const allChunks = corpus.flatMap(({ text, source }) =>
      text ? chunkText(text).map((chunk) => ({ ...chunk, source })) : []
    );

    req.session.userId = userId;
    req.session.ingestDone = true;

    const warnings = [];
    if (githubFailed) {
      warnings.push('GitHub data could not be fetched. You can redo onboarding later to include it.');
    }

    res.json({ chunks: allChunks, userId, warnings });
  } catch (err) {
    console.error('[Ingest] Error:', err);
    res.status(500).json({ error: 'Ingest failed', details: err.message });
  }
});

export default router;
