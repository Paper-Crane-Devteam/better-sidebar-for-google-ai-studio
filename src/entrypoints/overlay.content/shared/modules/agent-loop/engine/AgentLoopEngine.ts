/**
 * Agent Loop Engine — the state machine, and nothing else.
 *
 * One round is four stages, and this file is only their ordering plus the
 * lifecycle entry points the UI calls (start / stop / resume / continueNow):
 *
 *   ① stages/await-response  wait for the AI to finish answering
 *   ② stages/parse-response  extract tool calls (or decide how to nudge)
 *   ③ stages/execute-tools   run them, guarded by the circuit breaker
 *   ④ stages/handoff         send the results back and confirm they left
 *
 * Everything the stages share — store, events, abort, circuit breaker — is reached
 * through `LoopContext`. Guards live in `guards/`, tool-call parsing in `parser/`.
 *
 * Two invariants worth knowing before changing anything here:
 *
 * - **A stage that already reported its own outcome returns a "stop" result.** When
 *   a stage pauses or ends the session it also emits the matching event, so the loop
 *   just returns instead of second-guessing it.
 * - **A failed handoff must stop the loop.** Continuing would wait for a reply to a
 *   message that was never delivered, which looks like a hang until the AI timeout.
 */

import type { AgentPlatformAdapter } from '../adapters/types';
import { LoopContext } from './context';
import { isAbortError } from './guards/abort';
import { awaitAIResponse } from './stages/await-response';
import { parseResponse } from './stages/parse-response';
import { executeTools } from './stages/execute-tools';
import { formatResults, ResultHandoff } from './stages/handoff';

export class AgentLoopEngine {
  private readonly ctx: LoopContext;
  private readonly handoff: ResultHandoff;

  constructor(adapter: AgentPlatformAdapter) {
    this.ctx = new LoopContext(adapter);
    this.handoff = new ResultHandoff(this.ctx);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Start a session. Call this once the initial prompt has been sent — round 1
   * begins by waiting for the answer to it.
   */
  async start(
    maxRounds: number = 20,
    session?: { conversationId?: string | null; title?: string },
  ): Promise<void> {
    this.ctx.abort.renew();
    this.ctx.breaker.reset();
    this.handoff.reset();
    this.ctx.store.start(maxRounds, session);

    console.log('[AgentLoop] Engine started, max rounds:', maxRounds);
    this.ctx.events.emit('loop:started', { maxRounds, timestamp: Date.now() });

    await this.run();
  }

  /** Stop the loop; the pending wait unwinds through its abort signal */
  stop(): void {
    console.log('[AgentLoop] Engine stopped by user');
    const totalRounds = this.ctx.round;
    this.ctx.abort.abort();
    this.ctx.finish('user_stop', totalRounds);
  }

  /**
   * Retry after a guard stopped the loop (timeout, breakpoint, circuit breaker, max
   * rounds) or after an error.
   *
   * If the previous round's results never went out they are sent first, otherwise
   * the loop would wait for an answer to a message the AI never received.
   */
  async resume(): Promise<void> {
    if (this.ctx.status !== 'paused' && this.ctx.status !== 'error') return;

    this.ctx.store.resume();
    this.ctx.abort.renew();

    if (this.handoff.hasPending()) {
      const sent = await this.handoff.resend().catch((e) => {
        if (isAbortError(e)) return false;
        throw e;
      });
      if (!sent) {
        this.ctx.pause('Could not send the staged results. Send them from the chat input.');
        return;
      }
      this.ctx.advanceRound();
    }

    await this.run();
  }

  /**
   * Send the results waiting at the `awaiting_send` checkpoint.
   * Only valid in that state — the running loop is already watching for the send.
   */
  async continueNow(): Promise<void> {
    if (this.ctx.status !== 'awaiting_send') return;

    if (!(await this.handoff.continueNow())) {
      // No payload in the composer, so there is no send button to click either.
      this.ctx.pause('The tool results are no longer in the chat input. Click "Retry" to re-send them.');
    }
  }

  // ── The loop ───────────────────────────────────────────────────────────────

  /** Wrap `runRounds` so an abort ends the session quietly and anything else reports */
  private async run(): Promise<void> {
    try {
      await this.runRounds();
    } catch (e) {
      if (isAbortError(e)) return;
      console.error('[AgentLoop] Engine error:', e);
      this.ctx.fail((e as Error).message);
    }
  }

  private async runRounds(): Promise<void> {
    const ctx = this.ctx;

    while (ctx.hasRoundsLeft()) {
      ctx.abort.check();

      if (ctx.atBreakpoint()) {
        ctx.pauseAtBreakpoint();
        return;
      }

      // ① Wait for the AI
      const response = await awaitAIResponse(ctx);
      if (!response) return;
      ctx.abort.check();

      // ② Parse
      const parsed = parseResponse(ctx, response);
      if (parsed.kind === 'stalled') return;

      // No usable tool calls: send a nudge and spend a round on it
      if (parsed.kind === 'nudge') {
        if (!(await this.handoff.deliver(parsed.text))) return;
        ctx.abort.check();
        ctx.advanceRound();
        continue;
      }

      // ③ Execute
      const executed = await executeTools(ctx, parsed.toolCalls);
      if (executed.kind === 'ended') return;

      // ④ Hand the results back
      const payload = formatResults(executed.results, parsed.errors, ctx.takePendingInstruction());
      if (!(await this.handoff.deliver(payload))) return;

      ctx.abort.check();
      ctx.advanceRound();

      if (!ctx.hasRoundsLeft()) {
        console.log('[AgentLoop] Max rounds reached');
        ctx.pauseAndEnd(
          `Reached maximum rounds (${ctx.maxRounds}). Continue?`,
          'max_rounds',
          ctx.maxRounds,
        );
        return;
      }
    }
  }
}
