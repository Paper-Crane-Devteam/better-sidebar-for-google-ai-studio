/**
 * Agent Loop — shared types.
 * Platform-agnostic type definitions for the Agent Loop feature.
 */

// ─── Status ──────────────────────────────────────────────────────────────────

export type AgentLoopStatus =
  | 'idle'
  | 'waiting_ai'
  | 'parsing'
  | 'executing'
  | 'sending'
  | 'paused'
  | 'error';

// ─── Tool Calls ──────────────────────────────────────────────────────────────

export interface ParsedToolCall {
  name: string;
  params: Record<string, string>;
}

export interface ParseResult {
  toolCalls: ParsedToolCall[];
  errors: string[];
}

export interface ToolCallResult {
  toolName: string;
  success: boolean;
  result: string;
  timestamp: number;
}

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

export interface AgentTriggerState {
  isOpen: boolean;
  query: string;
  triggerPosition: number;
  matches: BuiltInPrompt[];
  selectedIndex: number;
}
