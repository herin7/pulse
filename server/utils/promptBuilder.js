import { getTodayEvents } from '../agents/calendarAgent.js';
import { clipText, escapeRegex } from './messageUtils.js';

const MAX_LOOP_CHARS = 120;

function buildCompactCharacterProfile(characterCard) {
  return {
    name: characterCard.name,
    founderType: characterCard.founderType,
    building: characterCard.building,
    stage: characterCard.stage,
    coreDrive: characterCard.coreDrive,
    northStar: characterCard.northStar,
    biggestRisk: characterCard.biggestRisk,
    operatingStyle: characterCard.operatingStyle,
    strengths: (characterCard.founderStrengths || []).slice(0, 3),
    blindspots: (characterCard.blindspots || []).slice(0, 3),
    techStack: (characterCard.techStack || []).slice(0, 6),
  };
}

function memoryToFounderVoice(text, founderName) {
  const escapedName = escapeRegex(founderName);
  return String(text || '')
    .replace(new RegExp(`\\b${escapedName}\\s+has\\b`, 'gi'), 'You have')
    .replace(new RegExp(`\\b${escapedName}\\s+need(s)?\\s+to\\b`, 'gi'), 'You need to')
    .replace(new RegExp(`\\b${escapedName}\\s+has to\\b`, 'gi'), 'You have to')
    .replace(new RegExp(`\\b${escapedName}\\s+will\\b`, 'gi'), 'You will')
    .replace(new RegExp(`\\b${escapedName}\\s+is\\b`, 'gi'), 'You are')
    .replace(new RegExp(`\\b${escapedName}'s\\b`, 'gi'), 'Your');
}

function formatTodayContext(events) {
  if (!events.length) return 'Unavailable.';
  return events.slice(0, 6).map((event) => {
    const title = event.title || event.summary || event.name || 'Untitled event';
    const start = event.start || event.startTime || event.when || '';
    return `- ${title}${start ? ` at ${start}` : ''}`;
  }).join('\n');
}

export async function fetchTodayContext() {
  const events = await getTodayEvents();
  return formatTodayContext(events);
}

export function buildFallbackReply(message, chunks, founderName) {
  const memoryChunk = chunks.find((chunk) => chunk.source === 'durable_memory' || chunk.source === 'chat_memory') || chunks[0];
  if (!memoryChunk?.text) {
    return 'I lost the thread for a second. Send that once more.';
  }

  const founderVoiceMemory = memoryToFounderVoice(memoryChunk.text, founderName);
  return /\bwhat\b|\btomorrow\b|\btonight\b/i.test(String(message || ''))
    ? founderVoiceMemory
    : `From memory: ${founderVoiceMemory}`;
}

export function buildSystemPrompt({ agentSetupBlock, characterCard, compactOpenLoops, context, intelBlock, todayContext, urgentBlock }) {
  const now = new Date();

  return `You are Pulse - a sharp, direct AI co-founder for ${characterCard.name || 'Founder'}.

Current date and time: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}

Today's schedule:
${todayContext || 'Unavailable.'}

YOUR ROLE:
- You know everything about them from their profile, GitHub, LinkedIn, and any imported workspace context below
- You track their open commitments and competitive landscape
- You speak like a co-founder: direct, no fluff, never formal

RULES:
- Never explain what you're doing or thinking
- Never start with "As your AI co-founder" or any role announcement
- Never narrate your reasoning process
- Keep responses short unless asked to go deep
- If they just say hello, respond in one line max
- If there's urgent competitor intel, lead with it immediately

FOUNDER CONTEXT:
${JSON.stringify(buildCompactCharacterProfile(characterCard), null, 2)}

AGENT SETUP:
${agentSetupBlock}

OPEN LOOPS:
${compactOpenLoops.map((loop) => `- ${clipText(loop.task, MAX_LOOP_CHARS)}`).join('\n') || 'None (Ask if they have any new tasks).'}

COMPETITOR INTEL:
${urgentBlock}${intelBlock}

RAG CONTEXT:
${context}`;
}
