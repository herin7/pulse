import test from 'node:test';
import assert from 'node:assert/strict';

import { chatBodySchema } from '../validators/chatValidator.js';
import { ingestBodySchema } from '../validators/ingestValidator.js';

test('chat validator parses string history and enforces limits', () => {
  const parsed = chatBodySchema.parse({
    history: JSON.stringify([{ role: 'user', content: 'Ship the landing page' }]),
    message: 'What should I do next?',
  });

  assert.equal(parsed.message, 'What should I do next?');
  assert.equal(parsed.history.length, 1);
  assert.equal(parsed.history[0].role, 'user');
});

test('ingest validator accepts valid GitHub usernames', () => {
  const parsed = ingestBodySchema.parse({
    githubUsername: 'herin7',
    linkedinPaste: 'Founder at Pulse',
    llmDump: 'Systems-oriented solo founder.',
  });

  assert.equal(parsed.githubUsername, 'herin7');
});

test('ingest validator rejects invalid GitHub usernames', () => {
  assert.throws(() => {
    ingestBodySchema.parse({
      githubUsername: 'bad user name',
    });
  });
});
