/**
 * Sync data export/import layer.
 * Handles reading tables from SQLite and writing them back.
 * Excludes messages and messages_fts tables.
 */

import { runQuery, runCommand, runBatch } from '@/shared/db';

/**
 * Tables to sync (order matters for foreign key constraints).
 *
 * Parents must precede their dependents: snippet_folders before snippets,
 * folders before conversations, tags before conversation_tags.
 */
export const SYNC_TABLES = [
  'prompt_folders',
  'prompts',
  'folders',
  'gems',
  'notebooks',
  'conversations',
  'favorites',
  'tags',
  'conversation_tags',
  'snippet_folders',
  'snippets',
] as const;

/** Current payload format version. Readers accept anything >= 1. */
export const SYNC_PAYLOAD_VERSION = 2;

/**
 * Identifies which profile and which Google account produced a payload.
 *
 * Recorded so a reader can refuse to merge a file that belongs to a different
 * profile or account. Without it, a mix-up in the active DB or the OAuth
 * account results in one dataset being merged over another — and because the
 * merge mirrors remote deletions, that silently destroys local data.
 */
export interface SyncOrigin {
  /** SQLite filename of the profile that produced this payload */
  dbName?: string;
  /** Stable Google Drive account identifier, when it could be determined */
  accountId?: string | null;
}

export interface SyncPayload {
  version: number;
  exportedAt: number;
  origin?: SyncOrigin;
  tables: Record<string, any[]>;
}

/**
 * Export all syncable tables as a JSON string.
 *
 * @param origin - Provenance stamp. Always pass this for anything uploaded to
 *                 Drive so the reader can verify it before merging.
 */
export async function exportSyncData(origin?: SyncOrigin): Promise<string> {
  const tables: Record<string, any[]> = {};

  for (const table of SYNC_TABLES) {
    const rows = await runQuery(`SELECT * FROM ${table}`);
    tables[table] = rows || [];
  }

  const payload: SyncPayload = {
    version: SYNC_PAYLOAD_VERSION,
    exportedAt: Math.floor(Date.now() / 1000),
    ...(origin ? { origin } : {}),
    tables,
  };

  return JSON.stringify(payload);
}

/**
 * Import sync data into local DB (overwrite mode).
 * Clears existing data in sync tables, then inserts new data.
 * Messages table is NOT touched.
 *
 * This is unconditionally destructive — it empties every sync table first.
 * Callers are expected to have captured a recovery snapshot beforehand.
 */
export async function importSyncData(jsonString: string): Promise<void> {
  const payload: SyncPayload = JSON.parse(jsonString);

  if (!payload.version || !payload.tables) {
    throw new Error('Invalid sync data format');
  }

  // Disable foreign keys for clean import
  await runCommand('PRAGMA foreign_keys = OFF');

  try {
    // Clear tables in reverse order (dependents first)
    const reversedTables = [...SYNC_TABLES].reverse();
    for (const table of reversedTables) {
      await runCommand(`DELETE FROM ${table}`);
    }

    // Insert data in order (parents first)
    for (const table of SYNC_TABLES) {
      const rows = payload.tables[table];
      if (!rows || rows.length === 0) continue;

      // Build batch insert operations
      const operations: { sql: string; bind?: any[] }[] = [];

      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map((col) => row[col]);

        operations.push({
          sql: `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          bind: values,
        });
      }

      // Execute in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = operations.slice(i, i + BATCH_SIZE);
        await runBatch(batch);
      }
    }
  } finally {
    // Re-enable foreign keys
    await runCommand('PRAGMA foreign_keys = ON');
  }
}
