import { rawSql, dbAdmin } from '@/shared/db/operations';
import type { ExtensionMessage, ExtensionResponse } from '@/shared/types/messages';
import type { MessageSender } from '../types';
import { notifyDataUpdated } from '../notify';
import { getCurrentDbName } from '../tab-profile-map';
import {
  markSyncConflict,
  syncTimeKey,
  syncDirectionKey,
} from '@/shared/lib/gdrive';

const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB

export async function handleDbAdmin(
  message: ExtensionMessage,
  sender: MessageSender
): Promise<ExtensionResponse | null> {
  switch (message.type) {
    case 'EXECUTE_SQL': {
      try {
        const result = await rawSql.execute(message.payload.sql);

        // Write operations (INSERT/UPDATE/DELETE) change data that the sidebar
        // and other UI surfaces read from the store. Without a notification the
        // user has to reload the page to see the effect — e.g. a new folder
        // created by the agent loop.
        const isWrite = !/^\s*SELECT\b/i.test(message.payload.sql);
        if (isWrite) {
          notifyDataUpdated().catch(() => {});
        }

        return { success: true, data: result };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    case 'RESET_DATABASE': {
      try {
        await dbAdmin.resetDatabase();
        await notifyDataUpdated();

        // Freeze automatic uploads. The local DB is now empty while the remote
        // file still holds the old data, and an automatic push would overwrite
        // it — wiping local data is not the same request as wiping the backup.
        // The user resolves it explicitly: upload to make the reset global, or
        // download to restore from the remote copy.
        //
        // The recorded remote modifiedTime is deliberately kept, so the choice
        // stays available even if the flag is cleared.
        const dbName = getCurrentDbName();
        if (dbName) {
          await markSyncConflict(dbName);
          await browser.storage.local.remove([
            syncTimeKey(dbName),
            syncDirectionKey(dbName),
          ]);
        }

        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    case 'VACUUM_DATABASE': {
      try {
        await dbAdmin.vacuum();
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    case 'EXPORT_DATABASE': {
      try {
        const data = await dbAdmin.export();
        if (data.length <= CHUNK_SIZE) {
          return { success: true, data };
        }

        const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
        const transferId = crypto.randomUUID();
        (async () => {
          for (let i = 0; i < totalChunks; i++) {
            const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            const msg = {
              type: 'EXPORT_CHUNK',
              payload: { transferId, chunk, index: i, total: totalChunks },
            };
            try {
              if (sender.tab?.id) {
                await browser.tabs.sendMessage(sender.tab.id, msg);
              } else {
                await browser.runtime.sendMessage(msg);
              }
            } catch (err) {
              console.error('[Background] Failed to send export chunk', i, err);
              break;
            }
            await new Promise((r) => setTimeout(r, 10));
          }
        })();
        return { success: true, data: { chunked: true, transferId, totalChunks } };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    case 'IMPORT_DATABASE': {
      try {
        const { data, chunk } = message.payload;
        await dbAdmin.import(data, chunk);
        if (!chunk || chunk.index === chunk.total - 1) {
          await notifyDataUpdated();
        }
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    default:
      return null;
  }
}
