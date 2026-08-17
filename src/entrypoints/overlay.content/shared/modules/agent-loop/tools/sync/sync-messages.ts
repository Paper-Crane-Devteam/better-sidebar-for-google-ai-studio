/**
 * sync_conversation_messages Tool.
 *
 * Takes the conversation ids that need their history recorded, hands them to the
 * navigation run (see `sync-runner.ts`), and returns immediately.
 *
 * The unusual part is what "success" means here: not "the messages are synced" but
 * "the tab is now booked for a road trip". Nothing is synced by the time this returns
 * — the run navigates away, this conversation goes with it, and the agent session ends
 * (`sync_conversation_messages` is listed in `HANDOFF_TOOLS`). The result text says so
 * in those terms, because the AI's last chance to warn the user is *before* the call,
 * and a result reading "synced 12 conversations" would teach it there was nothing to
 * warn about.
 */

import { startSyncRun } from './sync-runner';
import { MAX_SYNC_IDS } from './sync-job-store';

export interface SyncMessagesParams {
  conversation_ids: string;
}

/** Gemini external ids are URL path components — anything else is a mistake upstream */
const ID_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;

/**
 * Accept a JSON array, but don't die on a comma-separated list.
 *
 * The AI reliably produces one of the two, and rejecting the second costs a whole
 * round to relearn something we can just read.
 */
function parseIds(raw: string): string[] {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim());
    } catch {
      // Fall through to the split — a malformed array is still usually readable
    }
  }

  return trimmed
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((v) => v.trim().replace(/^["']|["']$/g, ''));
}

export async function syncMessages(params: SyncMessagesParams): Promise<string> {
  if (!location.hostname.endsWith('gemini.google.com')) {
    return 'ERROR: sync_conversation_messages only works on Gemini for now. Use execute_sql to work with the messages already in the database.';
  }

  const ids = Array.from(new Set(parseIds(params.conversation_ids).filter(Boolean)));

  if (ids.length === 0) {
    return 'ERROR: sync_conversation_messages needs "conversation_ids" — a JSON array of conversation external_ids, e.g. ["c_abc123", "c_def456"]. Query them with execute_sql first (conversations.external_id).';
  }

  const malformed = ids.filter((id) => !ID_PATTERN.test(id));
  if (malformed.length > 0) {
    return `ERROR: these don't look like conversation external_ids: ${malformed.join(', ')}. Pass conversations.external_id values (the id in the conversation URL), not internal row ids or titles.`;
  }

  if (ids.length > MAX_SYNC_IDS) {
    return `ERROR: ${ids.length} conversations is too many for one run (limit ${MAX_SYNC_IDS}). Sync the most important ones first — the user can run this again afterwards.`;
  }

  const { started, reason } = await startSyncRun(ids);
  if (!started) return `ERROR: ${reason}`;

  return [
    `Sync run queued for ${ids.length} conversation(s): ${ids.join(', ')}.`,
    '',
    'The tab is about to leave this conversation and visit each one in turn, scrolling its',
    'history to the top so the extension records the messages. This ends the current agent',
    'session — you will not get another turn. A progress bar with a Stop button is on screen',
    'for the whole run. When it finishes, the tab returns here and the user gets a summary',
    'toast.',
  ].join('\n');
}
