/**
 * Background handler for Google Drive sync operations.
 * Handles auth, sync up (backup), sync down (restore), merge, and status queries.
 * Each profile syncs to a separate file on Drive (namespaced by dbName).
 */

import type {
  ExtensionMessage,
  ExtensionResponse,
} from '@/shared/types/messages';
import type { MessageSender } from '../types';
import {
  authenticate,
  disconnect,
  getAuthStatus,
  getAccessToken,
  findFile,
  uploadFile,
  downloadFile,
  exportSyncData,
  importSyncData,
  performMergeSync,
  scheduleDebouncedSync,
  isAutoSyncing,
  triggerSyncOnPageLoad,
  maybeCreatePreSyncBackup,
  createSafetyBackup,
  getAccountId,
  resolveSyncTarget,
  checkSyncOrigin,
} from '@/shared/lib/gdrive';
import type { AutoSyncHooks } from '@/shared/lib/gdrive';
import { withDbSession } from '@/shared/db';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import i18n from '@/locale/i18n';
import { notifyDataUpdated } from '../notify';
import { getCurrentDbName } from '../tab-profile-map';

/**
 * The active dbName, or throw.
 *
 * `getCurrentDbName()` returns null until the active profile has been resolved.
 * Every sync and backup operation is namespaced by dbName, so proceeding with a
 * placeholder would read and write the wrong profile's data. Failing is the only
 * correct option.
 */
function requireDbName(): string {
  const dbName = getCurrentDbName();
  if (!dbName) {
    throw new Error(
      'Active profile database is not resolved yet — try again in a moment',
    );
  }
  return dbName;
}

function getSyncMetaKey(): string {
  return `gdrive_last_sync_time__${requireDbName()}`;
}

function getSyncDirectionKey(): string {
  return `gdrive_last_sync_dir__${requireDbName()}`;
}

/** Save sync metadata (time + direction) */
async function saveSyncMeta(direction: 'up' | 'down' | 'merge'): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  await browser.storage.local.set({
    [getSyncMetaKey()]: now,
    [getSyncDirectionKey()]: direction,
  });
  return now;
}

/**
 * Take a throttled snapshot before a sync run.
 * Respects the backupEnabled setting from pegasus store.
 *
 * Deliberately runs BEFORE the sync: a sync that pulls a stale or empty remote
 * file can mirror those deletions into the local DB, so the snapshot worth
 * keeping is the one captured while the data is still intact.
 */
async function createPreSyncBackup(dbName?: string): Promise<void> {
  const { backupEnabled, backupMaxSlots } = usePegasusStore.getState();
  if (!backupEnabled) return;
  // Prefer the caller's verified dbName; fall back to the ambient one only when
  // there is no sync in flight to take it from.
  const target = dbName ?? getCurrentDbName();
  if (!target) return; // profile unresolved — nothing safe to snapshot
  await maybeCreatePreSyncBackup(target, backupMaxSlots);
}

/**
 * Take an un-throttled safety snapshot right before a destructive operation.
 * Throws on failure so the caller abandons the operation rather than destroying
 * data without a recovery point.
 *
 * Ignores the backupEnabled setting on purpose: this is a last-resort recovery
 * point, not a routine snapshot.
 */
async function captureSafetyBackup(
  context: string,
  dbName?: string,
): Promise<void> {
  const { backupMaxSlots } = usePegasusStore.getState();
  // Throws if the profile is unresolved — correct, since the caller is about to
  // destroy data and must not do so without a recovery point.
  const target = dbName ?? requireDbName();
  console.log(`[GDriveSync] ${context} — capturing safety snapshot`);
  await createSafetyBackup(target, backupMaxSlots);
}

/** Backup hooks shared by every sync entry point. */
export const syncBackupHooks: AutoSyncHooks = {
  onBeforeSync: (dbName) => createPreSyncBackup(dbName),
  onBeforeDestructiveMerge: (dbName, plan) =>
    captureSafetyBackup(
      `merge plans to delete ${plan.total} row(s) ${JSON.stringify(plan.byTable)}`,
      dbName,
    ),
};

/**
 * Trigger a debounced auto-sync after local data changes.
 * Respects the gdriveAutoSync setting from pegasus store.
 */
export function triggerAutoSync(): void {
  const dbName = getCurrentDbName();
  if (!dbName) return; // profile unresolved — don't guess which DB to sync

  const { gdriveAutoSync } = usePegasusStore.getState();
  if (gdriveAutoSync) {
    scheduleDebouncedSync(dbName);
    // The scheduled sync takes its own pre-sync snapshot via syncBackupHooks.
    return;
  }
  // GDrive off: backups are still wanted, and there is no sync to hook into,
  // so fall back to a throttled snapshot on local data change.
  createPreSyncBackup();
}

