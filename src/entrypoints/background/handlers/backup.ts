/**
 * Background handler for backup (save slots) operations.
 * Lists, creates, deletes, and restores backup snapshots stored locally.
 */

import type {
  ExtensionMessage,
  ExtensionResponse,
} from '@/shared/types/messages';
import type { MessageSender } from '../types';
import {
  listBackups,
  createBackup,
  deleteBackup,
  restoreBackup,
  pruneBackups,
  createSafetyBackup,
} from '@/shared/lib/gdrive';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { notifyDataUpdated } from '../notify';
import { withDbSession } from '@/shared/db';

export async function handleBackup(
  message: ExtensionMessage,
  _sender: MessageSender,
): Promise<ExtensionResponse | null> {
  switch (message.type) {
    case 'BACKUP_LIST': {
      try {
        const backups = await listBackups(message.payload.dbName);
        // Strip the `data` field from response to keep message size small
        const stripped = backups.map(({ data, ...rest }) => rest);
        return { success: true, data: stripped };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'BACKUP_CREATE': {
      try {
        const { dbName } = message.payload;

        // Pinned session: the export reads every sync table in sequence, so a
        // concurrent database switch would produce a snapshot mixing profiles.
        const backup = await withDbSession(dbName, () =>
          createBackup(dbName),
        );

        // Prune to max slots
        const { backupMaxSlots } = usePegasusStore.getState();
        await pruneBackups(dbName, backupMaxSlots);

        // Return without the data payload
        const { data, ...stripped } = backup;
        return { success: true, data: stripped };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'BACKUP_DELETE': {
      try {
        const { dbName, backupId } = message.payload;
        await deleteBackup(dbName, backupId);
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }

    case 'BACKUP_RESTORE': {
      try {
        const { dbName, backupId } = message.payload;

        // Restoring clears every sync table before inserting, so the current
        // state would be unrecoverable if the user picked the wrong slot.
        // Snapshot it first, and abort the restore if that fails.
        // Pruning is deferred until after the restore — it could otherwise
        // evict the very slot being restored from.
        const { backupMaxSlots } = usePegasusStore.getState();

        // Pinned session: the snapshot and the restore must both apply to this
        // profile. A switch in between would snapshot one and overwrite another.
        await withDbSession(dbName, async () => {
          await createSafetyBackup(dbName, backupMaxSlots, {
            reason: 'pre-restore',
            prune: false,
          });
          await restoreBackup(dbName, backupId);
        });

        await pruneBackups(dbName, backupMaxSlots);
        await notifyDataUpdated();
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }

    default:
      return null;
  }
}
