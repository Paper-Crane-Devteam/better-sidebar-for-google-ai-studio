/**
 * The content script's only way to reach the ledger.
 *
 * ⚠️ **Never import `@/shared/db` from here or anything downstream of it.** That module
 * works in the background and the offscreen document, not in a content script: its
 * `DB_REQUEST` does reach the offscreen worker, but the reply travels back over
 * `runtime.sendMessage`, which never lands in a content script. So every call hung
 * until the bridge's 30-second timeout.
 *
 * That is not a hypothetical. The first version of the ledger called the repos
 * directly, and because `begin()` is awaited before each tool runs, *every* tool call
 * paid the timeout — including `activate_skill`, which touches no data at all. The
 * whole agent looked broken. `tools/execute-sql.ts` has always gone through the
 * background for exactly this reason; the comment there is the one that gives it away.
 *
 * Going through the background is also the only correct route: `ensureDbForTab` runs
 * there, so it is the only path that lands in the profile this tab belongs to.
 */

import type { AgentToolCallRow } from '@/shared/types/db';

/**
 * How long a ledger call may hold up the caller.
 *
 * The ledger is an aid, not a mechanism — the renderer falls back to reading the
 * transcript without it. So a background that is slow, asleep or wedged must cost the
 * user a moment, not a tool call. The number is generous for a single INSERT while
 * still being far below anything a person would call a hang.
 */
const LEDGER_TIMEOUT_MS = 3000;

type LedgerOp = Extract<
  import('@/shared/types/messages').ExtensionMessage,
  { type: 'AGENT_LEDGER' }
>['payload'];

/**
 * One round trip. Resolves to null on any failure — timeout, no receiver, a rejected
 * statement — because every caller's answer to all three is the same: carry on without
 * a record.
 */
async function send<T>(payload: LedgerOp): Promise<T | null> {
  try {
    const response = await Promise.race([
      browser.runtime.sendMessage({ type: 'AGENT_LEDGER', payload }),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), LEDGER_TIMEOUT_MS),
      ),
    ]);

    if (response === 'timeout') {
      console.warn(`[AgentLoop] Ledger "${payload.op}" timed out; continuing without it`);
      return null;
    }
    if (!response?.success) {
      console.warn(`[AgentLoop] Ledger "${payload.op}" failed:`, response?.error);
      return null;
    }
    return (response.data ?? null) as T | null;
  } catch (err) {
    console.warn(`[AgentLoop] Ledger "${payload.op}" could not be sent:`, err);
    return null;
  }
}

export const ledgerClient = {
  sessionCreate: (session: {
    id: string;
    conversationId: string | null;
    title: string | null;
    skillId?: string | null;
  }) => send<void>({ op: 'sessionCreate', session }),

  sessionClaim: (sessionId: string, conversationId: string) =>
    send<void>({ op: 'sessionClaim', sessionId, conversationId }),

  sessionEnd: (sessionId: string, endReason: string, rounds: number) =>
    send<void>({ op: 'sessionEnd', sessionId, endReason, rounds }),

  callBegin: (call: {
    id: string;
    sessionId: string | null;
    conversationId: string | null;
    joinKey: string;
    round: number;
    orderIndex: number;
    toolName: string;
    description?: string;
    params?: Record<string, string>;
    isWrite: boolean;
  }) => send<void>({ op: 'callBegin', call }),

  callSettle: (
    id: string,
    status: AgentToolCallRow['status'],
    resultBody: string | null,
  ) => send<void>({ op: 'callSettle', id, status, resultBody }),

  roundDelivered: (sessionId: string, round: number) =>
    send<void>({ op: 'roundDelivered', sessionId, round }),

  sessionDiscardUndelivered: (sessionId: string) =>
    send<void>({ op: 'sessionDiscardUndelivered', sessionId }),

  markDelivered: (ids: string[]) =>
    ids.length === 0 ? Promise.resolve(null) : send<void>({ op: 'markDelivered', ids }),

  listByConversation: (conversationId: string) =>
    send<AgentToolCallRow[]>({ op: 'listByConversation', conversationId }),

  clearUndelivered: (conversationId: string) =>
    send<void>({ op: 'clearUndelivered', conversationId }),
};