/**
 * Trigger a merge sync on page load (called after SYNC_CONVERSATIONS).
 * Respects the gdriveAutoSync setting and uses a 5-minute cooldown.
 */
export function triggerPageLoadSync(): void {
  const dbName = getCurrentDbName();
  if (!dbName) return; // profile unresolved — don't guess which DB to sync

  const { gdriveAutoSync } = usePegasusStore.getState();
  if (!gdriveAutoSync) return;
  triggerSyncOnPageLoad(dbName, () => notifyDataUpdated(), syncBackupHooks);
}

export async function handleGdriveSync(
  message: ExtensionMessage,
  _sender: MessageSender,
): Promise<ExtensionResponse | null> {
  switch (message.type) {
    case 'GDRIVE_AUTH': {
      try {
        await authenticate();
        const status = await getAuthStatus();
        return { success: true, data: status };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'GDRIVE_DISCONNECT': {
      try {
        await disconnect();
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'GDRIVE_GET_STATUS': {
      try {
        const authStatus = await getAuthStatus();
        const metaKey = getSyncMetaKey();
        const dirKey = getSyncDirectionKey();
        const meta = await browser.storage.local.get([metaKey, dirKey]);
        return {
          success: true,
          data: {
            ...authStatus,
            lastSyncTime: meta[metaKey] || null,
            lastSyncDirection: meta[dirKey] || null,
            autoSyncing: isAutoSyncing(),
          },
        };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'GDRIVE_SYNC_UP': {
      try {
        usePegasusStore.getState().setGdriveSyncing(true);
        const dbName = requireDbName();

        // Pinned session: exportSyncData reads 11 tables in sequence, and a
        // concurrent tab message would otherwise be able to switch the database
        // partway through, uploading a mix of two profiles.
        const now = await withDbSession(dbName, async () => {
          // Snapshot first — this overwrites the remote file, so the local state
          // being uploaded is the last chance to capture a recovery point.
          await createPreSyncBackup(dbName);

          const token = await getAccessToken();
          const accountId = await getAccountId(token);
          const target = await resolveSyncTarget(
            token,
            dbName,
            accountId,
            downloadFile,
          );

          const syncData = await exportSyncData({ dbName, accountId });
          await uploadFile(token, target.fileName, syncData, target.file?.id);

          return saveSyncMeta('up');
        });

        return { success: true, data: { lastSyncTime: now } };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      } finally {
        usePegasusStore.getState().setGdriveSyncing(false);
      }
    }

    case 'GDRIVE_SYNC_DOWN': {
      try {
        usePegasusStore.getState().setGdriveSyncing(true);
        const dbName = requireDbName();

        // Pinned session: importSyncData empties and refills 11 tables, so a
        // mid-operation database switch would clear one profile and repopulate
        // another.
        const result = await withDbSession(dbName, async () => {
          const token = await getAccessToken();
          const accountId = await getAccountId(token);
          const target = await resolveSyncTarget(
            token,
            dbName,
            accountId,
            downloadFile,
          );

          if (!target.file) {
            return { error: i18n.t('data.gdriveNoBackupFound') } as const;
          }

          const content =
            target.content ?? (await downloadFile(token, target.file.id));

          // Refuse to overwrite local data with another profile's or account's
          const originCheck = checkSyncOrigin(content, { dbName, accountId });
          if (!originCheck.ok) {
            return { error: `Download aborted — ${originCheck.reason}` } as const;
          }

          // importSyncData clears every sync table before inserting, so this is
          // an unconditional overwrite. Snapshot first, and abort if that fails.
          await captureSafetyBackup(
            'sync-down overwrites all local tables',
            dbName,
          );

          await importSyncData(content);

          return { lastSyncTime: await saveSyncMeta('down') } as const;
        });

        if ('error' in result) {
          return { success: false, error: result.error };
        }

        await notifyDataUpdated();
        return { success: true, data: { lastSyncTime: result.lastSyncTime } };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      } finally {
        usePegasusStore.getState().setGdriveSyncing(false);
      }
    }

    case 'GDRIVE_MERGE': {
      try {
        usePegasusStore.getState().setGdriveSyncing(true);
        const result = await performMergeSync({
          dbName: requireDbName(),
          onSyncComplete: () => notifyDataUpdated(),
          ...syncBackupHooks,
        });

        if (!result.success) {
          return { success: false, error: result.error };
        }

        await saveSyncMeta('merge');
        const metaKey = getSyncMetaKey();
        const meta = await browser.storage.local.get(metaKey);

        return {
          success: true,
          data: { lastSyncTime: meta[metaKey] || null },
        };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      } finally {
        usePegasusStore.getState().setGdriveSyncing(false);
      }
    }

    case 'GDRIVE_CHECK_SUPPORT': {
      return {
        success: true,
        data:
          typeof chrome !== 'undefined' && !!chrome.identity?.launchWebAuthFlow,
      };
    }

    default:
      return null;
  }
}
