/**
 * Execution policy — decides which tool calls need user confirmation,
 * plus token estimation helpers.
 *
 * Policy (from least to most permissive):
 * - confirm_all    : every tool call needs confirmation
 * - confirm_writes : reads run automatically, writes ask (default)
 * - speed          : nothing asks (session-scoped opt-in)
 *
 * Moved out of the removed `control-panel/` directory — this logic is live and
 * consumed by tools/execute-sql.ts.
 */

import type { ParsedToolCall } from './types';
import { useAgentLoopStore } from './agent-loop-store';
import { useAgentPolicyStore } from './agent-policy-store';

// ─── Token Estimation ────────────────────────────────────────────────────────

/**
 * Estimate token count from text using a character-based heuristic.
 * CJK characters: ~2 chars/token. Other characters: ~4 chars/token.
 */
export function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(char)) {
      tokens += 0.5;
    } else {
      tokens += 0.25;
    }
  }
  return Math.round(tokens);
}

/** Format token count for compact display: "~800", "~2.3k", "~1.2M" */
export function formatTokenCount(count: number): string {
  if (count < 1000) return `~${count}`;
  if (count < 1000000) return `~${(count / 1000).toFixed(1)}k`;
  return `~${(count / 1000000).toFixed(1)}M`;
}

// ─── Confirmation Strategy ───────────────────────────────────────────────────

export type ConfirmationStrategy = 'speed' | 'confirm_writes' | 'confirm_all';

/** Determine the confirmation strategy from current settings. */
export function getConfirmationStrategy(): ConfirmationStrategy {
  const { speedMode } = useAgentLoopStore.getState();
  if (speedMode) return 'speed';

  const { autoExecuteReads } = useAgentPolicyStore.getState();
  return autoExecuteReads ? 'confirm_writes' : 'confirm_all';
}

/** Determine if a tool call requires user confirmation. */
export function requiresConfirmation(toolCall: ParsedToolCall): boolean {
  const strategy = getConfirmationStrategy();
  if (strategy === 'speed') return false;
  if (strategy === 'confirm_all') return true;
  return isWriteOperation(toolCall);
}

/** Check if a tool call is a database write operation. */
export function isWriteOperation(toolCall: ParsedToolCall): boolean {
  if (toolCall.name !== 'execute_sql') return false;
  const sql = (toolCall.params.query || '').trim().toUpperCase();
  return /^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)/.test(sql);
}

// ─── Identity ────────────────────────────────────────────────────────────────

/**
 * Stable identity for a tool call: same tool + same params = same fingerprint.
 *
 * Used to tell whether a call has already run, so the manual "Run" button in the
 * conversation can't fire a second time for something the engine already did.
 * Params are key-sorted and whitespace-normalised so cosmetic differences in the
 * AI's formatting don't produce a different fingerprint.
 */
export function buildToolCallFingerprint(toolCall: ParsedToolCall): string {
  const params = Object.keys(toolCall.params)
    .sort()
    .map((key) => `${key}=${(toolCall.params[key] ?? '').replace(/\s+/g, ' ').trim()}`)
    .join('&');
  return `${toolCall.name}(${params})`;
}
