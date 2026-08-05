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
export {
  resolveSyncTarget,
  checkSyncOrigin,
  legacySyncFileName,
  scopedSyncFileName,
} from './sync-identity';
export {
  performSyncUp,
  recordSyncSuccess,
  hasSyncConflict,
  markSyncConflict,
  markDirty,
  checkRemoteForUpdates,
  checkRemoteOnPageLoad,
  scheduleDebouncedSync,
  flushPendingSync,
  registerAutoSyncAlarm,
  handleAutoSyncAlarm,
  isAutoSyncing,
  onSyncingChange,
  syncTimeKey,
  syncDirectionKey,
  remoteMtimeKey,
  conflictKey,
  dirtyKey,
  syncStorageKeys,
} from './auto-sync';
export {
  listBackups,
  createBackup,
  deleteBackup,
  restoreBackup,
  pruneBackups,
  isBackupDue,
  maybeCreateRoutineBackup,
  createSafetyBackup,
} from './backup';
export type { SyncPayload, SyncOrigin } from './sync-data';
export type { SyncTarget, OriginCheck } from './sync-identity';
export type { AuthStatus } from './google-auth';
export type { PushOptions, PushResult } from './auto-sync';
export type { BackupSlot, BackupReason } from './backup';
