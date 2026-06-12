/**
 * Tool Call Parser.
 *
 * Parses AI response text for tool calls in the format:
 *
 * <bs_agent_tool>
 * {"name":"execute_sql","description":"查询对话列表","params":{"query":"SELECT * FROM conversations LIMIT 10"}}
 * </bs_agent_tool>
 *
 * Uses `<bs_agent_tool>` as the outer wrapper (custom HTML tag — survives Gemini's
 * markdown renderer). Internal structure is JSON to avoid Gemini stripping inner XML tags.
 *
 * Handles:
 * - Multiple tool calls per message (max 20)
 * - Code block filtering (ignores tool calls inside ```)
 * - Required param validation per tool type
 * - Unknown tool name detection
 * - Fallback: unstructured text when Gemini strips JSON formatting
 */

import type { ParsedToolCall, ParseResult } from '../types';

const MAX_TOOL_CALLS = 20;

/** The unique tag name for our tool calls — will NOT conflict with Gemini's native <tool_call> */
export const TOOL_TAG = 'bs_agent_tool';

const SUPPORTED_TOOLS = ['execute_sql', 'sync_conversation_messages', 'export', 'complete_task'];

/** Required parameters per tool type */
const REQUIRED_PARAMS: Record<string, string[]> = {
  execute_sql: ['query'],
  sync_conversation_messages: ['conversation_ids'],
  export: ['ids', 'format'],
  complete_task: ['summary'],
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
 * Try parsing the block content as JSON (primary format).
 * Returns ParsedToolCall or null if not valid JSON.
 */
function tryParseJson(block: string): ParsedToolCall | null {
  const trimmed = block.trim();
  if (!trimmed.startsWith('{')) return null;

  try {
    const obj = JSON.parse(trimmed);
    if (typeof obj.name !== 'string') return null;

    return {
      name: obj.name.trim(),
      description: typeof obj.description === 'string' ? obj.description.trim() : undefined,
      params: typeof obj.params === 'object' && obj.params !== null
        ? Object.fromEntries(
            Object.entries(obj.params).map(([k, v]) => [k, String(v)])
          )
        : {},
    };
  } catch {
    return null;
  }
}

/**
 * Fallback: parse unstructured text when Gemini strips JSON/XML formatting.
 * Handles content like: "execute_sql 查询描述 SELECT ..."
 */
function tryParseUnstructured(block: string): ParsedToolCall | null {
  const content = block.trim();
  if (!content) return null;

  for (const tool of SUPPORTED_TOOLS) {
    if (content.startsWith(tool)) {
      const rest = content.slice(tool.length).trim();

      if (tool === 'execute_sql') {
        const sqlMatch = rest.match(/(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*/i);
        if (sqlMatch) {
          const query = sqlMatch[0].trim();
          const description = rest.slice(0, sqlMatch.index).trim();
          return { name: tool, description: description || undefined, params: { query } };
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

    // Try JSON first, then unstructured fallback
    const parsed = tryParseJson(block) || tryParseUnstructured(block);

    if (!parsed) {
      errors.push(`Failed to parse tool call content: ${block.substring(0, 100)}...`);
      continue;
    }

    const { name } = parsed;

    // Check if tool is supported
    if (!SUPPORTED_TOOLS.includes(name)) {
      errors.push(`Unknown tool: "${name}"`);
      continue;
    }

    // Validate required params
    const required = REQUIRED_PARAMS[name] || [];
    const missing = required.filter((p) => !parsed.params[p]);
    if (missing.length > 0) {
      errors.push(`${name}: missing required param(s) "${missing.join('", "')}"`);
      continue;
    }

    toolCalls.push(parsed);
  }

  return { toolCalls, errors };
}
