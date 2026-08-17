/**
 * The sync run — a script that drives the tab, not a request that returns a value.
 *
 * Shape of the thing, because it is unusual for a tool: there is no API to ask for a
 * conversation's messages. The only way to get them is to be *on* the page while
 * Gemini fetches them, so the run navigates the tab to each conversation in turn,
 * scrolls its history to the top, and lets the existing interceptor → background →
 * DB path record whatever comes back.
 *
 * Which means every step is a page load, and the JS running the run dies at each one.
 * So the run is a state machine over `chrome.storage.local` rather than a loop:
 *
 *   startSyncRun()  write the job, then navigate
 *   (page reloads)
 *   resumeSyncRun() called at overlay start-up → pick the job back up, keep going
 *   ...
 *   finish          save a report, return to where the run started, toast the result
 *
 * The consequence the caller has to own: the agent session cannot survive this. The
 * agent's own conversation is one of these pages, and we are about to leave it. That
 * is why `sync_conversation_messages` is a handoff tool (see
 * `engine/parser/tool-schema.ts`) — it ends the loop by design, and the AI is told to
 * explain what is about to happen *before* calling it.
 */

import i18n from '@/locale/i18n';
import { toast } from '@/shared/lib/toast';
import { scrollConversationToTop } from './conversation-scroller';
import {
  clearSyncJob,
  createSyncJob,
  loadSyncJob,
  saveSyncJob,
  saveSyncReport,
  summarizeJob,
  takeSyncReport,
  type SyncJob,
} from './sync-job-store';

/** Only Gemini for now — the AI Studio adapter doesn't exist yet */
const SYNC_PLATFORM = 'gemini';

const conversationUrl = (externalId: string) => `https://gemini.google.com/app/${externalId}`;

/** `/app/{id}`, the same shape the Gemini DOM adapter reads */
function currentConversationId(): string | null {
  return /\/app\/([a-zA-Z0-9_-]+)/.exec(location.pathname)?.[1] ?? null;
}

/**
 * Breathing room between the tool result being recorded and the tab moving.
 *
 * Navigating from inside the tool call would tear the page down mid-round: the result
 * never reaches the store, so the chat shows a tool card that never resolved and the
 * user is left on a new page with no idea what happened.
 */
const HANDOFF_DELAY = 2500;

/** Wait for the conversation to render before scrolling it */
const READY_TIMEOUT = 20_000;
/** Times we'll aim at one conversation's URL before giving up on it */
const MAX_NAVIGATION_ATTEMPTS = 2;
/** Let the last fetch land and reach the background before moving on */
const SETTLE_DELAY = 1500;

/** One run per tab — a second driver would fight the first over the cursor */
let driving = false;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Entry points ────────────────────────────────────────────────────────────

export interface StartSyncRunResult {
  started: boolean;
  /** Why it didn't start, for the tool to hand back to the AI */
  reason?: string;
}

/**
 * Register a run and hand the tab over to it.
 *
 * Returns as soon as the job is persisted; the navigation happens after
 * `HANDOFF_DELAY` so the calling round can finish reporting itself first.
 */
export async function startSyncRun(externalIds: string[]): Promise<StartSyncRunResult> {
  const existing = await loadSyncJob();
  if (existing) {
    const remaining = existing.entries.length - existing.cursor;
    return {
      started: false,
      reason: `A sync run is already in progress (${remaining} conversation(s) left). Wait for it to finish.`,
    };
  }

  const job = createSyncJob(externalIds, SYNC_PLATFORM);
  await saveSyncJob(job);

  console.log(`[AgentLoop][sync] queued ${externalIds.length} conversation(s)`);
  setTimeout(() => {
    void driveJob();
  }, HANDOFF_DELAY);

  return { started: true };
}

/**
 * Called once per page load. Reports a finished run, or picks up an unfinished one.
 *
 * Cheap when there's nothing to do: a storage read and out.
 */
export async function resumeSyncRun(): Promise<void> {
  await flushReport();
  const job = await loadSyncJob();
  if (!job) return;

  console.log(`[AgentLoop][sync] resuming at ${job.cursor + 1}/${job.entries.length}`);
  void driveJob(job);
}

/** Abandon the current run, wherever it is */
export async function cancelSyncRun(): Promise<void> {
  driving = false;
  await clearSyncJob();
}

// ─── The driver ──────────────────────────────────────────────────────────────

