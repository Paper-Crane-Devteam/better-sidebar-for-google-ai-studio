/**
 * Tool call text parsing utilities.
 */

import { TOOL_CALL_TAG } from '../constants';
import type { ParsedToolCall } from '../../types';

const KNOWN_TOOLS = ['execute_sql', 'sync_conversation_messages', 'export', 'complete_task'];

/**
 * Parse a tool call from raw text containing <bs_agent_tool>...</bs_agent_tool> tags.
 */
export function parseToolCallFromText(text: string): ParsedToolCall | null {
  const tagRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`);
  const tagContent = text.match(tagRegex);
  const content = tagContent ? tagContent[1].trim() : text.trim();

  if (content.startsWith('{')) {
    try {
      const obj = JSON.parse(content);
      if (typeof obj.name !== 'string') return null;
      return {
        name: obj.name.trim(),
        description: typeof obj.description === 'string' ? obj.description.trim() : undefined,
        params: typeof obj.params === 'object' && obj.params !== null
          ? Object.fromEntries(Object.entries(obj.params).map(([k, v]) => [k, String(v)]))
          : {},
      };
    } catch { /* fall through */ }
  }

  for (const tool of KNOWN_TOOLS) {
    if (content.startsWith(tool)) {
      const rest = content.slice(tool.length).trim();
      if (tool === 'execute_sql') {
        const sqlMatch = rest.match(/(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*/i);
        if (sqlMatch) {
          return {
            name: tool,
            description: rest.slice(0, sqlMatch.index).trim() || undefined,
            params: { query: sqlMatch[0].trim() },
          };
        }
      }
      if (tool === 'complete_task') {
        return { name: tool, description: undefined, params: { summary: rest } };
      }
      return { name: tool, description: undefined, params: {} };
    }
  }
  return null;
}

/**
 * Extract display info (toolName, description, query) from tool call text.
 */
export function extractToolInfo(text: string): { toolName: string; description: string; query: string } {
  const tagRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`);
  const tagContent = text.match(tagRegex);
  const content = tagContent ? tagContent[1].trim() : text.trim();

  if (content.startsWith('{')) {
    try {
      const obj = JSON.parse(content);
      return {
        toolName: obj.name || 'unknown',
        description: obj.description || '',
        query: obj.params?.query || obj.params?.summary || '',
      };
    } catch { /* fall through */ }
  }

  for (const tool of KNOWN_TOOLS) {
    if (content.startsWith(tool)) {
      const rest = content.slice(tool.length).trim();
      const sqlMatch = rest.match(/(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*/i);
      if (sqlMatch) {
        return { toolName: tool, description: rest.slice(0, sqlMatch.index).trim(), query: sqlMatch[0].trim() };
      }
      return { toolName: tool, description: '', query: rest };
    }
  }
  return { toolName: 'tool_call', description: '', query: '' };
}
