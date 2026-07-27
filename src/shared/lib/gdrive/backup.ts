/**
 * Backup (Save Slots) Manager.
 *
 * Stores periodic snapshots of sync data in browser.storage.local.
 * Each profile gets its own set of backup slots, namespaced by dbName.
 * Maximum slots is configurable (1–20, default 5).
 *
 * Backup is triggered after a successful sync (local data change detected),
 * only if the last backup was >24h ago.
 *
 * Does NOT depend on Google Drive — works purely with local storage.
 * If GDrive is also connected, data is already synced there separately;
 * backups serve as point-in-time recovery regardless.
 */

import { exportSyncData, importSyncData } from './sync-data';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BackupSlot {
  id: string; // Unique ID (timestamp-based)
  createdAt: number; // Unix timestamp (seconds)
  size: number; // Approximate size in bytes
  data: string; // The full JSON export
}

export interface BackupMeta {
  /** Per-profile last backup timestamp (seconds) */
  lastBackupTime: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BACKUP_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_SLOTS_LIMIT = 20;

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
export async function createBackup(dbName: string): Promise<BackupSlot> {
  const now = Math.floor(Date.now() / 1000);
  const data = await exportSyncData();

  const slot: BackupSlot = {
    id: `backup-${now}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    size: new Blob([data]).size,
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
 * Keeps the newest N slots.
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
 * Perform an automatic backup if conditions are met:
 * 1. Backup feature is enabled (caller should check)
 * 2. Last backup was >24h ago
 *
 * Called after successful sync or local data changes.
 */
export async function maybeCreateAutoBackup(
  dbName: string,
  maxSlots: number,
): Promise<{ created: boolean; error?: string }> {
  try {
    const due = await isBackupDue(dbName);
    if (!due) {
      return { created: false };
    }

    // Create backup
    await createBackup(dbName);
    console.log(`[Backup] Auto-backup created for ${dbName}`);

    // Prune old backups
    const pruned = await pruneBackups(dbName, maxSlots);
    if (pruned > 0) {
      console.log(`[Backup] Pruned ${pruned} old backup(s)`);
    }

    return { created: true };
  } catch (err: any) {
    console.error('[Backup] Auto-backup failed:', err.message);
    return { created: false, error: err.message };
  }
}
