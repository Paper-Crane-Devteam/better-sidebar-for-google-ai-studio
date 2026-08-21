/**
 * Tool call text parsing for the renderer.
 *
 * Delegates to the engine's parser rather than keeping a second implementation. The
 * copy that used to live here drifted: it did a plain `JSON.parse` with no repair
 * pass, so a block the engine could still salvage rendered as raw text — the user saw
 * a wall of JSON where a tool card belonged, and no approval button. Same input, same
 * verdict, in both places.
 */

import { TOOL_CALL_TAG } from '../constants';
import type { ParsedToolCall } from '../../types';
import { tryParseJson, tryParseUnstructured } from '../../engine/parser/fallbacks';

export interface ExtractedToolCall {
  toolCall: ParsedToolCall;
  rawText: string;
  matchString: string;
  startIndex: number;
  endIndex: number;
}

/** Strip the `<bs_agent_tool>` wrapper if there is one */
function unwrap(text: string): string {
  const tagRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`);
  const tagContent = text.match(tagRegex);
  return tagContent ? tagContent[1].trim() : text.trim();
}

/**
 * Parse a single tool call string or content block.
 */
export function parseToolCallFromText(text: string): ParsedToolCall | null {
  const content = unwrap(text);
  return tryParseJson(content) || tryParseUnstructured(content);
}

/**
 * Extract ALL tool calls from a response text, returning their parsed info and indices.
 */
export function parseAllToolCallsFromText(text: string): ExtractedToolCall[] {
  const tagRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`, 'g');
  const results: ExtractedToolCall[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const parsed = parseToolCallFromText(fullMatch);
    if (parsed) {
      results.push({
        toolCall: parsed,
        rawText: match[1].trim(),
        matchString: fullMatch,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
      });
    }
  }

  return results;
}

/**
 * Extract display info (toolName, description, query) from tool call text.
 *
 * `query` is whatever this call's headline param is — the SQL, the summary, or the id
 * list — since that is the one line the card shows before you expand it.
 */
export function extractToolInfo(text: string): {
  toolName: string;
  description: string;
  query: string;
  /**
   * The AI's plain-language account of what a write will change, when it gave one.
   *
   * Separate from `description`, which is a one-line label for the step. This is the
   * text the approval decision is actually made on — see `sql-provider`'s schema.
   */
  changeSummary: string;
} {
  const parsed = parseToolCallFromText(text);
  if (!parsed) return { toolName: 'tool_call', description: '', query: '', changeSummary: '' };

  const { params } = parsed;
  return {
    toolName: parsed.name || 'unknown',
    description: parsed.description || '',
    query: params.query || params.summary || params.conversation_ids || params.ids || '',
    changeSummary: (params.change_summary || '').trim(),
  };
}
