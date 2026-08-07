/**
 * Stage ① — wait for the AI's answer to finish streaming.
 *
 * All the hard detection work lives in the platform adapter; this stage only owns
 * the timeout policy and the status/event bookkeeping around it.
 */

import type { LoopContext } from '../context';

/** How long a single turn may take before the loop gives up on it */
export const RESPONSE_TIMEOUT_MS = 60000;

/**
 * Resolve with the response element, or null when it timed out — in which case
 * the loop is already paused with a reason and the caller should just return.
 */
export async function awaitAIResponse(ctx: LoopContext): Promise<HTMLElement | null> {
  ctx.setStatus('waiting_ai');
  ctx.events.emit('ai:response-waiting', undefined);
  ctx.events.emit('loop:round-started', { round: ctx.round });
  console.log(`[AgentLoop] Round ${ctx.round}: Waiting for AI response...`);

  try {
    return await ctx.adapter.observeAIResponseComplete(RESPONSE_TIMEOUT_MS);
  } catch {
    console.warn('[AgentLoop] AI response timeout');
    ctx.events.emit('ai:response-timeout', { timeoutMs: RESPONSE_TIMEOUT_MS });
    ctx.pause(
      `AI response timed out (${RESPONSE_TIMEOUT_MS / 1000}s). Click "Retry" to try again.`,
      'AI response timeout',
    );
    return null;
  }
}
