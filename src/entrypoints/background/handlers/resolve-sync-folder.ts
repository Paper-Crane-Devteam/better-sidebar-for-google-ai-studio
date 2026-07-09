import { folderRepo } from '@/shared/db/operations';
import { gemRepo } from '@/shared/db/operations/gems';
import { notebookRepo } from '@/shared/db/operations/notebooks';
import i18n from '@/locale/i18n';
import { INBOX_FOLDER_ID } from '@/shared/constants/inbox';

/**
 * Resolve the folder ID to use for new synced/scanned conversations.
 * Always uses the fixed Inbox folder — find or create it.
 */
export async function resolveSyncFolderId(
  platform: string,
): Promise<string | null> {
  const inboxId = INBOX_FOLDER_ID(platform);

  // Check if inbox already exists by ID
  const existing = await folderRepo.getById(inboxId);
  if (existing) return inboxId;

  // Check by name (handles legacy folders created with random UUIDs)
  const importedName = i18n.t('explorer.imported');
  const folders = await folderRepo.getAll(platform);
  const byName = folders.find(
    (f) => f.name === importedName || f.name === 'Inbox' || f.name === 'Imported',
  );
  if (byName) return byName.id;

  // Create with deterministic ID
  await folderRepo.create({ id: inboxId, name: importedName, platform });
  return inboxId;
}

/**
 * Resolve the folder ID for a conversation that belongs to a gem or notebook.
 * Checks the gem/notebook's default_folder_id setting first.
 * If set, ensures the folder exists (creates it if needed), then returns its ID.
 * Falls back to resolveSyncFolderId (Inbox) if not set or folder is invalid.
 */
export async function resolveGemNotebookFolderId(
  platform: string,
  gemId?: string | null,
  notebookId?: string | null,
): Promise<string | null> {
  // Check gem's default folder
  if (gemId) {
    const gem = await gemRepo.getById(gemId);
    if (gem?.default_folder_id) {
      const folder = await folderRepo.getById(gem.default_folder_id);
      if (folder) return gem.default_folder_id;
      // Folder was deleted — fall through to inbox
    }
  }

  // Check notebook's default folder
  if (notebookId) {
    const notebook = await notebookRepo.getById(notebookId);
    if (notebook?.default_folder_id) {
      const folder = await folderRepo.getById(notebook.default_folder_id);
      if (folder) return notebook.default_folder_id;
      // Folder was deleted — fall through to inbox
    }
  }

  // Fallback to inbox
  return resolveSyncFolderId(platform);
}