async function driveJob(preloaded?: SyncJob): Promise<void> {
  if (driving) return;
  driving = true;

  try {
    let job = preloaded ?? (await loadSyncJob());

    while (job && job.cursor < job.entries.length) {
      const entry = job.entries[job.cursor];

      // Not there yet → navigate and stop. The next page load resumes the run.
      if (currentConversationId() !== entry.externalId) {
        if (entry.attempts >= MAX_NAVIGATION_ATTEMPTS) {
          // We aimed at this URL and didn't land on it. Almost always a conversation
          // that no longer exists, and retrying is a reload loop, not a fix.
          entry.status = 'failed';
          entry.note = 'could not open the conversation';
          job.cursor += 1;
          await saveSyncJob(job);
          continue;
        }

        entry.attempts += 1;
        await saveSyncJob(job);
        console.log(`[AgentLoop][sync] → ${entry.externalId} (try ${entry.attempts})`);
        location.assign(conversationUrl(entry.externalId));
        return;
      }

      const ready = await waitForConversation();
      if (!ready) {
        entry.status = 'failed';
        entry.note = 'conversation did not render';
      } else {
        const outcome = await scrollConversationToTop();
        await wait(SETTLE_DELAY);

        if (outcome === 'reached-top') {
          entry.status = 'done';
        } else {
          entry.status = 'partial';
          entry.note =
            outcome === 'no-scroller'
              ? 'only the messages loaded on open were captured (scroll target not wired up yet)'
              : 'timed out before reaching the first message';
        }
      }

      console.log(`[AgentLoop][sync] ${entry.externalId}: ${entry.status}`, entry.note ?? '');
      job.cursor += 1;
      await saveSyncJob(job);
    }

    if (job) await finishJob(job);
  } catch (e) {
    console.error('[AgentLoop][sync] run failed', e);
    // A crashed run must not keep the wheel: leaving the job behind would make every
    // later page load try to navigate again.
    await clearSyncJob();
  } finally {
    driving = false;
  }
}

async function finishJob(job: SyncJob): Promise<void> {
  const report = summarizeJob(job, await countUnsynced(job.platform));
  await saveSyncReport(report);
  await clearSyncJob();
  console.log('[AgentLoop][sync] run finished', report);

  // Back to where the run started, so the user lands on the conversation they were
  // talking to the agent in. The report is in storage, so the toast survives the trip.
  if (job.returnUrl && job.returnUrl !== location.href) {
    location.assign(job.returnUrl);
    return;
  }

  await flushReport();
}

async function flushReport(): Promise<void> {
  const report = await takeSyncReport();
  if (!report) return;

  const incomplete = report.partial + report.failed;
  if (incomplete === 0) {
    toast.success(i18n.t('agent.sync.doneAll', { count: report.done }));
  } else {
    toast.warning(
      i18n.t('agent.sync.donePartial', { count: report.done, incomplete }),
    );
  }

  // Separate line on purpose: "this batch went fine" and "the job isn't over" are two
  // different facts, and the second is the one that decides whether to run it again.
  if (report.remaining && report.remaining > 0) {
    toast.info(i18n.t('agent.sync.remaining', { count: report.remaining }));
  }
}

/**
 * How many conversations on this platform still have no messages.
 *
 * Read straight from the DB rather than derived from the job, because the job's 50
 * were only ever the first page of the problem.
 */
async function countUnsynced(platform: string): Promise<number | null> {
  // Ours by construction (`SYNC_PLATFORM`), but it round-trips through storage before
  // it lands in a SQL string, so it gets checked rather than trusted.
  if (!/^[a-z_]+$/.test(platform)) return null;

  const sql = `
    SELECT COUNT(*) AS remaining
    FROM conversations c
    WHERE c.deleted_at IS NULL
      AND c.platform = '${platform}'
      AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
  `;

  try {
    const response = await browser.runtime.sendMessage({
      type: 'EXECUTE_SQL',
      payload: { sql },
    });
    if (!response?.success) return null;
    const value = response.data?.[0]?.remaining;
    return typeof value === 'number' ? value : null;
  } catch (e) {
    // Only feeds a toast — a failed count must not fail the run.
    console.warn('[AgentLoop][sync] could not count remaining conversations', e);
    return null;
  }
}

/** Wait until at least one message is on screen, so there is something to scroll */
function waitForConversation(): Promise<boolean> {
  const isRendered = () => !!document.querySelector('[id*="message-content-id"]');
  if (isRendered()) return Promise.resolve(true);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!isRendered()) return;
      observer.disconnect();
      clearTimeout(timer);
      resolve(true);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(isRendered());
    }, READY_TIMEOUT);
  });
}
