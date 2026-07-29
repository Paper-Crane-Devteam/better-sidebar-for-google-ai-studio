/**
 * Backup (Save Slots) Manager.
 *
 * Stores periodic snapshots of sync data in browser.storage.local.
 * Each profile gets its own set of backup slots, namespaced by dbName.
 * Maximum slots is configurable (1–20, default 5).
 *
 * Backup is triggered BEFORE a sync runs (not after), so the snapshot always
 * captures the pre-sync state. If a sync turns out to be destructive — e.g. it
 * pulled an empty/stale remote file and mirrored those deletions locally — the
 * newest slot still holds the data as it was before that sync.
 * Periodic pre-sync snapshots are rate-limited to one per 24h.
 *
 * On top of that, `createSafetyBackup` takes an un-throttled snapshot right
 * before the merge executes any bulk DELETE, which is the moment data is most
 * at risk.
 *
 * Does NOT depend on Google Drive — works purely with local storage.
 * If GDrive is also connected, data is already synced there separately;
 * backups serve as point-in-time recovery regardless.
 */

import { exportSyncData, importSyncData } from './sync-data';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Why a backup slot was created. Older slots may not carry this field. */
export type BackupReason =
  /** User pressed "create backup" */
  | 'manual'
  /** Throttled snapshot taken before a sync run */
  | 'pre-sync'
  /** Un-throttled snapshot taken right before a merge deletes rows */
  | 'pre-merge-delete'
  /** Un-throttled snapshot of the state being replaced by a restore */
  | 'pre-restore';

/** Reasons that mark a slot as a recovery point worth protecting from pruning */
const PROTECTED_REASONS: readonly BackupReason[] = [
  'pre-merge-delete',
  'pre-restore',
];

export interface BackupSlot {
  id: string; // Unique ID (timestamp-based)
  createdAt: number; // Unix timestamp (seconds)
  size: number; // Approximate size in bytes
  reason?: BackupReason; // Optional: absent on slots created before this existed
  data: string; // The full JSON export
}

