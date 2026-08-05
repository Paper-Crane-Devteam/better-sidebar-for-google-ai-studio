/**
 * Auto-push manager for Google Drive.
 *
 * ── Why this only pushes ─────────────────────────────────────────────────────
 * Sync has exactly two operations, both whole-file replacements:
 *
 *   push (up)   local  → remote    never touches local data
 *   pull (down) remote → local     replaces every local sync table
 *
 * Only `push` is automated. It cannot lose local data — the worst case is that
 * the remote file ends up holding an older snapshot, which the next push fixes.
 * `pull` is destructive by definition, so it stays manual, confirmed, and
 * preceded by a safety snapshot (see the background handler).
 *
 * The previous design automated a bidirectional row-level merge that inferred
 * remote deletions from `lastSyncTime`. That inference cannot be made correct
 * without deletion records: because `lastSyncTime` advances to "now" after every
 * run, on the next run nearly every local row looks older than it, so the rule
 * degraded into "delete anything the remote file lacks". The safety guards added
 * to contain that produced partial deletions, which left the two sides
 * permanently divergent and resurrected remote deletions on the following push.
 * Whole-file replacement has none of those failure modes.
 *
 * ── SW-safe design ───────────────────────────────────────────────────────────
 * All state is persisted to browser.storage.local and all scheduling uses
 * chrome.alarms, so nothing is lost when the service worker is terminated.
 * No setTimeout for scheduling, no in-memory-only state.
 */

import { getAccessToken, getAuthStatus, silentRefresh } from './google-auth';
import { uploadFile, downloadFile, getAccountId } from './gdrive-api';
import { exportSyncData } from './sync-data';
import { resolveSyncTarget } from './sync-identity';
import { withDbSession } from '@/shared/db';

// --- Constants ---

const PERIODIC_ALARM = 'gdrive-auto-sync';
const DEBOUNCE_ALARM = 'gdrive-debounce-sync';
const SYNC_INTERVAL_MINUTES = 25;
const DEBOUNCE_MINUTES = 0.25; // 15 seconds as fractional minutes
const LOCK_KEY = 'gdrive_sync_lock';
const LOCK_TTL_MS = 2 * 60 * 1000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3_000;
const PAGE_LOAD_SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/** Storage key for the pending debounce push's target dbName */
const PENDING_SYNC_DB_KEY = 'gdrive_pending_sync_db';

// --- In-memory guard (within a single SW lifecycle) ---

let isSyncing = false;

// --- Storage key helpers ---

/**
 * Sync metadata stays keyed by dbName only, not by the resolved file name.
 * The status UI reads these keys without a token, and a profile has exactly one
 * active sync file at a time, so the extra dimension would buy nothing.
 */
export function syncTimeKey(dbName: string): string {
  return `gdrive_last_sync_time__${dbName}`;
}

export function syncDirectionKey(dbName: string): string {
  return `gdrive_last_sync_dir__${dbName}`;
}

/**
 * Drive's `modifiedTime` for the remote file as of our last push or pull.
 *
 * This is the whole conflict story: if the current remote `modifiedTime` differs
 * from what we recorded, some other device wrote the file after we last agreed
 * with it, and an automatic push would silently discard that work.
 */
export function remoteMtimeKey(dbName: string): string {
  return `gdrive_remote_mtime__${dbName}`;
}

/** Set when an automatic push was skipped because the remote had diverged. */
export function conflictKey(dbName: string): string {
  return `gdrive_conflict__${dbName}`;
}

/**
 * Set when local data changed, cleared once it reaches Drive.
 *
 * Lets the periodic alarm tell "nothing to do" apart from "a push failed and
 * never got retried", so it can stay a cheap no-op in the common case instead of
 * re-uploading the whole database every 25 minutes.
 */
export function dirtyKey(dbName: string): string {
  return `gdrive_dirty__${dbName}`;
}

/** Every storage key this module owns, for cleanup when a profile is deleted. */
export function syncStorageKeys(dbName: string): string[] {
  return [
    syncTimeKey(dbName),
    syncDirectionKey(dbName),
    remoteMtimeKey(dbName),
    conflictKey(dbName),
    dirtyKey(dbName),
  ];
}

/** Mark local data as having changes that are not on Drive yet. */
export async function markDirty(dbName: string): Promise<void> {
  await browser.storage.local.set({ [dirtyKey(dbName)]: true });
}

async function isDirty(dbName: string): Promise<boolean> {
  const key = dirtyKey(dbName);
  const result = await browser.storage.local.get(key);
  return result[key] === true;
}

