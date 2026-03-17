import { z } from 'zod';

const GITHUB_USERNAME_PATTERN = /^(?!-)(?!.*--)[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

export const ingestBodySchema = z.object({
  githubUsername: z.string().trim().regex(GITHUB_USERNAME_PATTERN, 'GitHub username format is invalid').optional().or(z.literal('')).default(''),
  linkedinPaste: z.string().max(50000, 'LinkedIn text must be at most 50000 characters').optional().default(''),
  llmDump: z.string().max(50000, 'Self report must be at most 50000 characters').optional().default(''),
});

export const ingestSourceBodySchema = ingestBodySchema.extend({
  source: z.enum(['github', 'linkedin', 'selfReport', 'notion']),
});
