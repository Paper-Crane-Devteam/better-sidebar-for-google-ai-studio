/**
 * Table snapshots — one undo point per agent session.
 *
 * ## What it holds
 *
 * The first time a session is about to write to a table, that table is copied
 * wholesale. Undo restores every captured table to the copy.
 *
 * ## Why whole tables
 *
 * The alternative was recording the inverse of each statement, which requires
 * knowing *which rows* a statement affects — i.e. parsing the WHERE clause. That
 * fails silently on `INSERT ... SELECT`, subqueries, `DELETE ... LIMIT`, and worst
 * of all on `ON DELETE CASCADE`, where the rows that disappear are not named in the
 * SQL at all. Capturing whole tables needs only the table name, which is a single
 * token and reliable to extract.
 *
 * ## Why "first write" is the right moment
 *
 * A table is only snapshotted the first time it is written, yet the copy is still
 * the session's starting state. If nothing in the session had written to it before,
 * its content cannot have changed since the session began. Cascades do not break
 * this: a DELETE captures its entire cascade closure up front, so any table the
 * database might touch behind our back is already saved before it can be touched.
 *
 * ## What it deliberately does not do
 *
 * Restoring reverts the *whole table*, so concurrent edits from elsewhere — the
 * user renaming a folder in the sidebar, a background scan importing chats — are
 * rolled back too. Whole-table granularity cannot distinguish them. The UI has to
 * say so plainly, which is why `describeUndo()` lists the affected tables.
 */

import { selectAll } from './db-channel';
import { scanWriteTargets } from './sql-targets';
import { tablesToCapture } from './schema-map';

/**
 * Ceiling on a snapshot, counted in rows across every captured table.
 *
 * Exists because a restore is shipped to the worker as one SQL string: `messages`
 * on a heavily used profile runs to tens of thousands of rows, and serialising that
 * into `INSERT` statements would produce a payload big enough to stall the message
 * channel.
 *
 * Hitting it abandons undo for the session and says so, rather than keeping a
 * partial snapshot — restoring some tables but not the ones that cascaded from them
 * would leave the database inconsistent, which is worse than no undo at all.
 */
const MAX_SNAPSHOT_ROWS = 5000;

export interface SnapshotState {
  /** Captured tables → their contents at session start */
  tables: Map<string, Record<string, unknown>[]>;
  /** Total rows held, checked against MAX_SNAPSHOT_ROWS */
  rowCount: number;
  /** Non-null when undo is off the table for this session, with the reason why */
  blockedReason: string | null;
  /**
   * Set once a restore has run.
   *
   * Outlives the snapshot itself (which is dropped when consumed) because the UI has
   * to keep saying so: the conversation still contains the agent announcing changes
   * that no longer exist, and "Task finished" on its own would corroborate that.
   * Cleared when the next session starts.
   */
  undone: boolean;
}

const state: SnapshotState = {
  tables: new Map(),
  rowCount: 0,
  blockedReason: null,
  undone: false,
};

/** Callbacks fired whenever undo availability changes, so UI can re-render */
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeUndoState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Whether there is something to undo right now */
export function canUndo(): boolean {
  return state.blockedReason === null && state.tables.size > 0;
}

/** Why undo is unavailable, or null if it is available (or nothing was written) */
export function undoBlockedReason(): string | null {
  return state.blockedReason;
}

/** Tables that would be restored, for the confirmation copy */
export function affectedTables(): string[] {
  return [...state.tables.keys()];
}

export function snapshotRowCount(): number {
  return state.rowCount;
}

/** Whether this session's changes have already been rolled back */
export function wasUndone(): boolean {
  return state.undone;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Drop everything. Called when a session starts, so undo never spans two tasks —
 * "undo" has to mean the task the user just watched, not an accumulation.
 */
export function resetSnapshots(): void {
  state.tables.clear();
  state.rowCount = 0;
  state.blockedReason = null;
  state.undone = false;
  notify();
}

/**
 * The user accepted the changes — drop the snapshot without restoring.
 *
 * Called when the summary card is dismissed. Without it the snapshot outlives its
 * only entry point: still in memory, no longer reachable, and silently overwritten
 * by the next task. Making dismissal mean something keeps that state from existing.
 */
export function discardSnapshots(): void {
  state.tables.clear();
  state.rowCount = 0;
  notify();
}

/** Snapshot consumed by a successful restore. Keeps the `undone` flag for the UI. */
export function markUndone(): void {
  state.tables.clear();
  state.rowCount = 0;
  state.blockedReason = null;
  state.undone = true;
  notify();
}

/** Give up on undo for this session and record why. */
function block(reason: string): void {
  // The snapshot is dropped, not kept: a partial one restores some tables and not
  // others, which can break referential integrity in ways the original write did not.
  state.tables.clear();
  state.rowCount = 0;
  state.blockedReason = reason;
  console.warn('[AgentUndo] Undo unavailable:', reason);
  notify();
}

// ─── Capture ─────────────────────────────────────────────────────────────────

/**
 * Snapshot whatever `sql` is about to modify. Call immediately before executing it.
 *
 * Never throws: a write must not be blocked because its safety net failed. Any
 * problem downgrades to "no undo for this session", which the UI surfaces.
 */
export async function captureBeforeWrite(sql: string): Promise<void> {
  if (state.blockedReason !== null) return; // already given up

  const { targets, unsupported } = scanWriteTargets(sql);

  if (unsupported !== null) {
    block(unsupported);
    return;
  }

  if (targets.length === 0) return; // read-only

  // Expand to what the database may touch, not just what the SQL names
  const needed = new Set<string>();
  for (const { operation, table } of targets) {
    for (const t of tablesToCapture(operation, table)) {
      if (!state.tables.has(t)) needed.add(t);
    }
  }

  if (needed.size === 0) return; // everything already captured

  try {
    for (const table of needed) {
      const rows = await selectAll(table);

      if (state.rowCount + rows.length > MAX_SNAPSHOT_ROWS) {
        block(
          `The data involved is too large to snapshot (over ${MAX_SNAPSHOT_ROWS} rows). ` +
            `Create a backup from Settings before making changes like this.`,
        );
        return;
      }

      state.tables.set(table, rows);
      state.rowCount += rows.length;
    }
    console.log(
      `[AgentUndo] Captured ${needed.size} table(s), ${state.rowCount} rows total:`,
      [...needed].join(', '),
    );
    notify();
  } catch (e) {
    block(`Could not read the current data: ${(e as Error).message}`);
  }
}

/** Internal read for the restore step. */
export function takeSnapshot(): Map<string, Record<string, unknown>[]> | null {
  if (!canUndo()) return null;
  return new Map(state.tables);
}
