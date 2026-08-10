/**
 * Stage ① — wait for the AI's answer to finish streaming.
 *
 * All the hard detection work lives in the platform adapter; this stage only owns
 * the timeout policy and the status/event bookkeeping around it.
 */

import type { LoopContext } from '../context';

/**
 * How long the page may show **no sign of life** before the loop gives up.
 *
 * Idle time, not total time: the adapter pushes this back on every sign the turn is
 * alive (text growing, composer button reading "stop generating"). So a model that
 * thinks for ten minutes and then writes for another five never trips it, and only
 * real silence does.
 *
 * This used to be a total timeout of 60s, which killed long answers mid-generation
 * and reported them as "AI response timed out" — a Pro model with thinking on passes
 * 60s routinely.
 *
 * A timeout is still needed, because the completion signal can genuinely never
 * arrive: Gemini erroring out or rate-limiting means no turn ever completes, and
 * `getSendButtonState()` can degrade to `'unknown'` if Gemini renames its classes.
 * Without this the engine would sit in `waiting_ai` forever with only Stop as a way
 * out, and no explanation.
 */
export const RESPONSE_IDLE_TIMEOUT_MS = 30000;

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
    return await ctx.adapter.observeAIResponseComplete(RESPONSE_IDLE_TIMEOUT_MS);
  } catch {
    console.warn('[AgentLoop] AI response went silent');
    ctx.events.emit('ai:response-timeout', { timeoutMs: RESPONSE_IDLE_TIMEOUT_MS });
    ctx.pause(
      `No response from the AI for ${RESPONSE_IDLE_TIMEOUT_MS / 1000}s. Click "Retry" to try again.`,
      'AI response timeout',
    );
    return null;
  }
}
