/**
 * The ledger, as the UI sees it.
 *
 * Loaded once per conversation and held by join key, so a card can answer "what became
 * of me" with a lookup. This is the layer that survives a reload: the runtime store's
 * `executedCalls` is wiped by it, and the transcript can only speak for calls whose
 * results were actually sent.
 *
 * It sits *between* those two in the card's precedence chain, and the order is not
 * arbitrary:
 *
 *   executedCalls  →  this  →  deriveToolOutcomes
 *   (live session)    (rows)   (the transcript)
 *
 * The live session wins because it is first-hand and current. The rows come next
 * because they are first-hand but possibly stale. The transcript is last because it is
 * a reconstruction — but it is also the only source with any coverage of conversations
 * that ran on another machine, or before these tables existed, which is why it stays.
 */

import { create } from 'zustand';
import { ledgerClient } from './ledger-client';
import type { AgentToolCallRow } from '@/shared/types/db';

/** What the ledger knows about one tool call */
export interface RecordedOutcome {
  status: AgentToolCallRow['status'];
  /** True for `ok`. A `running` row is neither — see `settled`. */
  success: boolean;
  /** The user turned it down, as opposed to it running and failing */
  rejected: boolean;
  /**
   * False for a `running` row: the page went away mid-execution, so whether the tool
   * finished is genuinely unknown. The card has to say so rather than pick a side —
   * for a write, guessing "didn't run" invites running it twice.
   */
  settled: boolean;
  /** Present only while the result is still owed to the AI */
  content: string | null;
  /** Whether the AI ever received this result */
  delivered: boolean;
}

/**
 * Results that ran but never reached the AI, grouped for the recovery prompt.
 *
 * The engine that produced them is gone, so nobody is waiting on a reply and the AI
 * has no idea the work happened. Re-sending is the only honest recovery — and it is
 * why re-*running* the tools must not be the default.
 */
export interface OwedResults {
  conversationId: string;
  rows: AgentToolCallRow[];
  /** Whether any of the owed work modified the database */
  hadWrites: boolean;
}

interface AgentRecordState {
  /** Conversation these records belong to; guards against showing another's */
  conversationId: string | null;
  loading: boolean;
  records: Record<string, RecordedOutcome>;
  owed: OwedResults | null;

  /** `force` re-reads a conversation already loaded, for after we changed its rows */
  load: (conversationId: string | null, force?: boolean) => Promise<void>;
  /** Fold a just-written row in, so the live card doesn't wait for a reload */
  put: (joinKey: string, outcome: RecordedOutcome) => void;
  /**
   * Close out the rows a recovery send just delivered.
   *
   * By id, because these rows belong to the interrupted session while the send happened
   * under a new one — the handoff's own per-round bookkeeping cannot reach them.
   */
  confirmOwedDelivered: (rowIds: string[]) => Promise<void>;
  dismissOwed: () => Promise<void>;
  clear: () => void;
}

function toOutcome(row: AgentToolCallRow): RecordedOutcome {
  return {
    status: row.status,
    success: row.status === 'ok',
    rejected: row.status === 'rejected',
    settled: row.status !== 'running',
    content: row.result_body,
    delivered: row.delivered === 1,
  };
}

export const useAgentRecordStore = create<AgentRecordState>((set, get) => ({
  conversationId: null,
  loading: false,
  records: {},
  owed: null,

  load: async (conversationId, force = false) => {
    if (!conversationId) {
      set({ conversationId: null, records: {}, owed: null, loading: false });
      return;
    }
    // Already have it. Reloading on every render of a chat with agent history would
    // put a database round trip behind each one. `force` is for the paths that just
    // wrote to the table and need to see their own change.
    if (!force && get().conversationId === conversationId && !get().loading) return;

    set({ conversationId, loading: true });

    try {
      const rows = (await ledgerClient.listByConversation(conversationId)) ?? [];

      // Conversation changed while the query was in flight — the answer is for a page
      // the user has already left, and writing it would label the wrong cards.
      if (get().conversationId !== conversationId) return;

      const records: Record<string, RecordedOutcome> = {};
      for (const row of rows) {
        // Later attempts overwrite earlier ones: the rows arrive in round order, and
        // the freshest verdict for a repeated call is the one worth showing.
        records[row.join_key] = toOutcome(row);
      }

      const owedRows = rows.filter(
        (row) => row.delivered === 0 && row.result_body !== null && row.status !== 'running',
      );

      set({
        records,
        loading: false,
        owed:
          owedRows.length > 0
            ? {
                conversationId,
                rows: owedRows,
                hadWrites: owedRows.some((row) => row.is_write === 1),
              }
            : null,
      });
    } catch (err) {
      console.warn('[AgentLoop] Could not read the tool call ledger:', err);
      set({ loading: false, records: {}, owed: null });
    }
  },

  put: (joinKey, outcome) =>
    set((state) => ({ records: { ...state.records, [joinKey]: outcome } })),

  confirmOwedDelivered: async (rowIds) => {
    await ledgerClient.markDelivered(rowIds);
  },

  dismissOwed: async () => {
    const owed = get().owed;
    if (!owed) return;
    set({ owed: null });
    await ledgerClient.clearUndelivered(owed.conversationId);
  },

  clear: () => set({ conversationId: null, records: {}, owed: null, loading: false }),
}));
