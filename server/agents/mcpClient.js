import { logger } from '../utils/logger.js';

const CALENDAR_SERVER_URL = 'https://gcal.mcp.claude.com/mcp';
const GMAIL_SERVER_URL = 'https://gmail.mcp.claude.com/mcp';
const MCP_TIMEOUT_MS = 10000;

export function isMcpEnabled() {
  return String(process.env.MCP_ENABLED || '').toLowerCase() === 'true';
}

export async function callMCPTool(serverUrl, toolName, params = {}, authToken) {
  if (!isMcpEnabled() || !serverUrl || !toolName || !authToken) {
    logger.debug('Skipping MCP tool call', {
      authPresent: Boolean(authToken),
      mcpEnabled: isMcpEnabled(),
      serverUrl,
      toolName,
    });
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    logger.debug('Calling MCP tool', {
      paramKeys: Object.keys(params || {}),
      serverUrl,
      toolName,
    });
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ tool: toolName, params }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      logger.warn('MCP tool request failed', {
        body: body.slice(0, 300),
        durationMs: Date.now() - startedAt,
        serverUrl,
        status: response.status,
        toolName,
      });
      return null;
    }

    const payload = await response.json().catch(() => null);
    logger.info('MCP tool request succeeded', {
      durationMs: Date.now() - startedAt,
      hasPayload: Boolean(payload),
      serverUrl,
      toolName,
    });
    return payload;
  } catch (error) {
    logger.warn('MCP tool call failed', {
      durationMs: Date.now() - startedAt,
      error: error.message,
      serverUrl,
      toolName,
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function calendarMCP(toolName, params = {}, authToken = process.env.GOOGLE_ACCESS_TOKEN) {
  return callMCPTool(CALENDAR_SERVER_URL, toolName, params, authToken);
}

export function gmailMCP(toolName, params = {}, authToken = process.env.GMAIL_ACCESS_TOKEN) {
  return callMCPTool(GMAIL_SERVER_URL, toolName, params, authToken);
}