// --- Lock (persisted, survives SW restart) ---

async function acquireLock(): Promise<boolean> {
  const result = await browser.storage.local.get(LOCK_KEY);
  const lockTime = result[LOCK_KEY] as number | undefined;

  if (lockTime && Date.now() - lockTime < LOCK_TTL_MS) {
    return false;
  }

  await browser.storage.local.set({ [LOCK_KEY]: Date.now() });
  return true;
}

async function releaseLock(): Promise<void> {
  await browser.storage.local.remove(LOCK_KEY);
}

// --- Error classification ---

function isRetryable(err: any): boolean {
  if (!err?.response) return true;
  const status = err.response?.status;
  return status === 401 || status === 429 || status >= 500;
}

// --- Types ---

export interface PushOptions {
  /**
   * The profile database this push reads from. The connection is pinned to it
   * for the whole run, so this is the single source of truth — no ambient
   * "current database" is consulted.
   */
  dbName: string;
  /**
   * Overwrite the remote file even if another device modified it since our last
   * push. Only set this for an explicit user action.
   */
  force?: boolean;
  onComplete?: () => void;
}

export interface PushResult {
  success: boolean;
  error?: string;
  /**
   * True when the push was skipped because the remote file had been modified
   * elsewhere. Not an error — the caller surfaces it so the user can choose a
   * direction.
   */
  conflict?: boolean;
}

// --- Core push ---

/**
 * Upload the local database as the complete remote snapshot.
 * Singleton: if a push is already running, returns immediately.
 */
export async function performSyncUp(
  opts: PushOptions,
  retries = MAX_RETRIES,
): Promise<PushResult> {
  if (isSyncing) {
    console.log('[AutoSync] Already syncing, skipping');
    return { success: false, error: 'Already syncing' };
  }

  if (!(await acquireLock())) {
    console.log('[AutoSync] Lock held, skipping');
    return { success: false, error: 'Another sync in progress' };
  }

  isSyncing = true;

  try {
    // Everything below runs with the connection pinned to opts.dbName.
    //
    // exportSyncData reads eleven tables in sequence, and other extension
    // messages switch the active database to match their sender tab. Unpinned,
    // a switch landing mid-export would upload a mix of two profiles.
    return await withDbSession(opts.dbName, () => runSyncUp(opts));
  } catch (err: any) {
    if (retries > 0 && isRetryable(err)) {
      // On 401, try to refresh the token before retrying
      if (err?.response?.status === 401) {
        console.warn('[AutoSync] Got 401, attempting token refresh...');
        await silentRefresh();
      }
      console.warn(`[AutoSync] Retrying... (${retries} left)`, err.message);
      isSyncing = false;
      await releaseLock();
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return performSyncUp(opts, retries - 1);
    }

    console.error('[AutoSync] Failed:', err.message);
    return { success: false, error: err.message };
  } finally {
    isSyncing = false;
    await releaseLock();
  }
}

/**
 * The actual push body. Always invoked inside a pinned DB session.
 */
async function runSyncUp(opts: PushOptions): Promise<PushResult> {
  const token = await getAccessToken(true);
  const accountId = await getAccountId(token);

  const target = await resolveSyncTarget(
    token,
    opts.dbName,
    accountId,
    downloadFile,
  );

  // Refuse to clobber a remote file that changed under us, unless the user
  // explicitly asked for it. A first push (no remote file yet) can't conflict.
  if (!opts.force) {
    // The flag is sticky: once the two sides are known to have diverged, every
    // automatic push stays frozen until the user picks a direction. Nothing
    // else can resolve it — silently uploading would discard the other device's
    // work, silently downloading would discard this one's.
    if (await hasSyncConflict(opts.dbName)) {
      console.log('[AutoSync] Unresolved conflict, push frozen');
      return { success: false, conflict: true };
    }

    if (target.file) {
      const seenKey = remoteMtimeKey(opts.dbName);
      const stored = await browser.storage.local.get(seenKey);
      const lastSeen = stored[seenKey] as string | undefined;

      if (lastSeen && target.file.modifiedTime !== lastSeen) {
        console.warn(
          `[AutoSync] Remote changed elsewhere ` +
            `(seen ${lastSeen}, now ${target.file.modifiedTime}) — push skipped`,
        );
        await markSyncConflict(opts.dbName);
        return { success: false, conflict: true };
      }
    }
  }

  const localData = await exportSyncData({ dbName: opts.dbName, accountId });
  const uploaded = await uploadFile(
    token,
    target.fileName,
    localData,
    target.file?.id,
  );

  await recordSyncSuccess(opts.dbName, 'up', uploaded.modifiedTime);

  opts.onComplete?.();
  return { success: true };
}

