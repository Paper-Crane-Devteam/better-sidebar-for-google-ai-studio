/**
 * Agent Policy Store (persisted via chrome.storage.local).
 *
 * Cross-session execution preferences. Two switches, one per kind of tool call:
 *
 * - autoRunReads  : queries run without asking (default on)
 * - autoRunWrites : changes to data run without asking (default off)
 * - autoContinue  : staged tool results are sent back to the AI automatically,
 *   so the loop runs unattended instead of waiting for Enter every round
 *
 * These replaced a single `autoExecuteReads`, which had grown misleading: turning it
 * off didn't just stop reads running by themselves, it required confirmation for
 * *everything*. Together with the session-scoped "allow all in this task" it was
 * three booleans expressing one three-valued policy, and no label said which.
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

/** Shape before the reads/writes split, kept only for the migration below */
interface LegacyPolicyState {
  autoExecuteReads?: boolean;
  autoContinue?: boolean;
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
      // Keep the original key so existing user preferences survive the rename
      name: 'bs-agent-control-panel',
      version: 1,
      /**
       * `autoExecuteReads: false` meant "ask about everything", so both switches go
       * off. `true` was the old default: reads free, writes asked about.
       */
      migrate: (persisted, version) => {
        if (version >= 1) return persisted as AgentPolicyState;

        const legacy = (persisted ?? {}) as LegacyPolicyState;
        return {
          autoRunReads: legacy.autoExecuteReads !== false,
          autoRunWrites: false,
          autoContinue: legacy.autoContinue !== false,
        } as AgentPolicyState;
      },
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
