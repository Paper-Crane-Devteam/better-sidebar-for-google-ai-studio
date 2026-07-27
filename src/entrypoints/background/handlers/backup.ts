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
} from '@/shared/lib/gdrive';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { notifyDataUpdated } from '../notify';

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
        const backup = await createBackup(dbName);

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
        await restoreBackup(dbName, backupId);
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