/**
 * Record a successful sync: timestamp, direction, and the remote
 * `modifiedTime` the two sides now agree on. Clears any conflict flag.
 */
export async function recordSyncSuccess(
  dbName: string,
  direction: 'up' | 'down',
  remoteModifiedTime?: string,
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  await browser.storage.local.set({
    [syncTimeKey(dbName)]: now,
    [syncDirectionKey(dbName)]: direction,
    ...(remoteModifiedTime
      ? { [remoteMtimeKey(dbName)]: remoteModifiedTime }
      : {}),
  });
  // Both directions leave the two sides in agreement, so any conflict is
  // resolved and there is nothing left to upload.
  await browser.storage.local.remove([conflictKey(dbName), dirtyKey(dbName)]);
  return now;
}

/**
 * Check whether Drive holds a newer copy, without transferring any data.
 *
 * One metadata request. Never uploads and never writes to the local database —
 * it only raises the conflict flag so the UI can offer a download. Safe to call
 * on page load, where pushing would be pointless and pulling would be
 * presumptuous.
 */
export async function checkRemoteForUpdates(
  dbName: string,
): Promise<{ hasUpdate: boolean }> {
  const auth = await getAuthStatus();
  if (!auth.isAuthenticated) return { hasUpdate: false };

  if (await hasSyncConflict(dbName)) return { hasUpdate: true };

  try {
    const token = await getAccessToken(true);
    const accountId = await getAccountId(token);
    const target = await resolveSyncTarget(
      token,
      dbName,
      accountId,
      downloadFile,
    );

    if (!target.file) return { hasUpdate: false };

    const seenKey = remoteMtimeKey(dbName);
    const stored = await browser.storage.local.get(seenKey);
    const lastSeen = stored[seenKey] as string | undefined;

    // No baseline yet means we have never agreed with this file, which is not
    // the same as it being newer. Leave it to the next push to establish one.
    if (!lastSeen || target.file.modifiedTime === lastSeen) {
      return { hasUpdate: false };
    }

    console.log(
      `[AutoSync] Drive has a newer copy ` +
        `(seen ${lastSeen}, now ${target.file.modifiedTime})`,
    );
    await markSyncConflict(dbName);
    return { hasUpdate: true };
  } catch (err: any) {
    // A failed check is not worth surfacing — it changes nothing either way.
    console.warn('[AutoSync] Remote check failed:', err?.message ?? err);
    return { hasUpdate: false };
  }
}

/** Whether an automatic push is currently being held back by a conflict. */
export async function hasSyncConflict(dbName: string): Promise<boolean> {
  const key = conflictKey(dbName);
  const result = await browser.storage.local.get(key);
  return result[key] === true;
}

/**
 * Freeze automatic pushes until the user picks a direction.
 *
 * Also used after the local database is wiped or replaced out-of-band: local no
 * longer derives from the remote file, so an automatic push would upload the new
 * state over data the user may still want.
 */
export async function markSyncConflict(dbName: string): Promise<void> {
  await browser.storage.local.set({ [conflictKey(dbName)]: true });
}

// --- Debounce scheduling (alarm-based, SW-safe) ---

/**
 * Schedule a debounced push using chrome.alarms.
 * Persists the target dbName to storage so it survives SW restarts.
 *
 * Multiple calls coalesce: each resets the alarm and overwrites the pending
 * dbName with the current profile's.
 */
export async function scheduleDebouncedSync(dbName: string): Promise<void> {
  await browser.storage.local.set({ [PENDING_SYNC_DB_KEY]: dbName });

  // (Re)create the debounce alarm — this resets the countdown
  browser.alarms.create(DEBOUNCE_ALARM, {
    delayInMinutes: DEBOUNCE_MINUTES,
  });

  console.log(`[AutoSync] Debounce scheduled for db: ${dbName}`);
}

/**
 * Flush any pending debounced push immediately.
 * Call BEFORE switching active tab so the push uses the old profile.
 */
export async function flushPendingSync(
  onComplete?: () => void,
): Promise<boolean> {
  const result = await browser.storage.local.get(PENDING_SYNC_DB_KEY);
  const dbName = result[PENDING_SYNC_DB_KEY] as string | undefined;

  if (!dbName) return false;

  await browser.alarms.clear(DEBOUNCE_ALARM);
  await browser.storage.local.remove(PENDING_SYNC_DB_KEY);

  console.log(`[AutoSync] Flushing pending push for db: ${dbName}`);

  const auth = await getAuthStatus();
  if (!auth.isAuthenticated) return false;

  await performSyncUp({ dbName, onComplete });
  return true;
}

