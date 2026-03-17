import { clipText } from './messageUtils.js';

const MAX_CONTEXT_CHARS_PER_CHUNK = 650;
const MAX_INTEL_CHARS = 180;

function describeSource(source, founderName) {
  if (source === 'durable_memory') return `${founderName}'s saved memory`;
  if (source === 'chat_memory') return `${founderName}'s prior chat`;
  return source;
}

export function buildContextBlock(chunks, founderName) {
  const seen = new Set();
  return chunks
    .filter((chunk) => {
      const text = (chunk.text || '').trim();
      if (!text || seen.has(text)) return false;
      seen.add(text);
      return true;
    })
    .map((chunk) => `[${describeSource(chunk.source, founderName)}]: ${clipText(chunk.text, MAX_CONTEXT_CHARS_PER_CHUNK)}`)
    .join('\n\n');
}

export function buildIntelBlocks(recentIntel) {
  const urgent = recentIntel
    .filter((item) => item.urgency === 'high')
    .slice(0, 1)
    .map((item) => `${clipText(item.competitor_name, 40)}: ${clipText(item.summary, MAX_INTEL_CHARS)}${item.sourceUrl ? ` (Source: ${item.sourceUrl})` : ''}`)
    .join('\n');
  const standard = recentIntel
    .filter((item) => item.urgency !== 'high')
    .slice(0, 2)
    .map((item) => `- [${item.category}] ${clipText(item.competitor_name, 40)}: ${clipText(item.summary, MAX_INTEL_CHARS)}${item.sourceUrl ? ` (Source: ${item.sourceUrl})` : ''}`)
    .join('\n');

  return {
    urgentBlock: urgent ? `URGENT COMPETITIVE DEVELOPMENT - mention only if relevant:\n${urgent}\n\n` : '',
    intelBlock: standard ? `\n\nRecent competitive intelligence (surface only when relevant):\n${standard}` : '',
  };
}

export function buildAgentSetupBlock(agentProfile) {
  if (!agentProfile) {
    return 'Agent setup: default Pulse profile.';
  }

  const lines = [
    `Identity: ${agentProfile.identity?.agentName || 'Pulse'} (${agentProfile.identity?.role || 'AI Cofounder'})`,
    `Tone: ${clipText(agentProfile.identity?.tone || 'Direct, concise, execution-first', 120)}`,
    `Responsibility: ${clipText(agentProfile.identity?.responsibility || 'Keep the founder focused, accountable, and moving.', 140)}`,
  ];

  if (agentProfile.context?.startupName || agentProfile.context?.productName || agentProfile.context?.founderName) {
    lines.push(`Startup: founder=${clipText(agentProfile.context?.founderName || 'unknown', 50)}, startup=${clipText(agentProfile.context?.startupName || 'unknown', 60)}, product=${clipText(agentProfile.context?.productName || 'unknown', 60)}`);
  }

  if (agentProfile.context?.goals) lines.push(`Goals: ${clipText(agentProfile.context.goals, 180)}`);
  if (agentProfile.context?.constraints) lines.push(`Constraints: ${clipText(agentProfile.context.constraints, 160)}`);
  if (agentProfile.context?.operatingInstructions) lines.push(`Operating instructions: ${clipText(agentProfile.context.operatingInstructions, 180)}`);
  if (agentProfile.emails?.agentEmail || agentProfile.emails?.userEmail) {
    lines.push(`Email identity: agent=${clipText(agentProfile.emails?.agentEmail || 'not set', 60)}, user=${clipText(agentProfile.emails?.userEmail || 'not set', 60)}, approval=${agentProfile.emails?.approvalMode || 'approve_before_send'}`);
  }

  if (agentProfile.automation) {
    lines.push(`Automation: schedule=${agentProfile.automation.canScheduleEmails ? 'yes' : 'no'}, autoFollowUp=${agentProfile.automation.canFollowUpAutonomously ? 'yes' : 'no'}, quietHours=${clipText(agentProfile.automation.quietHours || 'not set', 40)}, reminderIntensity=${clipText(agentProfile.automation.reminderIntensity || 'firm', 30)}`);
  }

  return `Agent setup:\n- ${lines.join('\n- ')}`;
}
