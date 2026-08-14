/**
 * Restore captured tables — the actual undo.
 *
 * Three SQLite details shape the sequencing here:
 *
 * 1. **`PRAGMA foreign_keys` is a no-op inside a transaction.** It has to be set
 *    before `BEGIN`, which is why this is not one big SQL string.
 * 2. **Foreign keys must be off.** Emptying `folders` before refilling it would
 *    cascade-delete every conversation that pointed at it, so the restore would
 *    destroy the very rows it is about to write back.
 * 3. **A failed statement leaves the transaction open.** Without an explicit
 *    `ROLLBACK` the connection stays in a transaction and every later query fails,
 *    so the catch path is load-bearing rather than tidiness.
 *
 * `PRAGMA foreign_keys = ON` runs in a `finally`: leaving enforcement off would
 * silently weaken every later write in the profile, which is a far worse outcome
 * than a failed undo.
 */

import { runSql, buildInsert } from './db-channel';
import { RESTORE_ORDER } from './schema-map';
import { markUndone, takeSnapshot, affectedTables } from './snapshot-store';

/**
 * Statements per round trip.
 *
 * The row ceiling in snapshot-store bounds the total, but `messages.content` holds
 * entire model replies, so row count alone does not bound *bytes*. Batching keeps
 * any single `postMessage` payload modest regardless of row width.
 */
const STATEMENTS_PER_BATCH = 300;

export interface UndoResult {
  tables: string[];
  rowsRestored: number;
}

/** Order captured tables parents-first; anything unlisted goes last. */
function orderedTables(tables: Iterable<string>): string[] {
  return [...tables].sort((a, b) => {
    const ia = RESTORE_ORDER.indexOf(a);
    const ib = RESTORE_ORDER.indexOf(b);
    return (ia === -1 ? RESTORE_ORDER.length : ia) - (ib === -1 ? RESTORE_ORDER.length : ib);
  });
}

async function runBatched(statements: string[]): Promise<void> {
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    const batch = statements.slice(i, i + STATEMENTS_PER_BATCH);
    await runSql(batch.join(';\n') + ';');
  }
}

/**
 * Roll the captured tables back to their snapshot.
 *
 * Returns null when there is nothing to undo. Throws if the restore fails, having
 * already rolled back — the snapshot is kept in that case so the user can retry.
 */
export async function undoAgentWrites(): Promise<UndoResult | null> {
  const snapshot = takeSnapshot();
  if (!snapshot) return null;

  const tables = orderedTables(snapshot.keys());
  const rowsRestored = [...snapshot.values()].reduce((sum, rows) => sum + rows.length, 0);

  console.log(`[AgentUndo] Restoring ${tables.length} table(s), ${rowsRestored} row(s)`);

  // Children first, so cascade triggers have less to chew through even with
  // enforcement off (the FTS triggers on `messages` still fire either way).
  const clears = [...tables].reverse().map((t) => `DELETE FROM "${t}"`);

  const inserts: string[] = [];
  for (const table of tables) {
    for (const row of snapshot.get(table)!) {
      inserts.push(buildInsert(table, row));
    }
  }

  await runSql('PRAGMA foreign_keys = OFF');
  try {
    await runSql('BEGIN');
    try {
      await runBatched(clears);
      await runBatched(inserts);
      await runSql('COMMIT');
    } catch (e) {
      // Mandatory: an open transaction would break every subsequent query.
      await runSql('ROLLBACK').catch((rollbackError) => {
        console.error('[AgentUndo] Rollback failed:', rollbackError);
      });
      throw e;
    }
  } finally {
    await runSql('PRAGMA foreign_keys = ON').catch((e) => {
      console.error('[AgentUndo] Failed to re-enable foreign keys:', e);
    });
  }

  // Consumed — a second undo would restore stale data over the restored state.
  // The `undone` flag survives so the UI can keep saying the changes were reverted.
  markUndone();

  console.log('[AgentUndo] Restore complete');
  return { tables, rowsRestored };
}

/** Human-readable summary for a confirmation prompt. */
export function describeUndo(): string | null {
  const tables = affectedTables();
  if (tables.length === 0) return null;
  return tables.join(', ');
}