export interface BackupMeta {
  /** Per-profile last backup timestamp (seconds) */
  lastBackupTime: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BACKUP_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_SLOTS_LIMIT = 20;

/**
 * Safety snapshots taken within this window of an identical one are treated as
 * duplicates. Guards against sync retries piling up near-identical slots.
 */
const SAFETY_BACKUP_DEDUPE_MS = 60 * 1000;

// ─── Storage Keys ────────────────────────────────────────────────────────────

function getBackupStorageKey(dbName: string): string {
  return `backups__${dbName}`;
}

function getBackupMetaKey(dbName: string): string {
  return `backup_meta__${dbName}`;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function loadBackups(dbName: string): Promise<BackupSlot[]> {
  const key = getBackupStorageKey(dbName);
  const result = await browser.storage.local.get(key);
  const raw = result[key];
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveBackups(
  dbName: string,
  backups: BackupSlot[],
): Promise<void> {
  const key = getBackupStorageKey(dbName);
  await browser.storage.local.set({ [key]: JSON.stringify(backups) });
}

// ─── Core API ────────────────────────────────────────────────────────────────

/**
 * List all backups for a given profile.
 * Returns sorted by creation time (newest first).
 */
export async function listBackups(dbName: string): Promise<BackupSlot[]> {
  const backups = await loadBackups(dbName);
  // Sort newest first
  return backups.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Create a new backup snapshot.
 * Exports current local DB tables and stores the JSON in local storage.
 */
export async function createBackup(
  dbName: string,
  reason: BackupReason = 'manual',
): Promise<BackupSlot> {
  const now = Math.floor(Date.now() / 1000);
  const data = await exportSyncData();

  const slot: BackupSlot = {
    id: `backup-${now}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    size: new Blob([data]).size,
    reason,
    data,
  };

  const backups = await loadBackups(dbName);
  backups.push(slot);
  await saveBackups(dbName, backups);

  // Update meta
  const metaKey = getBackupMetaKey(dbName);
  await browser.storage.local.set({
    [metaKey]: { lastBackupTime: now } satisfies BackupMeta,
  });

  return slot;
}

/**
 * Delete a backup by ID.
 */
export async function deleteBackup(
  dbName: string,
  backupId: string,
): Promise<void> {
  const backups = await loadBackups(dbName);
  const filtered = backups.filter((b) => b.id !== backupId);
  await saveBackups(dbName, filtered);
}

/**
 * Restore a backup — imports its data payload into the local DB.
 */
export async function restoreBackup(
  dbName: string,
  backupId: string,
): Promise<void> {
  const backups = await loadBackups(dbName);
  const slot = backups.find((b) => b.id === backupId);
  if (!slot) {
    throw new Error('Backup not found');
  }
  await importSyncData(slot.data);
}

/**
 * Prune oldest backups to stay within maxSlots.
 * Keeps the newest N slots, but never prunes away the most recent safety
 * snapshot — those exist precisely because data was at risk, so routine
 * snapshots must not push them out of the window.
 */
export async function pruneBackups(
  dbName: string,
  maxSlots: number,
): Promise<number> {
  const limit = Math.min(Math.max(maxSlots, 1), MAX_SLOTS_LIMIT);
  const backups = await loadBackups(dbName);

  if (backups.length <= limit) return 0;

  // Sort newest first, keep only `limit` items
  backups.sort((a, b) => b.createdAt - a.createdAt);
  const toKeep = backups.slice(0, limit);

  // Rescue the newest safety snapshot if routine pruning would drop it
  const newestSafety = backups.find(
    (b) => b.reason && PROTECTED_REASONS.includes(b.reason),
  );
  if (newestSafety && !toKeep.some((b) => b.id === newestSafety.id)) {
    // Evict the oldest kept slot to make room
    toKeep.pop();
    toKeep.push(newestSafety);
    toKeep.sort((a, b) => b.createdAt - a.createdAt);
  }

  const pruned = backups.length - toKeep.length;

  await saveBackups(dbName, toKeep);
  return pruned;
}

/**
 * Check if a backup is due (last backup was >24h ago).
 */
export async function isBackupDue(dbName: string): Promise<boolean> {
  const key = getBackupMetaKey(dbName);
  const result = await browser.storage.local.get(key);
  const meta = result[key] as BackupMeta | undefined;

  if (!meta?.lastBackupTime) return true; // never backed up

  const elapsed = Date.now() - meta.lastBackupTime * 1000;
  return elapsed >= BACKUP_COOLDOWN_MS;
}

/**
 * Take a throttled snapshot BEFORE a sync runs, if conditions are met:
 * 1. Backup feature is enabled (caller should check)
 * 2. Last backup was >24h ago
 *
 * Running before the sync (rather than after) is deliberate: a sync that pulls
 * a stale or empty remote file can mirror deletions into the local DB, so the
 * useful snapshot is the one taken while the data is still intact.
 *
 * Never throws — a failed snapshot must not block the sync itself.
 */
export async function maybeCreatePreSyncBackup(
  dbName: string,
  maxSlots: number,
): Promise<{ created: boolean; error?: string }> {
  try {
    const due = await isBackupDue(dbName);
    if (!due) {
      return { created: false };
    }

    await createBackup(dbName, 'pre-sync');
    console.log(`[Backup] Pre-sync backup created for ${dbName}`);

    // Prune old backups
    const pruned = await pruneBackups(dbName, maxSlots);
    if (pruned > 0) {
      console.log(`[Backup] Pruned ${pruned} old backup(s)`);
    }

    return { created: true };
  } catch (err: any) {
    console.error('[Backup] Pre-sync backup failed:', err.message);
    return { created: false, error: err.message };
  }
}

/**
 * Take an un-throttled safety snapshot right before a destructive operation.
 *
 * Unlike `maybeCreatePreSyncBackup` this ignores the 24h cooldown, because the
 * caller has already determined that rows are about to be deleted.
 *
 * Deduplicates against an identical snapshot taken in the last minute so sync
 * retries don't fill every slot with the same data.
 *
 * THROWS on failure — callers are expected to abort the destructive operation
 * rather than proceed without a recovery point.
 */
export async function createSafetyBackup(
  dbName: string,
  maxSlots: number,
  options: {
    reason?: BackupReason;
    /**
     * Whether to prune immediately. Set false when the caller is about to read
     * another slot (e.g. a restore), since pruning could evict that slot.
     */
    prune?: boolean;
  } = {},
): Promise<{ created: boolean }> {
  const { reason = 'pre-merge-delete', prune = true } = options;

  const backups = await loadBackups(dbName);
  const newest = backups
    .filter((b) => b.reason === reason)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (
    newest &&
    Date.now() - newest.createdAt * 1000 < SAFETY_BACKUP_DEDUPE_MS
  ) {
    console.log(`[Backup] Safety backup skipped (duplicate) for ${dbName}`);
    return { created: false };
  }

  await createBackup(dbName, reason);
  console.log(`[Backup] Safety backup (${reason}) created for ${dbName}`);

  if (prune) {
    const pruned = await pruneBackups(dbName, maxSlots);
    if (pruned > 0) {
      console.log(`[Backup] Pruned ${pruned} old backup(s)`);
    }
  }

  return { created: true };
}
