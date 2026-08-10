/**
 * Which rendering a conversation opens in (persisted via chrome.storage.local).
 *
 * `viewMode` in the runtime store is what is on screen *now*; this is the choice
 * behind it. Two separate things, because the default is derived rather than stored:
 * a conversation containing agent turns opens in the agent view, one that doesn't
 * opens native. That derivation is what makes a reload land back where you were —
 * the content is on the page, so nothing has to be remembered for the common case.
 *
 * What does have to be remembered is the user overruling it: flipping to the native
 * view on an agent conversation is a statement about that conversation, and having
 * it snap back on the next reload would read as the toggle not working. Hence one
 * entry per conversation, written only when the toggle is pressed.
 *
 * Starting a session clears the entry: the previous "show me the raw DOM" was about
 * reading history, not about the task now being launched.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ConversationViewMode = 'custom' | 'original';

/**
 * Kept bounded because the key is a conversation id and nothing ever deletes one.
 * Overrides are rare (the derived default is right nearly always), so this ceiling
 * is never reached in practice; it exists so the record can't grow without limit.
 */
const MAX_OVERRIDES = 200;

export interface AgentViewState {
  /** Conversation id → the mode the user picked by hand. Absent = derive it. */
  overrides: Record<string, ConversationViewMode>;
  setOverride: (conversationId: string, mode: ConversationViewMode) => void;
  clearOverride: (conversationId: string) => void;
}

export const useAgentViewStore = create<AgentViewState>()(
  persist(
    (set) => ({
      overrides: {},

      setOverride: (conversationId, mode) =>
        set((state) => {
          const next = { ...state.overrides, [conversationId]: mode };
          const keys = Object.keys(next);
          if (keys.length > MAX_OVERRIDES) {
            // Insertion order is good enough for "oldest": re-setting a key keeps its
            // original slot, but a conversation being toggled again is one the user is
            // still using, and losing its override only costs one extra click.
            for (const stale of keys.slice(0, keys.length - MAX_OVERRIDES)) {
              delete next[stale];
            }
          }
          return { overrides: next };
        }),

      clearOverride: (conversationId) =>
        set((state) => {
          if (!(conversationId in state.overrides)) return {};
          const next = { ...state.overrides };
          delete next[conversationId];
          return { overrides: next };
        }),
    }),
    {
      name: 'bs-agent-view-mode',
      storage: createJSONStorage(() => ({
        getItem: async (name: string): Promise<string | null> => {
          const result = await chrome.storage.local.get(name);
          return (result[name] as string) ?? null;
        },
        setItem: async (name: string, value: string) => {
          await chrome.storage.local.set({ [name]: value });
        },
        removeItem: async (name: string) => {
          await chrome.storage.local.remove(name);
        },
      })),
    },
  ),
);
