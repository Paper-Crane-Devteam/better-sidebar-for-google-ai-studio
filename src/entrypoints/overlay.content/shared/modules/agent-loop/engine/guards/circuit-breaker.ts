/**
 * Circuit Breaker for Agent Loop.
 *
 * Provides multi-layer protection against stuck loops:
 *
 * 1. **Loop Detection** — Detects when AI calls the same tool with identical
 *    params repeatedly (soft warning at 3, hard stop at 5).
 *
 * 2. **Consecutive Failure Tracking** — Counts failing *rounds* in a row (not
 *    individual calls) and escalates from retry → warning → forced pause.
 *
 * 3. **Format Retry Budget** — One second chance per session for a response that
 *    tried to call a tool and produced something unparseable.
 *
 * Inspired by Cline's loop-detection.ts and TaskState patterns.
 */

import { agentEventBus } from '../../event-bus';

// ─── Thresholds ──────────────────────────────────────────────────────────────

/** Soft threshold: inject a warning giving the AI one chance to self-correct */
export const LOOP_SOFT_THRESHOLD = 3;
/** Hard threshold: force stop the loop */
export const LOOP_HARD_THRESHOLD = 5;

/**
 * Consecutive failing **rounds** before escalating.
 *
 * Rounds, not calls: a response may carry up to five statements, and if the AI has
 * guessed a column name wrong they all fail together — one mistake, five errors. The
 * AI hasn't had a chance to react to any of them yet, so counting them separately
 * punished a single misunderstanding. Four calls in one response used to trip the
 * hard stop on round 1.
 *
 * Six gives five rounds of escalating hints before giving up, so the guidance in
 * `getProgressiveErrorGuidance` actually gets a chance to land.
 */
export const FAILURE_SOFT_THRESHOLD = 2;
export const FAILURE_HARD_THRESHOLD = 6;

/**
 * How many format accidents get a second chance per session.
 *
 * One. A response cut off mid tool call, or a tool block whose JSON won't parse, is
 * worth re-asking for once — it is usually a truncated stream rather than a model
 * that misunderstood. Past that, re-sending the same instruction is just burning
 * rounds, so the session ends and the user decides.
 */
export const FORMAT_RETRY_BUDGET = 1;

// ─── State ───────────────────────────────────────────────────────────────────

export interface CircuitBreakerState {
  // Loop detection
  lastToolName: string;
  lastToolParams: string;
  consecutiveIdenticalCount: number;

  // Failure tracking — counted per round, see FAILURE_HARD_THRESHOLD
  /** Rounds in a row that produced at least one failing tool call */
  consecutiveFailedRounds: number;
  /** Every failing call, for reporting only */
  totalFailures: number;
  /** Whether the round in progress has already been counted */
  roundFailureCounted: boolean;

  /** Malformed tool blocks nudged about so far this session */
  formatRetries: number;
}

function createInitialState(): CircuitBreakerState {
  return {
    lastToolName: '',
    lastToolParams: '',
    consecutiveIdenticalCount: 0,
    consecutiveFailedRounds: 0,
    totalFailures: 0,
    roundFailureCounted: false,
    formatRetries: 0,
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
    const soft = LOOP_SOFT_THRESHOLD;
    const hard = LOOP_HARD_THRESHOLD;

    if (count >= hard) {
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

    if (count >= soft) {
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
   * Start of a round — lets the next failure count against the budget again.
   * Called by stage ③ before it executes anything.
   */
  beginRound(): void {
    this.state.roundFailureCounted = false;
  }

  /**
   * Record a tool execution result. Call after each tool completes.
   * Returns escalation advice once consecutive failing rounds cross a threshold.
   *
   * Only the **first** failure of a round moves the counter. The rest of that
   * response is the same mistake seen several times over — the AI has had no chance
   * to read any of it yet, so charging it per call meant one wrong column name in a
   * five-statement response could exhaust the whole budget at once.
   */
  recordToolResult(toolName: string, success: boolean, errorMessage?: string): FailureCheckResult | null {
    if (success) {
      this.state.consecutiveFailedRounds = 0;
      // Also clears the round mark, so a later failure in this same round still
      // registers instead of being swallowed as "already counted".
      this.state.roundFailureCounted = false;
      return null;
    }

    this.state.totalFailures++;

    if (!this.state.roundFailureCounted) {
      this.state.roundFailureCounted = true;
      this.state.consecutiveFailedRounds++;
    }

    const count = this.state.consecutiveFailedRounds;

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
          `[CIRCUIT BREAKER] ${count} responses in a row have failed. The AI cannot recover from this ` +
          `error pattern. Pausing execution — please review the error and provide guidance.`,
        count,
      };
    }

    if (count >= FAILURE_SOFT_THRESHOLD) {
      return {
        action: 'warn',
        message:
          `[WARNING] ${count} responses in a row have failed. ` +
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
   * Claim one of the session's format retries. False when the budget is spent.
   *
   * Only called for a response that *tried* to call a tool and produced something
   * unusable — a block cut off mid-stream, or JSON that won't parse. A response that
   * simply contains no tool call at all is not a format accident and gets no retry:
   * the engine ends the session, because Gemini won't speak again unless we send
   * something, and nudging an AI that has drifted into prose mostly teaches it to
   * guess.
   */
  claimFormatRetry(): boolean {
    if (this.state.formatRetries >= FORMAT_RETRY_BUDGET) return false;
    this.state.formatRetries++;
    agentEventBus.emit('circuit-breaker:format-retry', { count: this.state.formatRetries });
    return true;
  }

  /**
   * The nudge sent after claiming a retry.
   *
   * Truncation gets its own wording on purpose: told "you forgot the tool format",
   * the AI restarts its whole response, which burns a round and can repeat work it
   * had already emitted. Told "you were cut off", it re-sends only the tail.
   */
  getFormatGuidance(kind: 'truncated' | 'unparseable', errors: string[] = []): string {
    if (kind === 'truncated') {
      return (
        `[System] Your last response ended inside an unclosed <bs_agent_tool> block, so it was cut off ` +
        `before the tool call was complete. Nothing from that block was executed. ` +
        `Re-send only the tool calls that were incomplete, and keep the response short enough to finish — ` +
        `emit fewer calls per response if needed.`
      );
    }

    const detail = errors.length > 0 ? `\n\n## Parse Errors\n\n${errors.map((e) => `- ${e}`).join('\n')}` : '';

    return (
      `[System] Your last response contained <bs_agent_tool> blocks that could not be parsed, so nothing ` +
      `was executed. Re-send them as valid JSON with "name", "description" and "params" fields.${detail}`
    );
  }

  /**
   * Get progressive error message based on consecutive failure count.
   * Useful for formatting tool error responses back to the AI.
   */
  getProgressiveErrorGuidance(baseError: string): string {
    const count = this.state.consecutiveFailedRounds;

    if (count >= 3) {
      return (
        `${baseError}\n\n` +
        `CRITICAL: ${count} of your responses in a row have failed. You MUST change your approach:\n` +
        `1. Run "SELECT name FROM sqlite_master WHERE type='table'" to verify table names\n` +
        `2. Run "PRAGMA table_info(table_name)" — wait, PRAGMA is blocked. Use "SELECT sql FROM sqlite_master WHERE name='table_name'" instead\n` +
        `3. Break your operation into smaller, simpler steps\n` +
        `4. If still stuck, explain the problem to the user`
      );
    }

    if (count >= 2) {
      return (
        `${baseError}\n\n` +
        `This is the ${count}th response in a row that has failed. Consider:\n` +
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
