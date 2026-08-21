/**
 * Rebuilding a report the AI never received.
 *
 * When a page reload catches a session between "the tool ran" and "the result was
 * sent", the result exists only in the ledger — the composer that held it is gone. This
 * turns those rows back into the payload stage ④ would have sent.
 *
 * Reassembled through `formatResults` rather than concatenated here, deliberately: that
 * function is the single funnel every payload passes through, so the reassembled one
 * gets the same section grammar, the same join keys and the same composer budget. A
 * hand-rolled variant would drift from it, and the symptom of that drift is silent —
 * capsules collapsing into one, or a payload over the 31,998-character cap losing its
 * tail with nothing downstream noticing.
 */

import { formatResults, formatSectionHeading } from './engine/stages/handoff/formatter';
import type { AgentToolCallRow } from '@/shared/types/db';

/**
 * What the AI is told about the gap.
 *
 * It has to explain the delay without inviting the one wrong move: re-running the tools
 * it is being shown the results of. The results are real and already applied — a write
 * in here has been written — so "carry on from these" is the whole message.
 */
function buildPreamble(rows: AgentToolCallRow[]): string {
  const writes = rows.filter((row) => row.is_write === 1).length;
  const writeNote = writes
    ? ` ${writes} of them modified the database, and those changes are already applied.`
    : '';

  return (
    `These are results from the previous run of this task. The page was reloaded before ` +
    `they could be sent to you, so you are seeing them now instead of when they happened. ` +
    `They are real and complete outcomes — the tools already ran.${writeNote} ` +
    `Do not repeat these calls. Read the results and continue the task from here, or call ` +
    `complete_task if the task is already done.`
  );
}

/** One stored row as the section it would have been */
function toSection(row: AgentToolCallRow): string {
  const label = row.description || row.tool_name || 'tool';
  // Same heading builder as the live path, so the key lands where a later read expects
  // it and these recovered sections match their cards like any other.
  return `${formatSectionHeading(label, row.join_key)}\n${row.result_body ?? ''}`;
}

/**
 * Turn owed rows into a sendable payload, or null if there is nothing to send.
 *
 * Rows without a body are skipped: a `running` row never got one, and a delivered row
 * had it dropped on purpose.
 */
export function buildOwedPayload(rows: AgentToolCallRow[]): string | null {
  const usable = rows.filter((row) => row.result_body);
  if (usable.length === 0) return null;

  return formatResults(
    usable.map(toSection),
    [],
    buildPreamble(usable),
  );
}
