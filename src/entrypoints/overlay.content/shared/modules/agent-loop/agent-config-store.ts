/**
 * Agent Config Store — Persisted via chrome.storage.local.
 *
 * Stores user customization:
 * - Custom skills (user-created)
 * - Disabled builtin skills
 * - Disabled builtin MCPs
 * - Custom MCP servers (future)
 *
 * Builtin data lives in code (builtin-skills.ts, builtin-mcp.ts).
 * This store only holds user overrides and additions.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Skill } from './skills/types';

export interface AgentConfigStoreState {
  /** User-created custom skills */
  customSkills: Skill[];

  /** IDs of builtin skills that user has disabled */
  disabledBuiltinSkills: string[];

  /** IDs of builtin MCP servers that user has disabled */
  disabledBuiltinMCPs: string[];

  // ─── Actions ─────────────────────────────────────────────────────────

  addCustomSkill: (
    data: Omit<Skill, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'enabled'>,
  ) => void;
  updateCustomSkill: (
    id: string,
    updates: Partial<Pick<Skill, 'title' | 'description' | 'icon' | 'promptContent'>>,
  ) => void;
  removeCustomSkill: (id: string) => void;
  setCustomSkillEnabled: (id: string, enabled: boolean) => void;
  toggleBuiltinSkill: (id: string) => void;
  toggleBuiltinMCP: (id: string) => void;
}

export const useAgentConfigStore = create<AgentConfigStoreState>()(
  persist(
    (set, get) => ({
      customSkills: [],
      disabledBuiltinSkills: [],
      disabledBuiltinMCPs: [],

      addCustomSkill: (data) => {
        const now = Date.now();
        const newSkill: Skill = {
          ...data,
          id: `custom-${crypto.randomUUID().slice(0, 8)}`,
          type: 'custom',
          enabled: true,
          createdAt: now,
          updatedAt: now,
        };
        set({ customSkills: [...get().customSkills, newSkill] });
      },

      updateCustomSkill: (id, updates) => {
        set({
          customSkills: get().customSkills.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s,
          ),
        });
      },

      removeCustomSkill: (id) => {
        set({ customSkills: get().customSkills.filter((s) => s.id !== id) });
      },

      setCustomSkillEnabled: (id, enabled) => {
        set({
          customSkills: get().customSkills.map((s) => (s.id === id ? { ...s, enabled } : s)),
        });
      },

      toggleBuiltinSkill: (id) => {
        const current = get().disabledBuiltinSkills;
        if (current.includes(id)) {
          set({ disabledBuiltinSkills: current.filter((i) => i !== id) });
        } else {
          set({ disabledBuiltinSkills: [...current, id] });
        }
      },

      toggleBuiltinMCP: (id) => {
        const current = get().disabledBuiltinMCPs;
        if (current.includes(id)) {
          set({ disabledBuiltinMCPs: current.filter((i) => i !== id) });
        } else {
          set({ disabledBuiltinMCPs: [...current, id] });
        }
      },
    }),
    {
      name: 'bs-agent-config',
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
