/**
 * Tolerance layer for the tool-call parser.
 *
 * Gemini's renderer is not a faithful pipe: it strips inner XML tags, sometimes
 * mangles JSON, and happily quotes our tool blocks inside code fences when it is
 * only *explaining* a tool call. Everything here exists to cope with that, and it
 * is expected to keep growing — which is why it lives apart from the parser's
 * main flow.
 */

import type { ParsedToolCall } from '../../types';
import { SUPPORTED_TOOLS } from './tool-schema';

/**
 * Whether `position` sits inside a fenced code block, i.e. after an odd number of
 * ``` markers. Tool calls quoted in a fence are documentation, not instructions.
 */
export function isInsideCodeBlock(text: string, position: number): boolean {
  const before = text.substring(0, position);
  const fenceMatches = before.match(/```/g);
  return (fenceMatches?.length ?? 0) % 2 !== 0;
}

/**
 * Primary format: a JSON object.
 * Returns null when the block isn't valid JSON with a `name`.
 */
export function tryParseJson(block: string): ParsedToolCall | null {
  const trimmed = block.trim();
  if (!trimmed.startsWith('{')) return null;

  try {
    const obj = JSON.parse(trimmed);
    if (typeof obj.name !== 'string') return null;

    return {
      name: obj.name.trim(),
      description: typeof obj.description === 'string' ? obj.description.trim() : undefined,
      params:
        typeof obj.params === 'object' && obj.params !== null
          ? Object.fromEntries(Object.entries(obj.params).map(([k, v]) => [k, String(v)]))
          : {},
    };
  } catch {
    return null;
  }
}

/**
 * Last resort: recover a call from unstructured text, e.g. when the JSON braces
 * were eaten and only `execute_sql 查询描述 SELECT ...` survived.
 */
export function tryParseUnstructured(block: string): ParsedToolCall | null {
  const content = block.trim();
  if (!content) return null;

  for (const tool of SUPPORTED_TOOLS) {
    if (!content.startsWith(tool)) continue;
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

  return null;
}
