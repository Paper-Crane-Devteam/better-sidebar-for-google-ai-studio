/**
 * LoopContext — the one thing every stage depends on.
 *
 * A round's stages all need the same four collaborators: the platform adapter, the
 * Zustand store, the event bus, and the abort token. Passing them around
 * individually meant `useAgentLoopStore.getState().x` and a paired
 * `agentEventBus.emit(...)` at every turn, which is what buried the actual loop
 * logic in the original single-file engine.
 *
 * So this is a deliberately thin facade: no decisions of its own, just the store +
 * event pairs that must stay in sync (pause always emits `loop:paused`, ending
 * always emits `loop:ended`). Stages express intent; the bookkeeping lives here.
 */

import type { AgentPlatformAdapter } from '../adapters/types';
import type { AgentEndReason, AgentLoopStatus } from '../types';
import { useAgentLoopStore } from '../agent-loop-store';
import { agentEventBus } from '../event-bus';
import { AbortToken } from './guards/abort';
import { CircuitBreaker } from './guards/circuit-breaker';

export class LoopContext {
  /** Typed pub/sub — stages emit through `ctx.events.emit(...)` */
  readonly events = agentEventBus;

  /** Session-scoped guard against stuck loops; survives pause/resume, reset on start */
  readonly breaker = new CircuitBreaker();

  /** Cancellation for the current run */
  readonly abort = new AbortToken();

  constructor(readonly adapter: AgentPlatformAdapter) {}

  // ── Store access ───────────────────────────────────────────────────────────

  /** Always read fresh: the UI mutates this store while the loop runs */
  get store() {
    return useAgentLoopStore.getState();
  }

  get status(): AgentLoopStatus {
    return this.store.status;
  }

  get round(): number {
    return this.store.currentRound;
  }

  get maxRounds(): number {
    return this.store.maxRounds;
  }

  /**
   * The budget is `maxRounds` plus whatever was spent waiting on the user.
   * Those rounds are supervised by definition, so they can't run away — charging
   * them would let a couple of questions exhaust a session before the work starts.
   */
  get roundBudget(): number {
    return this.maxRounds + this.store.bonusRounds;
  }

  hasRoundsLeft(): boolean {
    return this.round <= this.roundBudget;
  }

  /** Refund the round a question consumed */
  grantBonusRound(): void {
    this.store.grantBonusRound();
  }

  setStatus(status: AgentLoopStatus): void {
    this.store.setStatus(status);
  }

  editor(): HTMLElement | null {
    return this.adapter.getEditor();
  }

  /** Rough char-based token accounting for the tab's usage readout */
  countTokens(text: string): void {
    this.store.addTokens(Math.round(text.length * 0.25));
  }

  /** Read and clear the instruction the user typed while the loop was running */
  takePendingInstruction(): string | null {
    const instruction = this.store.pendingInstruction;
    if (instruction) this.store.setPendingInstruction(null);
    return instruction;
  }

  // ── Round transitions ──────────────────────────────────────────────────────

  /** Whether this round is the one the user asked to stop at */
  atBreakpoint(): boolean {
    const breakpoint = this.store.breakpointRound;
    return breakpoint !== null && this.round === breakpoint;
  }

  /** Pause at a breakpoint and disarm it, so resuming doesn't re-trigger */
  pauseAtBreakpoint(): void {
    this.store.pause('已到达断点轮次');
    this.store.setBreakpointRound(null);
    this.events.emit('loop:paused', { reason: 'breakpoint' });
  }

  /** Move to the next round, clearing the `awaiting_send` checkpoint state */
  advanceRound(): void {
    this.store.resume();
    this.events.emit('loop:resumed', undefined);
    this.store.nextRound();
  }

  // ── Terminal transitions ───────────────────────────────────────────────────

  /**
   * Stop and wait for the user. Recoverable: the Agent tab offers Retry, which
   * calls `engine.resume()`.
   */
  pause(reason: string, eventReason = reason): void {
    this.store.pause(reason);
    this.events.emit('loop:paused', { reason: eventReason });
  }

  /** Pause *and* declare the session over — guards that shouldn't silently retry */
  pauseAndEnd(reason: string, endReason: AgentEndReason, totalRounds = this.round): void {
    this.store.pause(reason);
    this.events.emit('loop:ended', { reason: endReason, totalRounds });
  }

  /** Clean end of a session (complete_task, paywall, user stop) */
  finish(endReason: AgentEndReason, totalRounds = this.round): void {
    this.store.stop(endReason);
    this.events.emit('loop:ended', { reason: endReason, totalRounds });
  }

  /** Report an engine-level exception */
  fail(message: string): void {
    this.store.setError(message);
    this.events.emit('loop:ended', { reason: 'error', totalRounds: this.round });
  }
}
