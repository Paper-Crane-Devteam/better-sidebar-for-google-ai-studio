/**
 * Background handler for Google Drive sync operations.
 *
 * The data surface is deliberately just two whole-file operations:
 *
 *   GDRIVE_SYNC_UP    local  → remote   (never touches local data)
 *   GDRIVE_SYNC_DOWN  remote → local    (replaces every local sync table)
 *
 * There is no row-level merge. Inferring which rows were deleted on another
 * device requires deletion records that most tables don't keep, and the previous
 * timestamp-based approximation degraded into "delete anything the remote file
 * lacks" — see the note at the top of auto-sync.ts.
 *
 * Only `up` is automated, because it cannot lose local data. `down` is always an
 * explicit user action, confirmed in the UI and preceded by a safety snapshot.
 *
 * Each profile syncs to a separate file on Drive, namespaced by dbName and
 * Google account.
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
  downloadFile,
  importSyncData,
  performSyncUp,
  recordSyncSuccess,
  hasSyncConflict,
  markDirty,
  scheduleDebouncedSync,
  isAutoSyncing,
  checkRemoteOnPageLoad,
  maybeCreateRoutineBackup,
  createSafetyBackup,
  getAccountId,
  resolveSyncTarget,
  checkSyncOrigin,
  syncTimeKey,
  syncDirectionKey,
} from '@/shared/lib/gdrive';
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

/**
 * Take a throttled routine snapshot. Respects the backupEnabled setting.
 *
 * This is independent of syncing: it exists so there is a local recovery point
 * even for users who never connect Drive.
 */
async function createRoutineBackup(dbName?: string): Promise<void> {
  const { backupEnabled, backupMaxSlots } = usePegasusStore.getState();
  if (!backupEnabled) return;
  const target = dbName ?? getCurrentDbName();
  if (!target) return; // profile unresolved — nothing safe to snapshot

  // Pinned: the snapshot reads eleven tables in sequence while being filed under
  // `target`. Unpinned, a concurrent tab message switches the database partway
  // through and the slot ends up holding another profile's rows — which then
  // fails to restore, because the two profiles need not even have the same
  // columns.
  await withDbSession(target, () =>
    maybeCreateRoutineBackup(target, backupMaxSlots),
  );
}

/**
 * Take an un-throttled safety snapshot before local data is replaced.
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
  // replace local data and must not do so without a recovery point.
  const target = dbName ?? requireDbName();
  console.log(`[GDriveSync] ${context} — capturing safety snapshot`);
  await createSafetyBackup(target, backupMaxSlots);
}

/**
 * Called after any local data change. Keeps a routine snapshot flowing and, if
 * auto-sync is on, schedules a debounced upload.
 *
 * The snapshot is unconditional rather than something the upload hooks into:
 * uploading cannot harm local data, so the two concerns are unrelated.
 */
export function triggerAutoSync(): void {
  const dbName = getCurrentDbName();
  if (!dbName) return; // profile unresolved — don't guess which DB to touch

  createRoutineBackup(dbName);

  const { gdriveAutoSync } = usePegasusStore.getState();
  if (gdriveAutoSync) {
    // Marked before scheduling, so a debounce that never runs (offline, SW
    // killed) is still visible to the periodic retry.
    markDirty(dbName);
    scheduleDebouncedSync(dbName);
  }
}

/**
 * On page load, check whether Drive holds a newer copy (called after
 * SYNC_CONVERSATIONS). Read-only: nothing is uploaded or downloaded.
 *
 * Respects the gdriveAutoSync setting and uses a 5-minute cooldown.
 */
export function triggerPageLoadSync(): void {
  const dbName = getCurrentDbName();
  if (!dbName) return; // profile unresolved — don't guess which DB to check

  const { gdriveAutoSync } = usePegasusStore.getState();
  if (!gdriveAutoSync) return;
  checkRemoteOnPageLoad(dbName);
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
        const dbName = requireDbName();
        const metaKey = syncTimeKey(dbName);
        const dirKey = syncDirectionKey(dbName);
        const meta = await browser.storage.local.get([metaKey, dirKey]);
        return {
          success: true,
          data: {
            ...authStatus,
            lastSyncTime: meta[metaKey] || null,
            lastSyncDirection: meta[dirKey] || null,
            autoSyncing: isAutoSyncing(),
            hasConflict: await hasSyncConflict(dbName),
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

        // A user-initiated upload is authoritative: they are looking at this
        // profile and asked for it to become the remote snapshot. Skip the
        // divergence check that holds back automatic pushes.
        const result = await performSyncUp({ dbName, force: true });

        if (!result.success) {
          return { success: false, error: result.error };
        }

        const metaKey = syncTimeKey(dbName);
        const meta = await browser.storage.local.get(metaKey);
        return { success: true, data: { lastSyncTime: meta[metaKey] || null } };
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

        // Pinned session: importSyncData empties and refills eleven tables, so a
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

          // Local now equals the remote file, so its modifiedTime becomes the
          // agreed baseline — without this the next automatic push would read
          // the untouched remote as a conflict.
          const lastSyncTime = await recordSyncSuccess(
            dbName,
            'down',
            target.file.modifiedTime,
          );

          return { lastSyncTime } as const;
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
