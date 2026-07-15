/**
 * Control Panel Settings Store (Persisted via chrome.storage.local).
 * Manages user preferences that persist across sessions:
 * - autoExecuteReads: whether read operations auto-execute
 * - disabledTools: tools the user has disabled
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ControlPanelState {
  autoExecuteReads: boolean;
  disabledTools: string[];

  setAutoExecuteReads: (enabled: boolean) => void;
  toggleTool: (toolName: string) => void;
  enableTool: (toolName: string) => void;
  disableTool: (toolName: string) => void;
}

export const useControlPanelStore = create<ControlPanelState>()(
  persist(
    (set, get) => ({
      autoExecuteReads: true,
      disabledTools: [],

      setAutoExecuteReads: (enabled) => set({ autoExecuteReads: enabled }),

      toggleTool: (toolName) => {
        const current = get().disabledTools;
        if (current.includes(toolName)) {
          set({ disabledTools: current.filter((t) => t !== toolName) });
        } else {
          set({ disabledTools: [...current, toolName] });
        }
      },

      enableTool: (toolName) => {
        set({ disabledTools: get().disabledTools.filter((t) => t !== toolName) });
      },

      disableTool: (toolName) => {
        if (!get().disabledTools.includes(toolName)) {
          set({ disabledTools: [...get().disabledTools, toolName] });
        }
      },
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
