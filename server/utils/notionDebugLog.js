import { appendFile, mkdir } from 'node:fs/promises';

const DEBUG_DIR = new URL('../debug/', import.meta.url);
const DEBUG_FILE = new URL('../debug/notion-fetch-log.txt', import.meta.url);

function formatSection(label, value) {
  return `${label}:\n${String(value || '').trim() || '(empty)'}\n`;
}

export async function appendNotionDebugEntry(entry) {
  const lines = [
    '============================================================',
    `Timestamp: ${new Date().toISOString()}`,
    `Mode: ${entry.mode || 'unknown'}`,
    `Query: ${entry.query || 'workspace'}`,
    `Page ID: ${entry.pageId || 'unknown'}`,
    `Title: ${entry.title || '(untitled)'}`,
    formatSection('Content', entry.text),
  ];

  await mkdir(DEBUG_DIR, { recursive: true });
  await appendFile(DEBUG_FILE, `${lines.join('\n')}\n`, 'utf8');
}
