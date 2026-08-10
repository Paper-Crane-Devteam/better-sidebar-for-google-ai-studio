/**
 * Stage ② — turn the AI's text into tool calls, or decide the session is over.
 *
 * The important rule lives here: **a response with no tool calls is not
 * completion.** The protocol ends with `complete_task`, so silence means the AI
 * either drifted into prose or lost the format. Treating it as success is what once
 * made a session announce "Task finished" on round 1 without doing anything.
 *
 * But it isn't something to argue with either. Gemini only answers when it is sent
 * something, and stage ④ only sends when there are results — so "do nothing and
 * carry on" would leave stage ① waiting out its timeout on a turn that is never
 * coming. There is exactly one honest move: end the session and say why.
 *
 * The one exception is a response that *tried* to call a tool and produced garbage:
 * an unclosed block (the stream got cut) or JSON that won't parse. That is an
 * accident rather than a decision, so the breaker grants one retry per session.
 */

import type { ParsedToolCall } from '../../types';
import type { LoopContext } from '../context';
import { parseToolCalls, hasUnclosedToolBlock } from '../parser';

export type ParseOutcome =
  /** Normal path — hand these to stage ③ */
  | { kind: 'tool-calls'; toolCalls: ParsedToolCall[]; errors: string[] }
  /** A malformed block got its one retry — send this back to get a clean response */
  | { kind: 'nudge'; text: string }
  /** Nothing to run and nothing to send; the session is already ended */
  | { kind: 'stalled' };

export function parseResponse(ctx: LoopContext, responseElement: HTMLElement): ParseOutcome {
  ctx.setStatus('parsing');

  const responseText = ctx.adapter.extractResponseText(responseElement);
  const { toolCalls, errors } = parseToolCalls(responseText);

  console.log('[AgentLoop] Parsing response, length:', responseText.length);
  console.log(`[AgentLoop] Found ${toolCalls.length} tool calls, ${errors.length} errors`);

  ctx.events.emit('ai:response-received', {
    textLength: responseText.length,
    toolCallCount: toolCalls.length,
  });

  if (toolCalls.length > 0) {
    return { kind: 'tool-calls', toolCalls, errors };
  }

  // A block was attempted but came out unusable — worth one more try.
  const truncated = hasUnclosedToolBlock(responseText);

  if (truncated || errors.length > 0) {
    if (ctx.breaker.claimFormatRetry()) {
      console.log(
        `[AgentLoop] Malformed tool block (${truncated ? 'truncated' : 'unparseable'}), nudging once`,
      );
      return {
        kind: 'nudge',
        text: ctx.breaker.getFormatGuidance(truncated ? 'truncated' : 'unparseable', errors),
      };
    }

    console.log('[AgentLoop] Format retry budget spent, ending session');
    ctx.finish('no_tool_call');
    return { kind: 'stalled' };
  }

  // Plain prose. Nothing to execute, nothing to send — end here rather than wait on
  // a turn that cannot arrive.
  //
  // `finish`, not `pause`: pausing offers Retry, and retrying would re-enter stage ①
  // to wait out its timeout on that same absent turn.
  console.log('[AgentLoop] No tool calls in the response, ending session');
  ctx.finish('no_tool_call');
  return { kind: 'stalled' };
}
