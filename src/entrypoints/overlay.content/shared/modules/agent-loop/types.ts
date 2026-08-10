/**
 * Agent Loop — shared types.
 * Platform-agnostic type definitions for the Agent Loop feature.
 */

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * Loop status.
 *
 * Two of these are checkpoints rather than faults, and the distinction from
 * `paused` is load-bearing for the UI:
 *
 * - `awaiting_send` — the normal end of every round; tool results are sitting in
 *   the editor waiting to go back to the AI.
 * - `awaiting_user` — the AI called `ask_user` and needs a decision only a human
 *   can make. Nothing is wrong; the loop is deliberately parked.
 *
 * `paused` means something went wrong or the loop hit a guard (timeout,
 * breakpoint, circuit breaker, max rounds) and needs an explicit retry.
 */
export type AgentLoopStatus =
  | 'idle'
  | 'waiting_ai'
  | 'parsing'
  | 'executing'
  | 'awaiting_approval'
  | 'sending'
  | 'awaiting_send'
  | 'awaiting_user'
  | 'paused'
  | 'error';

// ─── Tool Calls ──────────────────────────────────────────────────────────────

export interface ParsedToolCall {
  name: string;
  /** Human-readable description of what this tool call does (shown to user) */
  description?: string;
  params: Record<string, string>;
}

export interface ParseResult {
  toolCalls: ParsedToolCall[];
  errors: string[];
}

export interface ToolCallResult {
  toolName: string;
  /**
   * The AI's own human-readable description of this step
   * ("Create folder Coding"). Preferred over `toolName` in the UI.
   */
  description?: string;
  success: boolean;
  result: string;
  timestamp: number;
}

/**
 * What became of a tool call in this session.
 *
 * Display only, now that the engine is the sole thing that executes: the card in the
 * chat uses it to show "ran" / "refused" instead of an actionable button. It used to
 * be a guard against the manual Run button repeating work the engine had done.
 */
export interface ExecutedCall {
  toolName: string;
  isWrite: boolean;
  success: boolean;
  /** True when the user refused it, as opposed to it running and failing */
  rejected?: boolean;
  timestamp: number;
  source: 'engine';
}

/**
 * Why a session ended — drives the completion card in the Agent tab.
 *
 * `infeasible` is not an error: the AI decided the request cannot be carried out
 * (missing data, no suitable tool) and said so through `complete_task`. Without a
 * reason of its own, that verdict used to fall into the no-tool-call path, where
 * the nudge pushed an AI that already knew better to keep guessing.
 */
export type AgentEndReason =
  | 'complete'
  | 'infeasible'
  | 'max_rounds'
  | 'user_stop'
  | 'error'
  | 'circuit_breaker'
  | 'paywall';

/** How much of the request `complete_task` claims to have delivered */
export type TaskOutcome = 'success' | 'partial' | 'infeasible';

// ─── Built-in Prompts ────────────────────────────────────────────────────────

export interface BuiltInPrompt {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Returns the utility-specific prompt content (appended after base prompt) */
  getPromptContent: () => string;
}

// ─── Approval ────────────────────────────────────────────────────────────────

/** Whether a tool call touches data or only looks at it */
export type ToolRisk = 'read' | 'write';

/**
 * How far an approval reaches.
 *
 * `round` exists because a response often carries several reads: approving five
 * SELECTs one at a time is the kind of friction that makes people switch the whole
 * safety net off.
 */
export type ApprovalScope = 'once' | 'round' | 'task';

/**
 * Answer to an approval request.
 *
 * The reason matters on a rejection: told only `CANCELLED:`, the AI's most likely
 * next move is to send the same statement again and trip the loop detector.
 */
export interface ApprovalDecision {
  approved: boolean;
  scope: ApprovalScope;
  /** Optional explanation, passed back to the AI when the user says no */
  reason?: string;
}

/**
 * A tool call waiting for the user's go-ahead.
 *
 * `fingerprint` is what lets the card in the chat know it is the one being asked
 * about — approval happens next to the call you are reading, not in a separate
 * dialog describing it second-hand.
 */
export interface PendingApproval {
  fingerprint: string;
  toolName: string;
  description?: string;
  params: Record<string, string>;
  risk: ToolRisk;
  /** Calls left in this response, so "approve the rest" can say how many */
  remaining: number;
  resolve: (decision: ApprovalDecision) => void;
}

// ─── Asking the user ─────────────────────────────────────────────────────────

/**
 * A decision the loop cannot make on its own.
 *
 * This is a different axis from `PendingConfirmation`, and they are meant to
 * coexist: a question is about *what to do* (which the AI raises, and only the
 * user can answer), while a confirmation is about *whether this specific
 * operation may run* (which the extension raises, and the user can switch off).
 * Approving a plan therefore grants no execution permission.
 */
export interface AgentQuestion {
  question: string;
  /** Preset answers rendered as buttons; empty means free text only */
  options: string[];
  allowFreeText: boolean;
  /**
   * `tool` — the AI called `ask_user`.
   * `fallback` — it asked in prose and we salvaged the question so the round
   * doesn't dead-end.
   */
  source: 'tool' | 'fallback';
}

export interface PendingQuestion extends AgentQuestion {
  askedAt: number;
  /** Answer text, or null when the wait was cancelled */
  resolve: (answer: string | null) => void;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AgentLoopSettings {
  /** Feature toggle */
  enabled: boolean;
  /** Whether non-SELECT operations require user confirmation */
  confirmWrites: boolean;
  /** Maximum loop rounds before auto-pause */
  maxRounds: number;
}

// ─── Trigger State ───────────────────────────────────────────────────────────
// See useAgentTrigger.ts → AgentTriggerPopupState
