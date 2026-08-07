/**
 * Stage ② — turn the AI's text into tool calls, or decide what to do without any.
 *
 * The important rule lives here: **a response with no tool calls is not
 * completion.** The protocol ends with `complete_task`, so silence means the AI
 * either forgot the format or is just talking. Treating it as success is what once
 * made a session announce "Task finished" on round 1 without doing anything, so
 * this stage nudges instead, and only gives up once the circuit breaker says the
 * AI has stalled for good.
 */

import type { ParsedToolCall } from '../../types';
import type { LoopContext } from '../context';
import { parseToolCalls } from '../parser';

export type ParseOutcome =
  /** Normal path — hand these to stage ③ */
  | { kind: 'tool-calls'; toolCalls: ParsedToolCall[]; errors: string[] }
  /** No usable calls — send this text back to get the AI moving again */
  | { kind: 'nudge'; text: string }
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

  if (noProgress.action === 'stop') {
    console.log('[AgentLoop] No-progress threshold reached, stopping');
    ctx.pauseAndEnd(noProgress.message, 'circuit_breaker');
    return { kind: 'stalled' };
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
