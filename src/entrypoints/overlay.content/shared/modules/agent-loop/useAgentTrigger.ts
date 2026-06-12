/**
 * useAgentTrigger — Agent trigger popup for `>` prefix.
 * Thin wrapper around shared useTriggerPopup.
 */

import type { AgentTriggerState, BuiltInPrompt } from './types';
import { getBuiltInPrompts } from './prompts/built-in-registry';
import { useTriggerPopup } from '../trigger-popup';
import type { TriggerPopupMatch } from '../trigger-popup';

/**
 * @param isSlashCommandActive - When true, `>` trigger is suppressed
 */
export function useAgentTrigger(isSlashCommandActive: boolean) {
  /**
   * Filter built-in prompts by query (multi-word AND on title + description).
   */
  function search(query: string): TriggerPopupMatch[] {
    const allPrompts = getBuiltInPrompts();

    if (!query.trim()) {
      return allPrompts.slice(0, 8).map((p) => ({
        item: { id: p.id, title: p.title, description: p.description, icon: p.icon, content: p.getPromptContent(), meta: p },
      }));
    }

    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    return allPrompts
      .filter((p) => {
        const title = p.title.toLowerCase();
        const desc = p.description.toLowerCase();
        return words.every((w) => title.includes(w) || desc.includes(w));
      })
      .slice(0, 8)
      .map((p) => ({
        item: { id: p.id, title: p.title, description: p.description, icon: p.icon, content: p.getPromptContent(), meta: p },
      }));
  }

  const popup = useTriggerPopup({
    triggerChar: '>',
    search,
    suppressed: isSlashCommandActive,
  });

  // ─── Adapt to legacy AgentTriggerState for backward compat ─────────

  const state: AgentTriggerState = {
    isOpen: popup.state.isOpen,
    query: popup.state.query,
    triggerPosition: popup.state.triggerPosition,
    matches: popup.state.matches.map((m) => m.item.meta as BuiltInPrompt),
    selectedIndex: popup.state.selectedIndex,
  };

  function getSelectedPrompt(): BuiltInPrompt | null {
    const item = popup.getSelectedItem();
    return item ? (item.meta as BuiltInPrompt) : null;
  }

  return {
    state,
    handleInput: popup.handleInput,
    selectPrevious: popup.selectPrevious,
    selectNext: popup.selectNext,
    setHighlight: popup.setHighlight,
    close: popup.close,
    getSelectedPrompt,
  };
}
