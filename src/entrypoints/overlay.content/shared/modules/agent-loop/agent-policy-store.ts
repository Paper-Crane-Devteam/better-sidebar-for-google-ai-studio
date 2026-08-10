/**
 * Agent Policy Store (persisted via chrome.storage.local).
 *
 * Cross-session execution preferences. Two switches, one per kind of tool call:
 *
 * - autoRunReads  : queries run without asking (default on)
 * - autoRunWrites : changes to data run without asking (default off)
 * - autoContinue  : the loop may run unattended at all (default on)
 *
 * `autoContinue` looks like it overlaps with the other two, and one earlier version
 * dropped it for that reason. It doesn't, as long as it is combined with them by
 * **intersection** rather than replacing them — see `shouldAutoSend()`:
 *
 *   autoContinue    a standing preference: am I willing to let it run by itself
 *   shouldAutoSend  a fact about this round: did anything already stop to ask me
 *
 * The version to avoid is `autoSend = autoContinue` alone, which lets the switch
 * contradict the approval gate: approve a write by hand and the results still go out
 * behind you. Intersected, the switch can only ever make things *more* manual.
 *
 * What it buys that the other two can't express: watching every step before letting
 * it continue, without having to confirm each individual SELECT.
 *
 * Note: the previous `disabledTools` field was removed — it was never consumed.
 * Tool gating goes through the MCP registry (see agent-config-store +
 * mcpRegistry.isToolEnabled).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AgentPolicyState {
  autoRunReads: boolean;
  autoRunWrites: boolean;
  autoContinue: boolean;
  setAutoRunReads: (enabled: boolean) => void;
  setAutoRunWrites: (enabled: boolean) => void;
  setAutoContinue: (enabled: boolean) => void;
}

export const useAgentPolicyStore = create<AgentPolicyState>()(
  persist(
    (set) => ({
      autoRunReads: true,
      // Off by default: an unattended DELETE is the one mistake that can't be undone
      // while snapshot support is still a placeholder.
      autoRunWrites: false,
      autoContinue: true,
      setAutoRunReads: (enabled) => set({ autoRunReads: enabled }),
      setAutoRunWrites: (enabled) => set({ autoRunWrites: enabled }),
      setAutoContinue: (enabled) => set({ autoContinue: enabled }),
    }),
    {
      name: 'bs-agent-control-panel',
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
