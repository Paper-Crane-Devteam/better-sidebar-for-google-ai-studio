/**
 * Agent Loop — shared types.
 * Platform-agnostic type definitions for the Agent Loop feature.
 */

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * Loop status.
 *
 * `awaiting_send` is distinct from `paused`: it is the normal end of every round
 * (tool results are sitting in the editor, waiting to be sent back to the AI).
 * `paused` means something went wrong or the loop hit a guard (timeout,
 * breakpoint, circuit breaker, max rounds) and needs an explicit retry.
 */
export type AgentLoopStatus =
  | 'idle'
  | 'waiting_ai'
  | 'parsing'
  | 'executing'
  | 'sending'
  | 'awaiting_send'
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

/** Record of a tool call that has already run in the current session */
export interface ExecutedCall {
  toolName: string;
  /** Write operations must never run twice; reads may be repeated on request */
  isWrite: boolean;
  success: boolean;
  timestamp: number;
  /** 'engine' = automatic loop, 'manual' = the Run button in the conversation */
  source: 'engine' | 'manual';
}

/** Why a session ended — drives the completion card in the Agent tab */
export type AgentEndReason =
  | 'complete'
  | 'max_rounds'
  | 'user_stop'
  | 'error'
  | 'circuit_breaker'
  | 'paywall';

// ─── Built-in Prompts ────────────────────────────────────────────────────────

export interface BuiltInPrompt {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Returns the utility-specific prompt content (appended after base prompt) */
  getPromptContent: () => string;
}

// ─── Confirmation ────────────────────────────────────────────────────────────

export interface PendingConfirmation {
  sql: string;
  resolve: (confirmed: boolean) => void;
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
