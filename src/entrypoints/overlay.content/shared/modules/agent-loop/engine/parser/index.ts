/**
 * Tool Call Parser — AI response text in, executable tool calls out.
 *
 * Expected format:
 *
 * <bs_agent_tool>
 * {"name":"execute_sql","description":"查询对话列表","params":{"query":"SELECT * FROM conversations LIMIT 10"}}
 * </bs_agent_tool>
 *
 * Pure and stateless. Everything it rejects comes back as an `errors` entry rather
 * than an exception, because those strings are fed back to the AI so it can fix
 * its own output on the next round.
 *
 * - `tool-schema.ts` — which tools exist and what they require
 * - `fallbacks.ts`   — coping with Gemini mangling the format
 */

import type { ParsedToolCall, ParseResult } from '../../types';
import { MAX_TOOL_CALLS, TOOL_TAG, findMissingParams, isSupportedTool } from './tool-schema';
import { isInsideCodeBlock, tryParseJson, tryParseUnstructured } from './fallbacks';

export {
  TOOL_TAG,
  SUPPORTED_TOOLS,
  REQUIRED_PARAMS,
  CONTROL_TOOLS,
  hasUnclosedToolBlock,
} from './tool-schema';

const TOOL_BLOCK_RE = new RegExp(`<${TOOL_TAG}>([\\s\\S]*?)<\\/${TOOL_TAG}>`, 'g');

/** Parse every tool call in an AI response. */
export function parseToolCalls(responseText: string): ParseResult {
  const toolCalls: ParsedToolCall[] = [];
  const errors: string[] = [];

  const regex = new RegExp(TOOL_BLOCK_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(responseText)) !== null) {
    if (toolCalls.length >= MAX_TOOL_CALLS) {
      errors.push(`Maximum tool call limit (${MAX_TOOL_CALLS}) reached, ignoring remaining.`);
      break;
    }

    // Quoted inside a fence — the AI is explaining, not asking
    if (isInsideCodeBlock(responseText, match.index)) continue;

    const block = match[1];
    const parsed = tryParseJson(block) || tryParseUnstructured(block);

    if (!parsed) {
      errors.push(`Failed to parse tool call content: ${block.substring(0, 100)}...`);
      continue;
    }

    if (!isSupportedTool(parsed.name)) {
      errors.push(`Unknown tool: "${parsed.name}"`);
      continue;
    }

    const missing = findMissingParams(parsed.name, parsed.params);
    if (missing.length > 0) {
      errors.push(`${parsed.name}: missing required param(s) "${missing.join('", "')}"`);
      continue;
    }

    toolCalls.push(parsed);
  }

  return { toolCalls, errors };
}
