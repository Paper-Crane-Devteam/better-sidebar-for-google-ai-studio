/**
 * Shared conversation messages store.
 *
 * Single source of truth for the current conversation's messages.
 * Both SmartScrollbar (useConversationNodes) and Outline (useOutline)
 * consume from this store, ensuring consistent data without duplicated
 * DB fetches or event listeners.
 *
 * Architecture:
 *  - Zustand store holds messages + metadata
 *  - useInitConversationMessages() hook drives side-effects (call once at app root)
 *  - Consumers read via useConversationMessagesStore selector
 */

import { create } from 'zustand';
import { getPlatformDomAdapter } from '@/shared/lib/platform-dom-adapter';

// ── ID detection helper (inlined to avoid Gemini-specific import) ────

/**
 * Gemini native message IDs typically start with "r_" or "rc_" prefixes.
 * Non-native IDs are 32-char uppercase hex or UUID v4 strings (from DB).
 */
function looksLikeNativeId(id: string): boolean {
  return (
    !/^[0-9A-F]{32}$/i.test(id) &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

// ── Types ────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  content: string;
  role: 'user' | 'model';
  timestamp?: number;
  orderIndex?: number;
  inDom: boolean;
}

interface ConversationMessagesState {
  /** Sorted list of messages for the current conversation */
  messages: ConversationMessage[];
  /** Whether a DB fetch is in progress */
  isLoading: boolean;
  /** The URL that was last fetched for (to avoid re-fetching) */
  fetchedForUrl: string | null;
  /** Whether currently on a conversation page */
  isOnConversation: boolean;

  // ── Actions ──────────────────────────────────────────────────────
  /** Replace all messages (used after initial DB fetch) */
  setMessages: (messages: ConversationMessage[]) => void;
  /** Merge incoming messages into existing state (used for interceptor live updates) */
  mergeMessages: (incoming: ConversationMessage[]) => void;
  /** Clear all state (used on URL change) */
  reset: () => void;
  /** Remove all messages that come after the given anchor message ID (for regeneration) */
  removeMessagesAfter: (anchorMessageId: string) => void;
  /** Refresh inDom flags by checking DOM presence */
  refreshDomPresence: () => void;
  /** Set loading state */
  setIsLoading: (loading: boolean) => void;
  /** Set fetched URL marker */
  setFetchedForUrl: (url: string | null) => void;
  /** Set whether on a conversation page */
  setIsOnConversation: (on: boolean) => void;
}

// ── Merge logic (ported from SmartScrollbar's merge-nodes.ts) ────────

function mergeMessageArrays(
  prev: ConversationMessage[],
  incoming: ConversationMessage[],
): ConversationMessage[] {
  if (incoming.length === 0) return prev;

  const byId = new Map<string, ConversationMessage>();
  for (const m of prev) byId.set(m.id, m);

  for (const m of incoming) {
    const existing = byId.get(m.id);
    if (!existing) {
      // Try to find a duplicate with different ID (DB hex vs Gemini native)
      let mergeTarget: ConversationMessage | undefined;
      const trimmed = m.content.trim();

      if (m.orderIndex != null) {
        for (const e of byId.values()) {
          if (e.orderIndex === m.orderIndex && e.content.trim() === trimmed) {
            mergeTarget = e;
            break;
          }
        }
      }
      if (!mergeTarget) {
        for (const e of byId.values()) {
          if (
            e.role === m.role &&
            e.content.trim() === trimmed &&
            looksLikeNativeId(e.id) !== looksLikeNativeId(m.id)
          ) {
            mergeTarget = e;
            break;
          }
        }
      }

      if (mergeTarget) {
        const pickId = looksLikeNativeId(m.id)
          ? m.id
          : looksLikeNativeId(mergeTarget.id)
            ? mergeTarget.id
            : m.id;
        byId.delete(mergeTarget.id);
        byId.set(pickId, {
          ...mergeTarget,
          id: pickId,
          inDom: mergeTarget.inDom || m.inDom,
          orderIndex: mergeTarget.orderIndex ?? m.orderIndex,
          timestamp: mergeTarget.timestamp ?? m.timestamp,
          content: m.content || mergeTarget.content,
        });
      } else {
        byId.set(m.id, m);
      }
    } else {
      // Update existing: prefer newer content, merge flags
      byId.set(m.id, {
        ...existing,
        inDom: existing.inDom || m.inDom,
        orderIndex: existing.orderIndex ?? m.orderIndex,
        timestamp: existing.timestamp ?? m.timestamp,
        content: m.content || existing.content,
      });
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => {
    const aHas = a.orderIndex != null;
    const bHas = b.orderIndex != null;
    if (aHas && bHas) return a.orderIndex! - b.orderIndex!;
    if (aHas) return -1;
    if (bHas) return 1;
    return (a.timestamp ?? 0) - (b.timestamp ?? 0);
  });

  // Shallow equality check to avoid unnecessary re-renders
  if (
    merged.length === prev.length &&
    merged.every((m, i) => m.id === prev[i].id && m.inDom === prev[i].inDom && m.content === prev[i].content)
  ) {
    return prev;
  }

  return merged;
}

// ── Store ────────────────────────────────────────────────────────────

export const useConversationMessagesStore = create<ConversationMessagesState>((set, get) => ({
  messages: [],
  isLoading: false,
  fetchedForUrl: null,
  isOnConversation: false,

  setMessages: (messages) => set({ messages }),

  mergeMessages: (incoming) => {
    const prev = get().messages;
    const merged = mergeMessageArrays(prev, incoming);
    if (merged !== prev) set({ messages: merged });
  },

  reset: () => set({ messages: [], isLoading: false, fetchedForUrl: null }),

  removeMessagesAfter: (anchorMessageId: string) => {
    const prev = get().messages;
    const anchorIndex = prev.findIndex((m) => m.id === anchorMessageId);
    if (anchorIndex === -1) return; // anchor not found, nothing to do
    const trimmed = prev.slice(0, anchorIndex + 1);
    if (trimmed.length !== prev.length) {
      set({ messages: trimmed });
    }
  },

  refreshDomPresence: () => {
    const adapter = getPlatformDomAdapter();
    if (!adapter) return;

    const prev = get().messages;
    let changed = false;
    const updated = prev.map((msg) => {
      const nowInDom = !!adapter.findMessageElement(msg.id);
      if (nowInDom !== msg.inDom) {
        changed = true;
        return { ...msg, inDom: nowInDom };
      }
      return msg;
    });
    if (changed) set({ messages: updated });
  },

  setIsLoading: (loading) => set({ isLoading: loading }),
  setFetchedForUrl: (url) => set({ fetchedForUrl: url }),
  setIsOnConversation: (on) => set({ isOnConversation: on }),
}));
