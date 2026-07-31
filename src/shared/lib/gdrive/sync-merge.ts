/**
 * Smart merge logic for GDrive sync.
 * Merges remote data with local data using updated_at timestamps.
 *
 * Deletion strategy (no tombstones needed):
 * Uses lastSyncTime as the boundary to distinguish "deleted elsewhere"
 * from "created locally since last sync":
 *
 *  - Local has it, remote doesn't, updated_at < lastSyncTime
 *    → It existed at last sync, remote removed it → delete local
 *  - Local has it, remote doesn't, updated_at >= lastSyncTime
 *    → Created locally after last sync → keep it
 *  - First sync ever (lastSyncTime = 0) → never delete, only insert/update
 *
 * ── Why the deletion phase needs guards ──────────────────────────────────────
 * Because lastSyncTime is refreshed to "now" after every sync, on the next run
 * virtually every local row satisfies `updated_at < lastSyncTime`. The rule
 * therefore degrades into "delete anything the remote file doesn't have", i.e.
 * a full mirror-from-remote. That is fine while the remote file is trustworthy,
 * but a single bad remote payload — an empty file, a stale file, or one written
 * for a different profile after a DB/profile mix-up — wipes local folders and
 * tags, which cannot be rebuilt by rescanning the platform.
 *
 * Two guards bound the damage:
 *  1. Per-table: if the remote has zero rows for a table but the local DB has
 *     rows, that table's deletions are skipped entirely. Wholesale emptying of
 *     a table is far more likely to be a corrupt payload than a real intent.
 *  2. Global: if deletions would remove more than MAX_SAFE_DELETE_RATIO of all
 *     local rows (and exceed a small absolute floor), every deletion is held
 *     back.
 *
 * When a guard trips, inserts and updates still apply — only the destructive
 * half is suppressed. The cost is that a genuine bulk deletion made on another
 * device stops propagating; the user can redo it locally. That trade is
 * deliberate: unsynced deletions are recoverable, deleted folders are not.
 *
 * Whatever deletions do survive the guards are preceded by `onBeforeDelete`,
 * which the caller uses to capture a recovery snapshot.
 */

import { runQuery, runCommand, runBatch } from '@/shared/db';
import { SYNC_TABLES, type SyncPayload } from './sync-data';

/**
 * Tables to merge, in FK-safe order (parents first).
 * Shares the single source of truth with the export layer so the two can never
 * drift — a table present in one but not the other would either never sync or
 * be treated as "missing from remote" and deleted.
 */
const MERGE_TABLES = SYNC_TABLES;

/** Tables to delete in reverse order (dependents first) */
const DELETE_ORDER = [...MERGE_TABLES].reverse();

/**
 * Primary key columns per table. Most tables use a surrogate `id`, but
 * `conversation_tags` is a pure join table with a composite key and no `id`
 * column at all — indexing it by `id` silently collapses every row onto the
 * same `undefined` key and emits `WHERE id = ?` SQL that SQLite rejects.
 */
const TABLE_KEYS: Record<string, readonly string[]> = {
  prompt_folders: ['id'],
  prompts: ['id'],
  folders: ['id'],
  gems: ['id'],
  notebooks: ['id'],
  conversations: ['id'],
  favorites: ['id'],
  tags: ['id'],
  conversation_tags: ['conversation_id', 'tag_id'],
  snippet_folders: ['id'],
  snippets: ['id'],
};

/**
 * All deletions are held back when they would remove more than this fraction of
 * the local rows that existed *before* the merge started.
 */
const MAX_SAFE_DELETE_RATIO = 0.3;

/**
 * Absolute floor below which the global ratio guard is not applied. Small
 * datasets trip high ratios trivially (3 folders, 1 removed = 33%), so tiny
 * deletions always pass through.
 */
const MIN_ROWS_FOR_RATIO_GUARD = 10;

/**
 * A single table's deletions are held back when they would remove more than
 * this fraction of that table's pre-merge rows.
 *
 * The per-table guard exists because the global ratio can be diluted into
 * harmlessness: phase 1 inserts the remote rows first, so if a payload from a
 * different dataset arrives, the local table grows before phase 1 even looks at
 * deletions. Wiping 100% of what this profile owned can then read as a small
 * fraction of the inflated total.
 */
const MAX_SAFE_TABLE_DELETE_RATIO = 0.5;

/** Absolute floor for the per-table guard. */
const MIN_ROWS_FOR_TABLE_GUARD = 5;

export interface MergeResult {
  inserted: number;
  updated: number;
  deleted: number;
  skipped: number;
  /** Rows that qualified for deletion but were held back by a safety guard */
  deletionBlocked: number;
  /** Human-readable guard explanations, for logging and diagnostics */
  guardReasons: string[];
}

