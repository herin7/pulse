import { z } from 'zod';

// ── Onboarding step 0: LLM dump ─────────────────────────────────────────────
export const llmDumpSchema = z.object({
    llmDump: z
        .string()
        .min(100, 'Paste at least 100 characters — AI profiles tend to be longer.')
        .max(40_000, 'Too long — trim it down under 40,000 characters.'),
});

// ── Onboarding step 1: LinkedIn ──────────────────────────────────────────────
export const linkedinSchema = z.object({
    linkedinPaste: z
        .string()
        .min(50, 'Looks too short — paste the full profile text.')
        .max(60_000, 'Too long — paste just the profile section.'),
});

// ── Onboarding step 2: GitHub ────────────────────────────────────────────────
export const githubSchema = z.object({
    githubUsername: z
        .string()
        .min(1, 'GitHub username is required.')
        .max(39, 'GitHub usernames are max 39 characters.')
        .regex(
            /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/,
            'Only letters, numbers, and hyphens — no spaces or special characters.'
        ),
});

// ── BYOK API key ─────────────────────────────────────────────────────────────
export const apiKeySchema = z.object({
    gemini: z.string().startsWith('AIza', 'Gemini keys start with "AIza"').optional().or(z.literal('')),
    groq: z.string().startsWith('gsk_', 'Groq keys start with "gsk_"').optional().or(z.literal('')),
    claude: z.string().startsWith('sk-ant-', 'Anthropic keys start with "sk-ant-"').optional().or(z.literal('')),
});

// ── Chat message ─────────────────────────────────────────────────────────────
export const chatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(32_000),
    sources: z.array(z.string()).optional(),
});

// ── Helper: validate and return typed result ─────────────────────────────────
export function validate(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) return { ok: true, data: result.data, errors: {} };
    const errors = {};
    result.error.errors.forEach((e) => {
        const key = e.path[0] || '_root';
        if (!errors[key]) errors[key] = e.message;
    });
    return { ok: false, data: null, errors };
}
