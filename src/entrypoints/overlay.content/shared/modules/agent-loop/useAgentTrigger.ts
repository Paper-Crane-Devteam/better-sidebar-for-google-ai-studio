/**
 * useAgentTrigger — Hook for detecting `>` prefix and managing built-in prompt popup.
 * Similar to useSlashCommand but triggers built-in (invisible) prompts.
 */

import { useState, useCallback } from 'react';
import type { AgentTriggerState, BuiltInPrompt } from './types';
import { getBuiltInPrompts } from './prompts/built-in-registry';

const MAX_RESULTS = 8;

const initialState: AgentTriggerState = {
  isOpen: false,
  query: '',
  triggerPosition: -1,
  matches: [],
  selectedIndex: 0,
};

/**
 * Core `>` trigger logic — platform-agnostic.
 * Handles search matching, popup state, and keyboard navigation.
 *
 * @param isSlashCommandActive - When true, `>` trigger is suppressed
 */
export function useAgentTrigger(isSlashCommandActive: boolean) {
  const [state, setState] = useState<AgentTriggerState>(initialState);

  /**
   * Filter built-in prompts by query.
   * Case-insensitive, multi-word AND matching on title.
   */
  const filterPrompts = useCallback((query: string): BuiltInPrompt[] => {
    const allPrompts = getBuiltInPrompts();

    if (!query.trim()) {
      return allPrompts.slice(0, MAX_RESULTS);
    }

    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    return allPrompts
      .filter((p) => {
        const title = p.title.toLowerCase();
        const desc = p.description.toLowerCase();
        return words.every((w) => title.includes(w) || desc.includes(w));
      })
      .slice(0, MAX_RESULTS);
  }, []);

  /** Called on input change. Detects `>` prefix and updates popup state. */
  const handleInput = useCallback(
    (text: string, cursorPos: number) => {
      // If slash command is active, suppress agent trigger
      if (isSlashCommandActive) {
        if (state.isOpen) setState(initialState);
        return;
      }

      // Search backwards from cursor for `>`
      let triggerPos = -1;
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (text[i] === '>') {
          // Valid: at start of text or preceded by whitespace/newline
          if (i === 0 || /[\s\n]/.test(text[i - 1])) {
            triggerPos = i;
          }
          break;
        }
        // Stop at newline (trigger doesn't span lines)
        if (text[i] === '\n') break;
      }

      if (triggerPos === -1) {
        if (state.isOpen) setState(initialState);
        return;
      }

      const query = text.slice(triggerPos + 1, cursorPos);
      const matches = filterPrompts(query);

      // If query has content but no matches, close popup
      if (query.trim() && matches.length === 0) {
        setState(initialState);
        return;
      }

      setState({
        isOpen: true,
        query,
        triggerPosition: triggerPos,
        matches,
        selectedIndex: 0,
      });
    },
    [isSlashCommandActive, state.isOpen, filterPrompts],
  );

  /** Move selection up */
  const selectPrevious = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedIndex: prev.selectedIndex <= 0 ? prev.matches.length - 1 : prev.selectedIndex - 1,
    }));
  }, []);

  /** Move selection down */
  const selectNext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedIndex: prev.selectedIndex >= prev.matches.length - 1 ? 0 : prev.selectedIndex + 1,
    }));
  }, []);

  /** Set highlighted index (mouse hover) */
  const setHighlight = useCallback((index: number) => {
    setState((prev) => ({ ...prev, selectedIndex: index }));
  }, []);

  /** Close the popup */
  const close = useCallback(() => {
    setState(initialState);
  }, []);

  /** Get the currently selected prompt */
  const getSelectedPrompt = useCallback((): BuiltInPrompt | null => {
    if (!state.isOpen || state.matches.length === 0) return null;
    return state.matches[state.selectedIndex] ?? null;
  }, [state]);

  return {
    state,
    handleInput,
    selectPrevious,
    selectNext,
    setHighlight,
    close,
    getSelectedPrompt,
  };
}
