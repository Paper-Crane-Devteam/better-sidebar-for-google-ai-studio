/**
 * Splitting a model turn into the parts that get rendered: prose, and the tool cards
 * embedded in it.
 *
 * Two callers need the same split and must not disagree about it — the response
 * component, which renders the parts, and the session-end marker, which stays quiet
 * whenever the turn produced prose of its own (otherwise the completion summary
 * restates the paragraph it sits directly beneath). Deriving "did it say anything"
 * separately from "what does it say" is exactly the kind of pair that drifts, so
 * there is one function and the other is a question asked of its output.
 */

import { isHiddenTool } from '../constants';
import type { DisplayMessageTurn } from '../useConversationMessages';
import type { ExtractedToolCall } from './tool-parser';

export type TurnPart =
  | {
      kind: 'text';
      text: string;
      /** Last part of the turn, i.e. nothing follows it — margins go the other way */
      trailing: boolean;
    }
  | { kind: 'tool'; index: number; call: ExtractedToolCall };

/**
 * Drop a fence marker left stranded by lifting a tool call out of the prose.
 *
 * The prompt asks for bare `<bs_agent_tool>` tags, but models like to wrap them in a
 * code block anyway. Cutting the tag out of the middle then leaves the opening fence
 * at the tail of one segment and the closing fence at the head of the next, which
 * would swallow everything after it as code.
 *
 * Only an odd fence count can be stranded, so a balanced segment is left be.
 */
function stripOrphanFence(text: string): string {
  const fences = text.match(/^ *`{3,}[^\n]*$/gm)?.length ?? 0;
  if (fences % 2 === 0) return text;
  // Exactly one marker goes: the stranded closing fence always leads the segment
  // after a tool call, the stranded opening fence always trails the segment before
  // it. Removing both would unbalance a real code block that happens to sit in the
  // same segment.
  const leading = /^\n* *`{3,}[^\n]*\n*/;
  return leading.test(text)
    ? text.replace(leading, '\n')
    : text.replace(/\n* *`{3,}[^\n]*\n*$/, '\n');
}

/**
 * Interleave the turn's prose with its visible tool calls, in reading order.
 *
 * Prose is buffered rather than emitted per tool call, so a hidden tool leaves no
 * seam: the text on either side of it merges back into one markdown part instead of
 * two with a gap where the card would have been. A hidden call still consumes its
 * span, or the raw `<bs_agent_tool>` block leaks into the markdown around it.
 *
 * Empty prose is dropped, which is why a turn that is nothing but a fenced tool block
 * yields no text part at all — the common shape, since models fence the tag far more
 * often than they narrate it.
 */
export function splitTurnContent(message: DisplayMessageTurn): TurnPart[] {
  const parts: TurnPart[] = [];

  let pending = '';
  const flush = (trailing: boolean) => {
    const text = stripOrphanFence(pending);
    pending = '';
    if (!text.trim()) return;
    parts.push({ kind: 'text', text, trailing });
  };

  if (message.toolCalls.length === 0) {
    // displayText rather than rawText: for a user turn the two differ, and this stays
    // callable on one even though only model turns carry tool calls.
    pending = message.displayText;
    flush(true);
    return parts;
  }

  let lastIndex = 0;
  message.toolCalls.forEach((call, index) => {
    pending += message.rawText.slice(lastIndex, call.startIndex);
    lastIndex = call.endIndex;

    if (isHiddenTool(call.toolCall.name)) return;

    flush(false);
    parts.push({ kind: 'tool', index, call });
  });

  pending += message.rawText.slice(lastIndex);
  flush(true);

  return parts;
}

/** Whether the turn says anything in its own words, beyond the tool calls it carries */
export function hasOwnProse(message: DisplayMessageTurn): boolean {
  if (message.role !== 'model') return false;
  return splitTurnContent(message).some((part) => part.kind === 'text');
}
