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

  const direct = buildCall(trimmed);
  if (direct) return direct;

  // Second pass on a repaired copy. Only reached when the block is already broken,
  // which is what keeps the repair from touching correctly-escaped JSON.
  const repaired = unquoteJsonArrays(trimmed);
  return repaired === trimmed ? null : buildCall(repaired);
}

function buildCall(json: string): ParsedToolCall | null {
  try {
    const obj = JSON.parse(json);
    if (typeof obj.name !== 'string') return null;

    return {
      name: obj.name.trim(),
      description: typeof obj.description === 'string' ? obj.description.trim() : undefined,
      params:
        typeof obj.params === 'object' && obj.params !== null
          ? Object.fromEntries(Object.entries(obj.params).map(([k, v]) => [k, asParamValue(v)]))
          : {},
    };
  } catch {
    return null;
  }
}

/**
 * Params are strings by the time a tool sees them, so anything richer is serialised.
 *
 * `JSON.stringify` rather than `String`: a real array has to survive as
 * `["a","b"]`, not `a,b` — the tools that take lists parse their value as JSON.
 */
function asParamValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * Unwrap a JSON array that was wrapped in quotes without escaping its contents.
 *
 * The failure this exists for, seen with a 50-id list:
 *
 *     "params": {"conversation_ids": "["id1","id2"]"}
 *
 * A param declared as "a JSON array, as a string" asks the model to nest one quoting
 * level inside another, and that is a coin flip it loses regularly — the inner quotes
 * come through unescaped and `JSON.parse` rejects the whole block, so a 50-conversation
 * call executes nothing. The schemas now ask for a real array instead, and this catches
 * the ones still written the old way: strip the quotes around the brackets and the
 * array parses as itself.
 */
function unquoteJsonArrays(json: string): string {
  return json.replace(/"\s*(\[[\s\S]*?\])\s*"/g, '$1');
}

/**
 * A hint for the AI about *why* its JSON was rejected.
 *
 * The generic "re-send as valid JSON" told it nothing it didn't already believe, so
 * the observed behaviour was to re-send the identical text and burn the session's one
 * format retry. Naming the specific mistake is what makes the retry worth having.
 */
export function describeJsonFault(block: string): string | null {
  if (/"\s*\[/.test(block)) {
    return (
      'a list param was wrapped in quotes (`"ids": "[...]"`), which leaves the inner quotes ' +
      'unescaped and breaks the whole block — pass a real JSON array instead: `"ids": ["a","b"]`'
    );
  }
  return null;
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
