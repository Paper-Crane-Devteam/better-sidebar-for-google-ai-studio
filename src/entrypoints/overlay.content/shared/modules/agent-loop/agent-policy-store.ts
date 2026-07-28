/**
 * Agent Policy Store (persisted via chrome.storage.local).
 *
 * Cross-session execution preferences:
 * - autoExecuteReads: read-only tool calls run without asking (default on)
 * - autoContinue: staged tool results are sent back to the AI automatically,
 *   so the loop runs unattended instead of waiting for Enter every round
 *
 * Note: the previous `disabledTools` field was removed — it was never consumed.
 * Tool gating goes through the MCP registry (see agent-config-store +
 * mcpRegistry.isToolEnabled).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AgentPolicyState {
  autoExecuteReads: boolean;
  autoContinue: boolean;
  setAutoExecuteReads: (enabled: boolean) => void;
  setAutoContinue: (enabled: boolean) => void;
}

export const useAgentPolicyStore = create<AgentPolicyState>()(
  persist(
    (set) => ({
      autoExecuteReads: true,
      autoContinue: true,
      setAutoExecuteReads: (enabled) => set({ autoExecuteReads: enabled }),
      setAutoContinue: (enabled) => set({ autoContinue: enabled }),
    }),
    {
      // Keep the original key so existing user preferences survive the rename
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
