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
} from '@/shared/lib/gdrive';
import type { AutoSyncHooks } from '@/shared/lib/gdrive';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import i18n from '@/locale/i18n';
import { notifyDataUpdated } from '../notify';
import { getCurrentDbName, ensureDbForActiveTab } from '../tab-profile-map';

function getSyncFileName(): string {
  return `better-sidebar-sync__${getCurrentDbName()}.json`;
}

function getSyncMetaKey(): string {
  return `gdrive_last_sync_time__${getCurrentDbName()}`;
}

function getSyncDirectionKey(): string {
  return `gdrive_last_sync_dir__${getCurrentDbName()}`;
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
async function createPreSyncBackup(): Promise<void> {
  const { backupEnabled, backupMaxSlots } = usePegasusStore.getState();
  if (!backupEnabled) return;
  await maybeCreatePreSyncBackup(getCurrentDbName(), backupMaxSlots);
}

/**
 * Take an un-throttled safety snapshot right before a destructive operation.
 * Throws on failure so the caller abandons the operation rather than destroying
 * data without a recovery point.
 *
 * Ignores the backupEnabled setting on purpose: this is a last-resort recovery
 * point, not a routine snapshot.
 */
async function captureSafetyBackup(context: string): Promise<void> {
  const { backupMaxSlots } = usePegasusStore.getState();
  console.log(`[GDriveSync] ${context} — capturing safety snapshot`);
  await createSafetyBackup(getCurrentDbName(), backupMaxSlots);
}

/** Safety snapshot hook for the merge's deletion phase. */
async function createPreDeleteBackup(plan: {
  total: number;
  byTable: Record<string, number>;
}): Promise<void> {
  await captureSafetyBackup(
    `merge plans to delete ${plan.total} row(s) ${JSON.stringify(plan.byTable)}`,
  );
}

/** Backup hooks shared by every sync entry point. */
export const syncBackupHooks: AutoSyncHooks = {
  onBeforeSync: createPreSyncBackup,
  onBeforeDestructiveMerge: createPreDeleteBackup,
};

/**
 * Trigger a debounced auto-sync after local data changes.
 * Respects the gdriveAutoSync setting from pegasus store.
 */
export function triggerAutoSync(): void {
  const { gdriveAutoSync } = usePegasusStore.getState();
  if (gdriveAutoSync) {
    scheduleDebouncedSync(getCurrentDbName());
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
  const { gdriveAutoSync } = usePegasusStore.getState();
  if (!gdriveAutoSync) return;
  triggerSyncOnPageLoad(
    getCurrentDbName(),
    ensureDbForActiveTab,
    () => notifyDataUpdated(),
    syncBackupHooks,
  );
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

        // Snapshot first — this overwrites the remote file, so the local state
        // being uploaded is the last chance to capture a recovery point.
        await createPreSyncBackup();

        const token = await getAccessToken();
        const syncFileName = getSyncFileName();

        const syncData = await exportSyncData();
        const existing = await findFile(token, syncFileName);
        await uploadFile(token, syncFileName, syncData, existing?.id);

        const now = await saveSyncMeta('up');

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
        const token = await getAccessToken();
        const syncFileName = getSyncFileName();

        const file = await findFile(token, syncFileName);
        if (!file) {
          return {
            success: false,
            error: i18n.t('data.gdriveNoBackupFound'),
          };
        }

        const content = await downloadFile(token, file.id);

        // importSyncData clears every sync table before inserting, so this is
        // an unconditional overwrite. Snapshot first, and abort if that fails.
        await captureSafetyBackup('sync-down overwrites all local tables');

        await importSyncData(content);

        const now = await saveSyncMeta('down');
        await notifyDataUpdated();

        return { success: true, data: { lastSyncTime: now } };
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
          dbName: getCurrentDbName(),
          ensureActiveDb: ensureDbForActiveTab,
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
