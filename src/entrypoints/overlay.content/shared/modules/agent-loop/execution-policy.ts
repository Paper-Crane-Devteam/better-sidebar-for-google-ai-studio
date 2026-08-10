/**
 * Execution policy — decides which tool calls need the user's go-ahead, and as a
 * direct consequence, who presses send at the end of the round.
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
import { CONTROL_TOOLS } from './engine/parser/tool-schema';

// ─── Approval ────────────────────────────────────────────────────────────────

/** Whether this tool steers the loop instead of doing work */
export function isControlTool(toolName: string): boolean {
  return CONTROL_TOOLS.includes(toolName);
}

/**
 * Which switch governs this call — or none at all.
 *
 * Three answers, and the third is the point of the function existing rather than a
 * plain `isWrite` boolean:
 *
 * - `control` — the call does nothing to the data, it ends the loop. Filing
 *   `complete_task` under `read` meant "don't auto-run queries" also meant "ask me
 *   before finishing", which is a gate over an operation with no downside and no
 *   alternative: refusing it just makes the AI say the same thing again next round.
 * - `write`   — SQL that modifies data. Only that: `export` and
 *   `sync_conversation_messages` produce output but leave the database alone, so
 *   gating them behind the write switch would train people to turn it on.
 * - `read`    — everything else.
 */
export function getToolRisk(toolCall: ParsedToolCall): ToolRisk {
  if (isControlTool(toolCall.name)) return 'control';
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
  const risk = getToolRisk(toolCall);
  // Outside the switches by construction — there is no operation here to approve.
  if (risk === 'control') return false;

  const { speedMode, approveRestOfRound } = useAgentLoopStore.getState();
  if (speedMode || approveRestOfRound) return false;

  const { autoRunReads, autoRunWrites } = useAgentPolicyStore.getState();
  return risk === 'write' ? !autoRunWrites : !autoRunReads;
}

// ─── Who presses send ────────────────────────────────────────────────────────

/**
 * Whether the engine should send this round's results back by itself.
 *
 * Two independent inputs, intersected — both have to say yes:
 *
 * 1. `autoContinue` — a standing preference. "Let it run unattended." Someone who
 *    wants to watch each step before letting it continue turns this off, and does
 *    not thereby have to confirm every individual SELECT.
 * 2. The round itself — did anything here already stop and ask? A user who just
 *    approved a statement is sitting right there, so the send is theirs. Having it
 *    fly off the moment you clicked "Run" is the worse surprise; one extra keypress
 *    is the cheaper half of that trade.
 *
 * A response commonly mixes both kinds — two SELECTs and an UPDATE — and there is
 * only one send, so it goes to the user if *any* call needed them.
 * `approveRestOfRound` and `speedMode` fold in for free, since they make
 * `requiresApproval` false for the rest of the round.
 *
 * ⚠️ Intersection, not replacement. `autoSend = autoContinue` on its own lets the
 * switch contradict the approval gate; this way the switch can only ever make
 * things *more* manual.
 */
export function shouldAutoSend(toolCalls: ParsedToolCall[]): boolean {
  if (!isUnattendedAllowed()) return false;
  return !toolCalls.some((call) => requiresApproval(call));
}

/**
 * The standing preference on its own, for payloads that aren't tool results.
 *
 * The format nudge is ours, not something the user vetted, so there is no round to
 * inspect — but "off means I press Enter every time" has to hold for it too, or the
 * switch stops being predictable.
 */
export function isUnattendedAllowed(): boolean {
  return useAgentPolicyStore.getState().autoContinue;
}

// ─── Identity ────────────────────────────────────────────────────────────────

/**
 * Stable identity for a tool call: same tool + same params = same fingerprint.
 *
 * Lets the card in the chat find the call it is showing — both to light up when the
 * approval is about it, and to report afterwards what became of it. Params are
 * key-sorted and whitespace-normalised so cosmetic differences in the AI's
 * formatting don't produce a different fingerprint.
 */
export function buildToolCallFingerprint(toolCall: ParsedToolCall): string {
  const params = Object.keys(toolCall.params)
    .sort()
    .map((key) => `${key}=${(toolCall.params[key] ?? '').replace(/\s+/g, ' ').trim()}`)
    .join('&');
  return `${toolCall.name}(${params})`;
}
