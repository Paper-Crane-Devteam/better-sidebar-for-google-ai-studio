/**
 * Detection of stale conversation messages.
 *
 * ## What "stale" means here
 *
 * Before the regeneration fix, re-editing a prompt and letting the AI answer again
 * appended the new turn to the DB without removing the turn it replaced. The old
 * turn is still in `messages`, but it no longer exists in the conversation — a dead
 * branch. Nothing in the row itself says so: `messages` stores no parent/child link,
 * so the anchor (`rc_` id) the fix relies on is not recoverable after the fact.
 *
 * The only authority on which turns are alive is the platform. Gemini's history
 * endpoint (`hNvQHb`, see `interceptors/chat-content.ts`) returns the ACTIVE branch
 * only, so a DB row that the history response never mentions is dead.
 *
 * ## Why this is bounded rather than a plain "delete what isn't live"
 *
 * History is paginated: opening a conversation loads the most recent turns, and
 * older pages arrive as the user scrolls up. A naive diff would call every
 * not-yet-loaded turn stale and wipe the conversation. Three guards prevent that:
 *
 *  1. **Window bound.** Only rows whose `order_index` falls between the first and
 *     last matched live row are considered. Everything outside that range is
 *     history we have not seen yet, so it is left alone. As more pages arrive the
 *     live set grows and the window widens with it.
 *  2. **Native ids only.** Only `r_` / `rc_` ids are eligible. Those are written by
 *     the Gemini interceptor and are comparable to live ids. Hex/UUID rows come
 *     from bulk scans or AI Studio and can never be matched, so they are never
 *     deleted (duplicate hex-vs-native rows are `dedup-messages.ts`'s job).
 *  3. **Minimum evidence.** Fewer than two matched live rows means the response is
 *     not trustworthy as a window (e.g. a partial parse), and nothing is reported.
 */

/** Minimal shape needed from a DB row. */
export interface StaleCandidateRow {
  id: string;
  order_index: number;
  message_type?: string | null;
}

/** Gemini interceptor-written ids: `r_xxx` (user turn) and `rc_xxx` (model turn). */
const NATIVE_ID_RE = /^rc?_/;

/**
 * Diff the DB rows of one conversation against the set of ids the platform says
 * are alive, and return the ids that are safe to delete.
 *
 * @param dbRows  All rows for the conversation, each with its `order_index`.
 * @param liveIds Ids seen in authoritative history responses (union across pages).
 */
export function computeStaleMessageIds(
  dbRows: StaleCandidateRow[],
  liveIds: Iterable<string>,
): string[] {
  const liveSet = liveIds instanceof Set ? liveIds : new Set(liveIds);
  if (liveSet.size === 0 || dbRows.length === 0) return [];

  // Guard 3: establish the observed window from rows we could actually match.
  let minOrder = Infinity;
  let maxOrder = -Infinity;
  let matched = 0;
  for (const row of dbRows) {
    if (!liveSet.has(row.id)) continue;
    matched++;
    if (row.order_index < minOrder) minOrder = row.order_index;
    if (row.order_index > maxOrder) maxOrder = row.order_index;
  }
  if (matched < 2) return [];

  // Guards 1 + 2.
  const stale: string[] = [];
  for (const row of dbRows) {
    if (liveSet.has(row.id)) continue;
    if (row.order_index < minOrder || row.order_index > maxOrder) continue;
    if (row.message_type === 'thought') continue;
    if (!NATIVE_ID_RE.test(row.id)) continue;
    stale.push(row.id);
  }

  // Guard 4: sanity. Dead branches are a minority of a conversation — a handful
  // of turns the user replaced. Flagging more rows than we matched means the two
  // id spaces are not lining up the way this depends on (a changed response
  // shape, a partial parse in the history interceptor), and the honest response
  // to "I no longer understand this data" is to touch none of it.
  if (stale.length > matched) return [];

  return stale;
}
