/**
 * useAgentTrigger — Agent trigger popup for `>` prefix.
 * Thin wrapper around shared useTriggerPopup.
 * Data source: skill-registry (Soul+Skill+MCP architecture).
 */

import type { AgentTriggerState } from './types';
import type { Skill } from './skills/types';
import { getSkillsForPopup } from './skills/skill-registry';
import { useTriggerPopup } from '../../features/trigger-popup';
import type { TriggerPopupMatch } from '../../features/trigger-popup';

/**
 * @param isSlashCommandActive - When true, `>` trigger is suppressed
 */
export function useAgentTrigger(isSlashCommandActive: boolean) {
  /**
   * Filter skills by query (multi-word AND on title + description).
   */
  function search(query: string): TriggerPopupMatch[] {
    const allSkills = getSkillsForPopup();

    if (!query.trim()) {
      return allSkills.slice(0, 8).map((s) => ({
        item: {
          id: s.id,
          title: s.title,
          description: s.description,
          icon: s.icon,
          content: s.promptContent,
          meta: s,
        },
      }));
    }

    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    return allSkills
      .filter((s) => {
        const title = s.title.toLowerCase();
        const desc = s.description.toLowerCase();
        return words.every((w) => title.includes(w) || desc.includes(w));
      })
      .slice(0, 8)
      .map((s) => ({
        item: {
          id: s.id,
          title: s.title,
          description: s.description,
          icon: s.icon,
          content: s.promptContent,
          meta: s,
        },
      }));
  }

  const popup = useTriggerPopup({
    triggerChar: '>',
    search,
    suppressed: isSlashCommandActive,
  });

  // ─── Adapt to AgentTriggerState ────────────────────────────────────

  const state: AgentTriggerState = {
    isOpen: popup.state.isOpen,
    query: popup.state.query,
    triggerPosition: popup.state.triggerPosition,
    matches: popup.state.matches.map((m) => m.item.meta as Skill),
    selectedIndex: popup.state.selectedIndex,
  };

  function getSelectedSkill(): Skill | null {
    const item = popup.getSelectedItem();
    return item ? (item.meta as Skill) : null;
  }

  return {
    state,
    handleInput: popup.handleInput,
    selectPrevious: popup.selectPrevious,
    selectNext: popup.selectNext,
    setHighlight: popup.setHighlight,
    close: popup.close,
    getSelectedSkill,
    /** @deprecated Use getSelectedSkill instead */
    getSelectedPrompt: getSelectedSkill,
  };
}
