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
import type { AgentQuestion } from '../types';
import { LoopContext } from './context';
import { isAbortError } from './guards/abort';
import { awaitAIResponse } from './stages/await-response';
import { parseResponse } from './stages/parse-response';
import { executeTools } from './stages/execute-tools';
import { waitForUserAnswer } from './stages/ask-user-gate';
import { formatResults, ResultHandoff } from './stages/handoff';

export class AgentLoopEngine {
  private readonly ctx: LoopContext;
  private readonly handoff: ResultHandoff;

  /**
   * Sections that were produced but never delivered, because the user answered the
   * AI's question in the chat input instead of the tab. Their turn goes out ahead of
   * ours, so these ride along with the next round's payload rather than vanishing.
   */
  private carryOver: string[] = [];

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
    this.carryOver = [];
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

    /**
     * A turn that arrived while we were parked on a question and had already
     * finished before we noticed. Stage ① anchors on whatever turn exists when it
     * starts, so it would wait out its timeout for a reply that is already on screen.
     */
    let observed: HTMLElement | null = null;

    while (ctx.hasRoundsLeft()) {
      ctx.abort.check();

      if (ctx.atBreakpoint()) {
        ctx.pauseAtBreakpoint();
        return;
      }

      // ① Wait for the AI
      const response = observed ?? (await awaitAIResponse(ctx));
      observed = null;
      if (!response) return;
      ctx.abort.check();

      // ② Parse
      const parsed = parseResponse(ctx, response);
      if (parsed.kind === 'stalled') return;

      // It asked in prose instead of calling ask_user — salvaged into a question
      if (parsed.kind === 'ask-user') {
        const step = await this.askUser(parsed.question, [], []);
        if (step.stop) return;
        observed = step.response;
        continue;
      }

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

      // The AI wants a decision — park until it arrives, from either direction
      if (executed.kind === 'awaiting-user') {
        const step = await this.askUser(executed.question, executed.results, parsed.errors);
        if (step.stop) return;
        observed = step.response;
        continue;
      }

      // ④ Hand the results back
      const payload = formatResults(
        this.takeCarryOver(executed.results),
        parsed.errors,
        ctx.takePendingInstruction(),
      );
      if (!(await this.handoff.deliver(payload))) return;

      ctx.abort.check();
      ctx.advanceRound();

      if (!ctx.hasRoundsLeft()) {
        console.log('[AgentLoop] Max rounds reached');
        ctx.pauseAndEnd(
          `Reached maximum rounds (${ctx.maxRounds}). Continue?`,
          'max_rounds',
          ctx.round - 1,
        );
        return;
      }
    }
  }

  // ── Waiting on the user ────────────────────────────────────────────────────

  /**
   * Park on a question and act on however it gets answered.
   *
   * `response` comes back set when the user answered in the chat input and the AI's
   * reply had already finished — the next round must parse that instead of waiting
   * for a turn that has been and gone.
   *
   * The round is refunded either way: a round the user spent thinking is supervised
   * by definition, so charging it against `maxRounds` would let a few questions
   * exhaust the budget meant for actual work.
   */
  private async askUser(
    question: AgentQuestion,
    results: string[],
    errors: string[],
  ): Promise<{ stop: true } | { stop: false; response: HTMLElement | null }> {
    const ctx = this.ctx;
    const outcome = await waitForUserAnswer(ctx, question);

    if (outcome.kind === 'aborted') return { stop: true };

    ctx.grantBonusRound();

    if (outcome.kind === 'external') {
      // The answer reached the AI through the composer, so there is nothing to send
      // and no send to confirm — but these sections still haven't been delivered.
      this.carryOver.push(...results);
      ctx.advanceRound();
      ctx.events.emit('loop:round-started', { round: ctx.round });
      return { stop: false, response: outcome.response };
    }

    const payload = formatResults(
      this.takeCarryOver(results),
      errors,
      ctx.takePendingInstruction(),
      outcome.answer,
    );
    if (!(await this.handoff.deliver(payload))) return { stop: true };

    ctx.abort.check();
    ctx.advanceRound();
    return { stop: false, response: null };
  }

  /** Prepend anything still owed to the AI, and clear the debt */
  private takeCarryOver(results: string[]): string[] {
    if (this.carryOver.length === 0) return results;
    const merged = [...this.carryOver, ...results];
    this.carryOver = [];
    return merged;
  }
}
