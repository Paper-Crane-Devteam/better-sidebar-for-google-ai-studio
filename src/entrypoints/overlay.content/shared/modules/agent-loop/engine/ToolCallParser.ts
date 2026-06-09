/**
 * Tool Call Parser.
 *
 * Parses AI response text for tool calls in the XML-like format:
 *
 * <bs_agent_tool>
 * <name>execute_sql</name>
 * <params>
 * <query>SELECT * FROM conversations LIMIT 10</query>
 * </params>
 * </bs_agent_tool>
 *
 * Uses `<bs_agent_tool>` instead of generic `<tool_call>` to avoid conflicts
 * with Gemini's native function calling / tool_call format.
 *
 * Handles:
 * - Multiple tool calls per message (max 20)
 * - Code block filtering (ignores tool calls inside ```)
 * - Required param validation per tool type
 * - Unknown tool name detection
 */

import type { ParsedToolCall, ParseResult } from '../types';

const MAX_TOOL_CALLS = 20;

/** The unique tag name for our tool calls — will NOT conflict with Gemini's native <tool_call> */
export const TOOL_TAG = 'bs_agent_tool';

const SUPPORTED_TOOLS = ['execute_sql', 'sync_conversation_messages', 'export'];

/** Required parameters per tool type */
const REQUIRED_PARAMS: Record<string, string[]> = {
  execute_sql: ['query'],
  sync_conversation_messages: ['conversation_ids'],
  export: ['ids', 'format'],
};

/**
 * Determine if a position in the text is inside a fenced code block.
 * A position is inside a code block if it follows an odd number of ``` markers.
 */
function isInsideCodeBlock(text: string, position: number): boolean {
  const before = text.substring(0, position);
  const fenceMatches = before.match(/```/g);
  return (fenceMatches?.length ?? 0) % 2 !== 0;
}

/**
 * Parse tool calls from AI response text.
 */
export function parseToolCalls(responseText: string): ParseResult {
  const toolCalls: ParsedToolCall[] = [];
  const errors: string[] = [];

  const toolCallRegex = /<bs_agent_tool>([\s\S]*?)<\/bs_agent_tool>/g;
  let match: RegExpExecArray | null;

  while ((match = toolCallRegex.exec(responseText)) !== null) {
    if (toolCalls.length >= MAX_TOOL_CALLS) {
      errors.push(`Maximum tool call limit (${MAX_TOOL_CALLS}) reached, ignoring remaining.`);
      break;
    }

    // Skip if inside a code block
    if (isInsideCodeBlock(responseText, match.index)) {
      continue;
    }

    const block = match[1];

    // Extract name
    const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/);
    if (!nameMatch) {
      errors.push('Tool call missing <name> tag');
      continue;
    }

    const name = nameMatch[1].trim();

    // Check if tool is supported
    if (!SUPPORTED_TOOLS.includes(name)) {
      errors.push(`Unknown tool: "${name}"`);
      continue;
    }

    // Extract params
    const paramsMatch = block.match(/<params>([\s\S]*?)<\/params>/);
    const params: Record<string, string> = {};

    if (paramsMatch) {
      const paramsBlock = paramsMatch[1];
      // Extract each <key>value</key> param
      const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
      let paramMatch: RegExpExecArray | null;
      while ((paramMatch = paramRegex.exec(paramsBlock)) !== null) {
        params[paramMatch[1]] = paramMatch[2].trim();
      }
    }

    // Validate required params
    const required = REQUIRED_PARAMS[name] || [];
    const missing = required.filter((p) => !params[p]);
    if (missing.length > 0) {
      errors.push(`${name}: missing required param(s) "${missing.join('", "')}"`);
      continue;
    }

    toolCalls.push({ name, params });
  }

  return { toolCalls, errors };
}