export interface MergeOptions {
  /**
   * Invoked once immediately before any DELETE runs, with the planned deletion
   * counts. Intended for capturing a recovery snapshot.
   *
   * If this throws, all deletions are abandoned and reported via
   * `guardReasons` — a merge is never allowed to delete rows without a
   * successful recovery point.
   */
  onBeforeDelete?: (plan: {
    total: number;
    byTable: Record<string, number>;
  }) => Promise<void>;
}

/** Build a stable map key from a row's primary key columns. */
function rowKey(row: any, keyCols: readonly string[]): string {
  return keyCols.map((col) => String(row?.[col])).join('\u0000');
}

/** Does the row carry a usable value for every primary key column? */
function hasCompleteKey(row: any, keyCols: readonly string[]): boolean {
  return keyCols.every((col) => row?.[col] !== undefined && row?.[col] !== null);
}

/**
 * Merge remote sync data into local DB.
 *
 * @param remoteJson - JSON string of the remote SyncPayload
 * @param lastSyncTime - Unix timestamp (seconds) of the last successful sync.
 *                        Pass 0 for first-ever sync (disables deletion).
 * @param options - Hooks, notably `onBeforeDelete` for snapshotting.
 */
export async function mergeSyncData(
  remoteJson: string,
  lastSyncTime: number,
  options: MergeOptions = {},
): Promise<MergeResult> {
  const remote: SyncPayload = JSON.parse(remoteJson);

  if (!remote.version || !remote.tables) {
    throw new Error('Invalid sync data format');
  }

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;
  let totalSkipped = 0;
  let deletionBlocked = 0;
  const guardReasons: string[] = [];

  // Row counts as they are *before* phase 1 adds anything. The deletion guards
  // must reason about what this profile already owned, not about a total that
  // phase 1 has already inflated with remote rows.
  const preMergeCounts: Record<string, number> = {};
  for (const table of MERGE_TABLES) {
    const rows: any[] = (await runQuery(`SELECT COUNT(*) AS n FROM ${table}`)) || [];
    preMergeCounts[table] = Number(rows[0]?.n ?? 0);
  }
  const preMergeTotal = Object.values(preMergeCounts).reduce((a, b) => a + b, 0);

  await runCommand('PRAGMA foreign_keys = OFF');

  try {
    // --- Phase 1: Insert & Update (parent tables first) ---
    for (const table of MERGE_TABLES) {
      const remoteRows: any[] = remote.tables[table] || [];
      if (remoteRows.length === 0) continue;

      const keyCols = TABLE_KEYS[table] ?? ['id'];
      const localRows: any[] = (await runQuery(`SELECT * FROM ${table}`)) || [];
      const localMap = new Map<string, any>();
      for (const row of localRows) {
        localMap.set(rowKey(row, keyCols), row);
      }

      const ops: { sql: string; bind?: any[] }[] = [];

      for (const remoteRow of remoteRows) {
        if (!hasCompleteKey(remoteRow, keyCols)) {
          // Malformed remote row — no way to match or address it safely
          totalSkipped++;
          continue;
        }

        const localRow = localMap.get(rowKey(remoteRow, keyCols));

        if (!localRow) {
          // Remote-only: check if it was locally deleted
          if (lastSyncTime > 0) {
            const remoteTime = remoteRow.updated_at || remoteRow.created_at || 0;
            if (remoteTime < lastSyncTime) {
              // Record existed at last sync but local doesn't have it now
              // → was deleted locally → skip
              totalSkipped++;
              continue;
            }
          }
          // Truly new from remote → insert
          const columns = Object.keys(remoteRow);
          const placeholders = columns.map(() => '?').join(', ');
          const values = columns.map((col) => remoteRow[col]);
          ops.push({
            sql: `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            bind: values,
          });
          totalInserted++;
        } else {
          // Both exist → compare timestamps
          const localTime = localRow.updated_at || localRow.created_at || 0;
          const remoteTime = remoteRow.updated_at || remoteRow.created_at || 0;

          if (remoteTime > localTime) {
            // Never rewrite key columns — they identify the row being updated
            const columns = Object.keys(remoteRow).filter(
              (c) => !keyCols.includes(c),
            );
            if (columns.length === 0) {
              totalSkipped++;
              continue;
            }
            const sets = columns.map((c) => `${c} = ?`).join(', ');
            const where = keyCols.map((c) => `${c} = ?`).join(' AND ');
            const values = [
              ...columns.map((c) => remoteRow[c]),
              ...keyCols.map((c) => remoteRow[c]),
            ];
            ops.push({
              sql: `UPDATE ${table} SET ${sets} WHERE ${where}`,
              bind: values,
            });
            totalUpdated++;
          } else {
            totalSkipped++;
          }
        }
      }

      const BATCH_SIZE = 100;
      for (let i = 0; i < ops.length; i += BATCH_SIZE) {
        await runBatch(ops.slice(i, i + BATCH_SIZE));
      }
    }

    // --- Phase 2: Delete stale local rows (dependents first) ---
    // Skip deletion on first-ever sync (no baseline to compare against)
    if (lastSyncTime > 0) {
      let plannedOps: { sql: string; bind?: any[] }[] = [];
      const plannedByTable: Record<string, number> = {};

      for (const table of DELETE_ORDER) {
        const keyCols = TABLE_KEYS[table] ?? ['id'];
        const remoteRows: any[] = remote.tables[table] || [];
        const localRows: any[] =
          (await runQuery(`SELECT * FROM ${table}`)) || [];

        if (localRows.length === 0) continue;

        // Guard 1: remote table is entirely empty while local has data.
        // Treat as a corrupt/foreign payload rather than a real mass deletion.
        if (remoteRows.length === 0) {
          deletionBlocked += localRows.length;
          guardReasons.push(
            `${table}: remote has 0 rows but local has ${localRows.length} — deletions skipped`,
          );
          continue;
        }

        const remoteKeys = new Set(
          remoteRows
            .filter((r) => hasCompleteKey(r, keyCols))
            .map((r) => rowKey(r, keyCols)),
        );

        const tableOps: { sql: string; bind?: any[] }[] = [];

        for (const localRow of localRows) {
          if (!hasCompleteKey(localRow, keyCols)) continue; // not addressable
          if (remoteKeys.has(rowKey(localRow, keyCols))) continue; // keep

          // Local-only: check if it's older than last sync
          const rowTime = localRow.updated_at || localRow.created_at || 0;

          if (rowTime < lastSyncTime) {
            // Existed before last sync but remote doesn't have it
            // → was deleted on another device → delete locally
            const where = keyCols.map((c) => `${c} = ?`).join(' AND ');
            tableOps.push({
              sql: `DELETE FROM ${table} WHERE ${where}`,
              bind: keyCols.map((c) => localRow[c]),
            });
          }
          // else: created after last sync → keep
        }

        if (tableOps.length === 0) continue;

        // Guard 2: this table is losing most of what it had before the merge
        const before = preMergeCounts[table] ?? 0;
        const tableRatio = before > 0 ? tableOps.length / before : 0;
        if (
          tableOps.length >= MIN_ROWS_FOR_TABLE_GUARD &&
          tableRatio > MAX_SAFE_TABLE_DELETE_RATIO
        ) {
          deletionBlocked += tableOps.length;
          guardReasons.push(
            `${table}: would delete ${tableOps.length}/${before} pre-merge rows ` +
              `(${(tableRatio * 100).toFixed(0)}%), over the ` +
              `${(MAX_SAFE_TABLE_DELETE_RATIO * 100).toFixed(0)}% per-table limit`,
          );
          continue;
        }

        plannedOps = plannedOps.concat(tableOps);
        plannedByTable[table] = tableOps.length;
      }

      // Guard 3: bulk-wipe ratio across everything this profile already owned
      const ratio = preMergeTotal > 0 ? plannedOps.length / preMergeTotal : 0;
      const exceedsRatio =
        plannedOps.length >= MIN_ROWS_FOR_RATIO_GUARD &&
        ratio > MAX_SAFE_DELETE_RATIO;

      if (exceedsRatio) {
        deletionBlocked += plannedOps.length;
        guardReasons.push(
          `bulk deletion blocked: ${plannedOps.length}/${preMergeTotal} pre-merge rows ` +
            `(${(ratio * 100).toFixed(0)}%) exceeds the ` +
            `${(MAX_SAFE_DELETE_RATIO * 100).toFixed(0)}% safety limit`,
        );
      } else if (plannedOps.length > 0) {
        // Capture a recovery point before touching anything
        let snapshotOk = true;
        if (options.onBeforeDelete) {
          try {
            await options.onBeforeDelete({
              total: plannedOps.length,
              byTable: plannedByTable,
            });
          } catch (err: any) {
            snapshotOk = false;
            deletionBlocked += plannedOps.length;
            guardReasons.push(
              `deletions skipped: safety snapshot failed (${err?.message ?? err})`,
            );
          }
        }

        if (snapshotOk) {
          const BATCH_SIZE = 100;
          for (let i = 0; i < plannedOps.length; i += BATCH_SIZE) {
            await runBatch(plannedOps.slice(i, i + BATCH_SIZE));
          }
          totalDeleted = plannedOps.length;
        }
      }
    }
  } finally {
    await runCommand('PRAGMA foreign_keys = ON');
  }

  if (guardReasons.length > 0) {
    console.warn(
      `[SyncMerge] Deletion guard held back ${deletionBlocked} row(s):\n  - ` +
        guardReasons.join('\n  - '),
    );
  }

  return {
    inserted: totalInserted,
    updated: totalUpdated,
    deleted: totalDeleted,
    skipped: totalSkipped,
    deletionBlocked,
    guardReasons,
  };
}
