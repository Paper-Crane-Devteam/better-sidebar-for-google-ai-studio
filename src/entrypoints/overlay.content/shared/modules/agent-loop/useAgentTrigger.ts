/**
 * useAgentTrigger — Agent trigger popup for `>` prefix.
 * Thin wrapper around shared useTriggerPopup.
 *
 * Data source: agent-entry (auto entry + enabled skills). The old `!` trigger
 * has been folded into this single list.
 */

import type { AgentEntry } from './agent-entry';
import { searchAgentEntries } from './agent-entry';
import { useTriggerPopup } from '../../features/trigger-popup';
import type { TriggerPopupMatch } from '../../features/trigger-popup';

export interface AgentTriggerPopupState {
  isOpen: boolean;
  query: string;
  triggerPosition: number;
  matches: AgentEntry[];
  selectedIndex: number;
}

/**
 * @param isSlashCommandActive - When true, `>` trigger is suppressed
 */
export function useAgentTrigger(isSlashCommandActive: boolean) {
  function search(query: string): TriggerPopupMatch[] {
    return searchAgentEntries(query).map((entry) => ({
      item: {
        id: entry.id,
        title: entry.title,
        description: entry.description,
        icon: entry.icon,
        content: entry.capsuleContent,
        meta: entry,
      },
    }));
  }

  const popup = useTriggerPopup({
    triggerChar: '>',
    search,
    suppressed: isSlashCommandActive,
  });

  const state: AgentTriggerPopupState = {
    isOpen: popup.state.isOpen,
    query: popup.state.query,
    triggerPosition: popup.state.triggerPosition,
    matches: popup.state.matches.map((m) => m.item.meta as AgentEntry),
    selectedIndex: popup.state.selectedIndex,
  };

  function getSelectedEntry(): AgentEntry | null {
    const item = popup.getSelectedItem();
    return item ? (item.meta as AgentEntry) : null;
  }

  return {
    state,
    handleInput: popup.handleInput,
    selectPrevious: popup.selectPrevious,
    selectNext: popup.selectNext,
    setHighlight: popup.setHighlight,
    close: popup.close,
    getSelectedEntry,
  };
}
