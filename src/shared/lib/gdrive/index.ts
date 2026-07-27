export {
  authenticate,
  disconnect,
  getAuthStatus,
  getAccessToken,
  silentRefresh,
  isGdriveAuthSupported,
} from './google-auth';
export {
  findFile,
  uploadFile,
  downloadFile,
  getFileMetadata,
  deleteFile,
} from './gdrive-api';
export { exportSyncData, importSyncData } from './sync-data';
export { mergeSyncData } from './sync-merge';
export {
  performMergeSync,
  scheduleDebouncedSync,
  flushPendingSync,
  registerAutoSyncAlarm,
  handleAutoSyncAlarm,
  isAutoSyncing,
  triggerSyncOnPageLoad,
  onSyncingChange,
} from './auto-sync';
export {
  listBackups,
  createBackup,
  deleteBackup,
  restoreBackup,
  pruneBackups,
  isBackupDue,
  maybeCreateAutoBackup,
} from './backup';
export type { SyncPayload } from './sync-data';
export type { MergeResult } from './sync-merge';
export type { AuthStatus } from './google-auth';
export type { AutoSyncOptions } from './auto-sync';
export type { BackupSlot } from './backup';
