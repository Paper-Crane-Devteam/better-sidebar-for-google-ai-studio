/**
 * Circuit Breaker for Agent Loop.
 *
 * Provides multi-layer protection against stuck loops:
 *
 * 1. **Loop Detection** — Detects when AI calls the same tool with identical
 *    params repeatedly (soft warning at 3, hard stop at 5).
 *
 * 2. **Consecutive Failure Tracking** — Counts errors in a row and escalates
 *    from retry → warning → forced pause.
 *
 * 3. **No-Progress Detection** — Detects when AI responds without tool calls
 *    multiple times (not making progress).
 *
 * Inspired by Cline's loop-detection.ts and TaskState patterns.
 */

import { agentEventBus } from '../event-bus';

// ─── Thresholds ──────────────────────────────────────────────────────────────

/** Soft threshold: inject a warning giving the AI one chance to self-correct */
export const LOOP_SOFT_THRESHOLD = 3;
/** Hard threshold: force stop the loop */
export const LOOP_HARD_THRESHOLD = 5;

/** Consecutive failures before escalating */
export const FAILURE_SOFT_THRESHOLD = 2;
export const FAILURE_HARD_THRESHOLD = 4;

/** Consecutive no-tool responses before pausing */
export const NO_PROGRESS_THRESHOLD = 3;

// ─── State ───────────────────────────────────────────────────────────────────

export interface CircuitBreakerState {
  // Loop detection
  lastToolName: string;
  lastToolParams: string;
  consecutiveIdenticalCount: number;

  // Failure tracking
  consecutiveFailures: number;
  totalFailures: number;

  // No-progress tracking
  consecutiveNoToolRounds: number;
}

function createInitialState(): CircuitBreakerState {
  return {
    lastToolName: '',
    lastToolParams: '',
    consecutiveIdenticalCount: 0,
    consecutiveFailures: 0,
    totalFailures: 0,
    consecutiveNoToolRounds: 0,
  };
}

// ─── Result Types ────────────────────────────────────────────────────────────

export type LoopCheckResult =
  | { action: 'ok' }
  | { action: 'warn'; message: string; count: number }
  | { action: 'stop'; message: string; count: number };

export type FailureCheckResult =
  | { action: 'retry'; message: string; count: number }
  | { action: 'warn'; message: string; count: number }
  | { action: 'stop'; message: string; count: number };

export type NoProgressResult =
  | { action: 'nudge'; message: string; count: number }
  | { action: 'stop'; message: string; count: number };

// ─── Circuit Breaker Class ───────────────────────────────────────────────────

export class CircuitBreaker {
  private state: CircuitBreakerState;

  constructor() {
    this.state = createInitialState();
  }

  /**
   * Compute a canonical signature for a tool call's params.
   * Ignores key order to prevent false negatives.
   */
  private toolCallSignature(params: Record<string, string>): string {
    const keys = Object.keys(params).sort();
    return JSON.stringify(params, keys);
  }

  /**
   * Check for repeated identical tool calls BEFORE executing.
   * Must be called before each tool execution.
   */
  checkRepeatedToolCall(toolName: string, params: Record<string, string>): LoopCheckResult {
    const signature = this.toolCallSignature(params);

    if (toolName === this.state.lastToolName && signature === this.state.lastToolParams) {
      this.state.consecutiveIdenticalCount++;
    } else {
      this.state.consecutiveIdenticalCount = 1;
    }

    this.state.lastToolName = toolName;
    this.state.lastToolParams = signature;

    const count = this.state.consecutiveIdenticalCount;

    if (count >= LOOP_HARD_THRESHOLD) {
      const message =
        `[CIRCUIT BREAKER] Tool "${toolName}" called ${count} times with identical arguments. ` +
        `Loop detected — stopping execution. The AI appears stuck in a repetitive pattern.`;

      agentEventBus.emit('circuit-breaker:loop-detected', {
        toolName,
        count,
        action: 'stop',
      });

      return { action: 'stop', message, count };
    }

    if (count >= LOOP_SOFT_THRESHOLD) {
      const message =
        `[WARNING] Tool "${toolName}" has been called ${count} times with identical arguments. ` +
        `This is not making progress. Please try a different approach or different arguments.`;

      agentEventBus.emit('circuit-breaker:loop-detected', {
        toolName,
        count,
        action: 'warn',
      });

      return { action: 'warn', message, count };
    }

    return { action: 'ok' };
  }

