/**
 * Execution policy — decides which tool calls need the user's go-ahead,
 * plus token estimation helpers.
 *
 * One question, asked per call: may this run without asking? Four inputs, checked
 * from broadest to narrowest:
 *
 * 1. `speedMode`          — approved everything for this task (session)
 * 2. `approveRestOfRound` — approved the rest of this response (cleared each round)
 * 3. `autoRunWrites`      — changes to data run by themselves (persisted, off)
 * 4. `autoRunReads`       — queries run by themselves (persisted, on)
 *
 * The gate itself lives in the engine (`stages/approval-gate.ts`), not in the tools.
 * `execute-sql` used to ask for its own confirmation, which meant a tool reaching
 * into the UI and left the request with no way to say *which* call it was about —
 * so the approval couldn't be offered on the tool card in the chat.
 */

import type { ParsedToolCall, ToolRisk } from './types';
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

// ─── Approval ────────────────────────────────────────────────────────────────

/**
 * Which switch governs this call.
 *
 * Only SQL that modifies data counts as a write. `export` and
 * `sync_conversation_messages` produce output but leave the database alone, so
 * gating them behind the write switch would train people to turn it on.
 */
export function getToolRisk(toolCall: ParsedToolCall): ToolRisk {
  if (toolCall.name !== 'execute_sql') return 'read';
  const sql = (toolCall.params.query || '').trim().toUpperCase();
  return /^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)/.test(sql) ? 'write' : 'read';
}

/** Whether a tool call is a database write operation */
export function isWriteOperation(toolCall: ParsedToolCall): boolean {
  return getToolRisk(toolCall) === 'write';
}

/** Whether this call must wait for the user before it runs */
export function requiresApproval(toolCall: ParsedToolCall): boolean {
  const { speedMode, approveRestOfRound } = useAgentLoopStore.getState();
  if (speedMode || approveRestOfRound) return false;

  const { autoRunReads, autoRunWrites } = useAgentPolicyStore.getState();
  return getToolRisk(toolCall) === 'write' ? !autoRunWrites : !autoRunReads;
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
