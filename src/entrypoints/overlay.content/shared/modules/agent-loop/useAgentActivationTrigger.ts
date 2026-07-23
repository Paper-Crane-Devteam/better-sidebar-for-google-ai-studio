/**
 * useAgentActivationTrigger — `!` prefix trigger for activating an agent.
 *
 * When user types `!` at the start, shows a popup with available agents.
 * Selecting an agent inserts a capsule containing:
 * soul + skill list + mcp list (all tools).
 *
 * This is different from `>` (skill trigger) — `!` activates the whole agent context.
 */

import type { AgentDefinition } from './agents/types';
import { getAvailableAgents } from './agents/builtin-agents';
import { useTriggerPopup } from '../../features/trigger-popup';
import type { TriggerPopupMatch } from '../../features/trigger-popup';

/**
 * @param suppressed - When true, `!` trigger is disabled (e.g. slash command active)
 */
export function useAgentActivationTrigger(suppressed: boolean) {
  function search(query: string): TriggerPopupMatch[] {
    const allAgents = getAvailableAgents();

    if (!query.trim()) {
      return allAgents.map((a) => ({
        item: {
          id: a.id,
          title: a.name,
          description: a.description,
          icon: a.icon,
          content: a.id, // Will be used to identify which agent was selected
          meta: a,
        },
      }));
    }

    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    return allAgents
      .filter((a) => {
        const name = a.name.toLowerCase();
        const desc = a.description.toLowerCase();
        return words.every((w) => name.includes(w) || desc.includes(w));
      })
      .map((a) => ({
        item: {
          id: a.id,
          title: a.name,
          description: a.description,
          icon: a.icon,
          content: a.id,
          meta: a,
        },
      }));
  }

  const popup = useTriggerPopup({
    triggerChar: '!',
    search,
    suppressed,
  });

  function getSelectedAgent(): AgentDefinition | null {
    const item = popup.getSelectedItem();
    return item ? (item.meta as AgentDefinition) : null;
  }

  return {
    state: {
      isOpen: popup.state.isOpen,
      query: popup.state.query,
      triggerPosition: popup.state.triggerPosition,
      matches: popup.state.matches.map((m) => m.item.meta as AgentDefinition),
      selectedIndex: popup.state.selectedIndex,
    },
    handleInput: popup.handleInput,
    selectPrevious: popup.selectPrevious,
    selectNext: popup.selectNext,
    setHighlight: popup.setHighlight,
    close: popup.close,
    getSelectedAgent,
  };
}
