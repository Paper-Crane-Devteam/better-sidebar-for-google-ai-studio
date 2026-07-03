import { folderRepo } from '@/shared/db/operations';
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