  /**
   * Record a tool execution result. Call after each tool completes.
   * Returns escalation advice if consecutive failures exceed thresholds.
   */
  recordToolResult(toolName: string, success: boolean, errorMessage?: string): FailureCheckResult | null {
    if (success) {
      // Reset failure counter on success
      this.state.consecutiveFailures = 0;
      // Also reset no-progress counter since tool was used and succeeded
      this.state.consecutiveNoToolRounds = 0;
      return null;
    }

    // Failure path
    this.state.consecutiveFailures++;
    this.state.totalFailures++;
    const count = this.state.consecutiveFailures;

    agentEventBus.emit('circuit-breaker:failure-recorded', {
      toolName,
      consecutiveCount: count,
      totalCount: this.state.totalFailures,
      errorMessage,
    });

    if (count >= FAILURE_HARD_THRESHOLD) {
      return {
        action: 'stop',
        message:
          `[CIRCUIT BREAKER] ${count} consecutive failures. The AI cannot recover from this error pattern. ` +
          `Pausing execution — please review the error and provide guidance.`,
        count,
      };
    }

    if (count >= FAILURE_SOFT_THRESHOLD) {
      return {
        action: 'warn',
        message:
          `[WARNING] ${count} consecutive failures detected. ` +
          `You've tried this approach multiple times without success. ` +
          `Try a fundamentally different approach: check the schema with SELECT, use simpler queries, or explain the problem to the user.`,
        count,
      };
    }

    return {
      action: 'retry',
      message: `Tool execution failed. Analyze the error and try a corrected approach.`,
      count,
    };
  }

  /**
   * Record a round where AI produced no tool calls.
   * Always returns a decision: nudge first, stop once the threshold is reached.
   *
   * A tool-less response is never treated as success. The protocol requires the
   * AI to end with `complete_task`, so "no tool calls" means it either forgot the
   * format or is just talking. Returning `null` here used to make the engine call
   * the session complete — which is why a task could report "Task finished" on its
   * very first round without having done anything.
   */
  recordNoToolResponse(): NoProgressResult {
    this.state.consecutiveNoToolRounds++;
    const count = this.state.consecutiveNoToolRounds;

    agentEventBus.emit('circuit-breaker:no-progress', { consecutiveCount: count });

    if (count >= NO_PROGRESS_THRESHOLD) {
      return {
        action: 'stop',
        message:
          `AI responded without tool calls ${count} times. ` +
          `Task may be stuck or complete. Please review and provide direction.`,
        count,
      };
    }

    return {
      action: 'nudge',
      message:
        `[System] Your last response contained no <bs_agent_tool> block. ` +
        `If the task is fully done, call complete_task with a summary. ` +
        `Otherwise use a tool to continue making progress.`,
      count,
    };
  }

  /**
   * Reset no-progress counter (call when AI does use tools).
   */
  resetNoProgress(): void {
    this.state.consecutiveNoToolRounds = 0;
  }

  /**
   * Get progressive error message based on consecutive failure count.
   * Useful for formatting tool error responses back to the AI.
   */
  getProgressiveErrorGuidance(baseError: string): string {
    const count = this.state.consecutiveFailures;

    if (count >= 3) {
      return (
        `${baseError}\n\n` +
        `CRITICAL: You have failed ${count} times in a row. You MUST change your approach:\n` +
        `1. Run "SELECT name FROM sqlite_master WHERE type='table'" to verify table names\n` +
        `2. Run "PRAGMA table_info(table_name)" — wait, PRAGMA is blocked. Use "SELECT sql FROM sqlite_master WHERE name='table_name'" instead\n` +
        `3. Break your operation into smaller, simpler steps\n` +
        `4. If still stuck, explain the problem to the user`
      );
    }

    if (count >= 2) {
      return (
        `${baseError}\n\n` +
        `This is your ${count}nd consecutive failure. Consider:\n` +
        `- Are table/column names correct? Query sqlite_master to verify.\n` +
        `- Is the SQL syntax valid for SQLite?\n` +
        `- Try a simpler query first to confirm data exists.`
      );
    }

    return `${baseError}\n\nSuggestion: Double-check table and column names against the schema.`;
  }

  /** Get current state snapshot (for debugging / UI) */
  getState(): Readonly<CircuitBreakerState> {
    return { ...this.state };
  }

  /** Full reset (e.g., on new agent loop start) */
  reset(): void {
    this.state = createInitialState();
    agentEventBus.emit('circuit-breaker:reset', undefined);
  }
}
