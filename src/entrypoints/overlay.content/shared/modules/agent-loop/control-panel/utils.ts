/**
 * Control Panel utility functions.
 * Token estimation, confirmation strategy, and write operation detection.
 */

import type { ParsedToolCall } from '../types';
import { useAgentLoopStore } from '../agent-loop-store';
import { useControlPanelStore } from '../control-panel-store';

// ─── Token Estimation ────────────────────────────────────────────────────────

/**
 * Estimate token count from text using character-based heuristic.
 * Chinese characters: ~2 chars/token (each char = 0.5 token)
 * Other characters: ~4 chars/token (each char = 0.25 token)
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

/**
 * Format token count for compact display.
 * <1000: "~800 tokens"
 * 1000-999999: "~2.3k tokens"
 * ≥1000000: "~1.2M tokens"
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) return `~${count} tokens`;
  if (count < 1000000) return `~${(count / 1000).toFixed(1)}k tokens`;
  return `~${(count / 1000000).toFixed(1)}M tokens`;
}

// ─── Confirmation Strategy ───────────────────────────────────────────────────

export type ConfirmationStrategy = 'speed' | 'confirm_writes' | 'confirm_all';

/**
 * Determine confirmation strategy based on current settings.
 */
export function getConfirmationStrategy(): ConfirmationStrategy {
  const { speedMode } = useAgentLoopStore.getState();
  if (speedMode) return 'speed';

  const { autoExecuteReads } = useControlPanelStore.getState();
  if (autoExecuteReads) return 'confirm_writes';
  return 'confirm_all';
}

/**
 * Determine if a tool call requires user confirmation.
 */
export function requiresConfirmation(toolCall: ParsedToolCall): boolean {
  const strategy = getConfirmationStrategy();
  if (strategy === 'speed') return false;
  if (strategy === 'confirm_all') return true;
  // confirm_writes: only write operations need confirmation
  return isWriteOperation(toolCall);
}

/**
 * Check if a tool call is a database write operation.
 */
export function isWriteOperation(toolCall: ParsedToolCall): boolean {
  if (toolCall.name !== 'execute_sql') return false;
  const sql = (toolCall.params.query || '').trim().toUpperCase();
  return /^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)/.test(sql);
}
