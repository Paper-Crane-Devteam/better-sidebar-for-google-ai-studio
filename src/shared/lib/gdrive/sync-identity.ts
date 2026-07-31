/**
 * Sync identity: deciding *which* remote file a profile talks to, and refusing
 * to merge one that belongs to someone else.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * A sync run is only safe if the local DB and the remote file are two views of
 * the same dataset. Historically that was assumed rather than checked, and the
 * file name carried a single dimension: `better-sidebar-sync__<dbName>.json`.
 *
 * Two things break that assumption:
 *
 *  1. The Google account is not part of the name. Two different Google accounts
 *     using the same profile filename — the common case being the legacy
 *     `prompt-manager-for-google-ai-studio.db` shared by every install that
 *     predates profiles — resolve to the same logical file, each overwriting the
 *     other.
 *  2. `dbName` on the caller's side lives in service-worker memory and is a
 *     snapshot taken up to 25 minutes before the sync actually runs. It can
 *     name a different profile than the one the DB worker has open.
 *
 * Because the merge mirrors remote deletions, either mix-up destroys data rather
 * than merely producing a mess. So: names are scoped by account, and every
 * payload carries an origin stamp that is verified before it is trusted.
 */

import { findFile, getAccountId } from './gdrive-api';
import type { SyncOrigin, SyncPayload } from './sync-data';

const FILE_PREFIX = 'better-sidebar-sync__';

/** Account-agnostic name used by every release before account scoping. */
export function legacySyncFileName(dbName: string): string {
  return `${FILE_PREFIX}${dbName}.json`;
}

/** Name scoped to both profile and Google account. */
export function scopedSyncFileName(dbName: string, accountId: string): string {
  // Account ids are opaque; keep the name filesystem/query friendly.
  const safeAccount = accountId.replace(/[^A-Za-z0-9._@-]/g, '_');
  return `${FILE_PREFIX}${dbName}__${safeAccount}.json`;
}

export interface SyncTarget {
  /** Name to read from and write to */
  fileName: string;
  /** Existing Drive file, or null if it doesn't exist yet */
  file: { id: string; name: string } | null;
  /**
   * File content, when resolving already had to download it. Lets the caller
   * skip a second round trip for the same bytes.
   */
  content?: string;
}

/**
 * Pick the remote file this (profile, account) pair should use.
 *
 * Migration behaviour is intentionally conservative: an existing legacy file is
 * kept in place as long as it doesn't demonstrably belong to another account.
 * Renaming everyone's file would orphan the old one and reset sync baselines for
 * no benefit, so the scoped name is only adopted when there is nothing to
 * inherit — or when the legacy file turns out to be someone else's.
 */
export async function resolveSyncTarget(
  token: string,
  dbName: string,
  accountId: string | null,
  downloadFile: (token: string, fileId: string) => Promise<string>,
): Promise<SyncTarget> {
  const legacyName = legacySyncFileName(dbName);

  // Without an account id there is nothing to scope by
  if (!accountId) {
    return { fileName: legacyName, file: await findFile(token, legacyName) };
  }

  const scopedName = scopedSyncFileName(dbName, accountId);

  // Already migrated → always prefer the scoped file
  const scoped = await findFile(token, scopedName);
  if (scoped) {
    return { fileName: scopedName, file: scoped };
  }

  const legacy = await findFile(token, legacyName);
  if (!legacy) {
    // Nothing to inherit → start out scoped
    return { fileName: scopedName, file: null };
  }

  // Inherit the legacy file unless it was written by a different account
  try {
    const content = await downloadFile(token, legacy.id);
    const origin = readOrigin(content);
    if (origin?.accountId && origin.accountId !== accountId) {
      console.warn(
        `[SyncIdentity] Legacy file "${legacyName}" belongs to another account ` +
          `(${origin.accountId}); using "${scopedName}" instead`,
      );
      return { fileName: scopedName, file: null };
    }
    return { fileName: legacyName, file: legacy, content };
  } catch (err: any) {
    // Can't inspect it — leave the legacy file untouched and go scoped.
    // Guessing wrong here means overwriting another account's data.
    console.warn(
      `[SyncIdentity] Could not inspect "${legacyName}" (${err?.message ?? err}); ` +
        `using "${scopedName}" instead`,
    );
    return { fileName: scopedName, file: null };
  }
}

/** Best-effort read of a payload's origin stamp. */
function readOrigin(json: string): SyncOrigin | undefined {
  try {
    const payload: SyncPayload = JSON.parse(json);
    return payload?.origin;
  } catch {
    return undefined;
  }
}

export interface OriginCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Verify a downloaded payload really belongs to the dataset we are merging into.
 *
 * Payloads without an origin stamp predate this check and are accepted — every
 * existing user has one, and rejecting them would break sync for everybody.
 * The deletion guards in the merge remain the backstop for those.
 */
export function checkSyncOrigin(
  remoteJson: string,
  expected: { dbName: string; accountId: string | null },
): OriginCheck {
  const origin = readOrigin(remoteJson);

  if (!origin) {
    return { ok: true };
  }

  if (origin.dbName && origin.dbName !== expected.dbName) {
    return {
      ok: false,
      reason:
        `remote payload was written by profile "${origin.dbName}" but the local ` +
        `database is "${expected.dbName}"`,
    };
  }

  if (
    origin.accountId &&
    expected.accountId &&
    origin.accountId !== expected.accountId
  ) {
    return {
      ok: false,
      reason:
        `remote payload belongs to Google account "${origin.accountId}" but the ` +
        `active account is "${expected.accountId}"`,
    };
  }

  return { ok: true };
}
