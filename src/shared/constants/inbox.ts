/**
 * The Inbox folder is a special permanent folder that:
 * - Has a fixed deterministic ID per platform
 * - Cannot be deleted or renamed
 * - Always appears last in the tree (unless pinned)
 * - Uses a dedicated inbox icon
 * - Settings only allow changing its color
 */

/** Generate the deterministic inbox folder ID for a given platform */
export function INBOX_FOLDER_ID(platform: string): string {
  return `__default_sync_folder__${platform}`;
}

/** Check whether a folder ID is an inbox folder */
export function isInboxFolder(folderId: string): boolean {
  return folderId.startsWith('__default_sync_folder__');
}