// --- Alarm handling ---

/**
 * Register the periodic alarm. Call once at SW startup.
 */
export function registerAutoSyncAlarm(): void {
  browser.alarms.create(PERIODIC_ALARM, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  console.log(`[AutoSync] Periodic alarm: every ${SYNC_INTERVAL_MINUTES} min`);
}

/**
 * Handle ALL auto-sync alarm events (periodic + debounce).
 * Wire this to chrome.alarms.onAlarm in background/index.ts.
 */
export async function handleAutoSyncAlarm(
  alarm: { name: string },
  /** Returns null while the active profile is still unresolved */
  getDbName: () => string | null,
  onComplete?: () => void,
): Promise<void> {
  if (alarm.name === DEBOUNCE_ALARM) {
    const result = await browser.storage.local.get(PENDING_SYNC_DB_KEY);
    const dbName = result[PENDING_SYNC_DB_KEY] as string | undefined;

    await browser.storage.local.remove(PENDING_SYNC_DB_KEY);

    if (!dbName) return;

    const auth = await getAuthStatus();
    if (!auth.isAuthenticated) return;

    console.log(`[AutoSync] Debounce alarm fired for db: ${dbName}`);
    await pushWithStatus(dbName, onComplete);
    return;
  }

  if (alarm.name === PERIODIC_ALARM) {
    const auth = await getAuthStatus();
    if (!auth.isAuthenticated) {
      console.log('[AutoSync] Not authenticated, skipping periodic check');
      return;
    }

    const dbName = getDbName();
    if (!dbName) {
      console.log('[AutoSync] Active profile unresolved, skipping periodic check');
      return;
    }

    // Not a scheduled upload — data changes already schedule their own via the
    // debounce. This exists to catch the case where those uploads never landed
    // (offline, expired token, SW killed mid-retry), so it only acts when there
    // is something outstanding.
    if (!(await isDirty(dbName))) {
      // Still worth one metadata request: it is how a second device's changes
      // get noticed while this one sits idle.
      await checkRemoteForUpdates(dbName);
      return;
    }

    console.log('[AutoSync] Retrying an upload that never landed');
    await pushWithStatus(dbName, onComplete);
  }
}

/** Run a push with the UI busy indicator wrapped around it. */
async function pushWithStatus(
  dbName: string,
  onComplete?: () => void,
): Promise<void> {
  notifySyncingState(true);
  try {
    await performSyncUp({ dbName, onComplete });
  } finally {
    notifySyncingState(false);
  }
}

/**
 * Check if a push is currently in progress.
 */
export function isAutoSyncing(): boolean {
  return isSyncing;
}

// --- Syncing state change callback ---

let onSyncingStateChange: ((syncing: boolean) => void) | null = null;

/**
 * Register a callback to be notified when syncing state changes.
 * Used by the background to update pegasus store's gdriveSyncing flag.
 */
export function onSyncingChange(cb: (syncing: boolean) => void): void {
  onSyncingStateChange = cb;
}

function notifySyncingState(syncing: boolean): void {
  onSyncingStateChange?.(syncing);
}

// --- Page-load check ---

/** Storage key for the last page-load remote check timestamp */
const PAGE_LOAD_SYNC_TIME_KEY = 'gdrive_page_load_sync_time';

/**
 * On page load, look at whether Drive holds a newer copy. Nothing is uploaded
 * and nothing is downloaded.
 *
 * Uploading here would be busywork — local changes already schedule their own
 * upload. Downloading would replace local data without being asked. So the only
 * useful thing is to notice a second device's changes and let the user decide.
 *
 * Called after SYNC_CONVERSATIONS completes in the background, with a 5-minute
 * cooldown.
 */
export async function checkRemoteOnPageLoad(dbName: string): Promise<void> {
  const auth = await getAuthStatus();
  if (!auth.isAuthenticated) return;

  const result = await browser.storage.local.get(PAGE_LOAD_SYNC_TIME_KEY);
  const lastTime = (result[PAGE_LOAD_SYNC_TIME_KEY] as number) || 0;

  if (Date.now() - lastTime < PAGE_LOAD_SYNC_COOLDOWN_MS) {
    console.log('[AutoSync] Page-load remote check skipped (cooldown)');
    return;
  }

  await browser.storage.local.set({ [PAGE_LOAD_SYNC_TIME_KEY]: Date.now() });

  console.log('[AutoSync] Page-load remote check');
  await checkRemoteForUpdates(dbName);
}
