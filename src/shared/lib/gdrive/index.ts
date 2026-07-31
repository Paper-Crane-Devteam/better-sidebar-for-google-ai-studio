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
  getAccountId,
} from './gdrive-api';
export { exportSyncData, importSyncData, SYNC_TABLES } from './sync-data';
export { mergeSyncData } from './sync-merge';
export {
  resolveSyncTarget,
  checkSyncOrigin,
  legacySyncFileName,
  scopedSyncFileName,
} from './sync-identity';
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
  maybeCreatePreSyncBackup,
  createSafetyBackup,
} from './backup';
export type { SyncPayload, SyncOrigin } from './sync-data';
export type { MergeResult, MergeOptions } from './sync-merge';
export type { SyncTarget, OriginCheck } from './sync-identity';
export type { AuthStatus } from './google-auth';
export type { AutoSyncOptions, AutoSyncHooks } from './auto-sync';
export type { BackupSlot, BackupReason } from './backup';
