/**
 * Stage ② — turn the AI's text into tool calls, or decide what to do without any.
 *
 * The important rule lives here: **a response with no tool calls is not
 * completion.** The protocol ends with `complete_task`, so silence means the AI
 * either forgot the format, is waiting on the user, or is just talking. Treating it
 * as success is what once made a session announce "Task finished" on round 1 without
 * doing anything, so this stage nudges instead.
 *
 * What it does when nudging stops working changed, though. Pausing as a
 * circuit-breaker fault reported "the agent is stuck" for the commonest case by
 * far — the AI proposed something and waited for a human. So the last resort is now
 * to hand the response to the user as a question: worst case the loop ends in a
 * state a person can act on, instead of a dead end.
 */

import type { AgentQuestion, ParsedToolCall } from '../../types';
import type { LoopContext } from '../context';
import { parseToolCalls, hasUnclosedToolBlock } from '../parser';
import { buildFallbackQuestion, MAX_ASK_USER_PER_SESSION } from '../../tools/ask-user';

export type ParseOutcome =
  /** Normal path — hand these to stage ③ */
  | { kind: 'tool-calls'; toolCalls: ParsedToolCall[]; errors: string[] }
  /** No usable calls — send this text back to get the AI moving again */
  | { kind: 'nudge'; text: string }
  /** It asked in prose; park on it as a question rather than dead-ending */
  | { kind: 'ask-user'; question: AgentQuestion }
  /** Stalled past the threshold; the loop is already paused */
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
  ctx.countTokens(responseText);

  if (toolCalls.length > 0) {
    ctx.breaker.resetNoProgress();
    return { kind: 'tool-calls', toolCalls, errors };
  }

  const noProgress = ctx.breaker.recordNoToolResponse();
  // Counted either way, so repeated truncation still runs out of patience
  const truncated = hasUnclosedToolBlock(responseText);

  if (noProgress.action === 'stop') {
    const question = truncated ? null : buildFallbackQuestion(responseText);

    // Only while the asking budget lasts — otherwise an AI that never calls a tool
    // would bounce the user between the same unanswerable prompt forever.
    if (question && ctx.store.askUserCount < MAX_ASK_USER_PER_SESSION) {
      console.log('[AgentLoop] No tool calls after nudging — treating the reply as a question');
      return { kind: 'ask-user', question };
    }

    console.log('[AgentLoop] No-progress threshold reached, stopping');
    ctx.pauseAndEnd(noProgress.message, 'circuit_breaker');
    return { kind: 'stalled' };
  }

  if (truncated) {
    console.log('[AgentLoop] Response looks truncated mid tool call');
    return { kind: 'nudge', text: ctx.breaker.getTruncationGuidance() };
  }

  console.log('[AgentLoop] No tool calls, nudging AI');

  // Blocks were present but unparseable — tell the AI exactly what broke, otherwise
  // it has no way to know its formatting was the problem.
  const text =
    errors.length > 0
      ? `${noProgress.message}\n\n## Parse Errors\n\n${errors.map((e) => `- ${e}`).join('\n')}`
      : noProgress.message;

  return { kind: 'nudge', text };
}
