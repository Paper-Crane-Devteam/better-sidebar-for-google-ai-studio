/**
 * useTriggerPopup — Stateful logic for character-triggered popup.
 *
 * Intentionally avoids useCallback — these functions are only used inside
 * event handlers via refs, so referential stability doesn't matter and
 * useCallback would just add stale-closure risk for no performance gain.
 */

import { useRef, useState } from 'react';
import type { TriggerPopupState, TriggerPopupConfig, TriggerPopupMatch } from './types';

const DEFAULT_MAX_RESULTS = 8;

const INITIAL_STATE: TriggerPopupState = {
  isOpen: false,
  query: '',
  triggerPosition: -1,
  matches: [],
  selectedIndex: 0,
};

export function useTriggerPopup(config: TriggerPopupConfig) {
  const { triggerChar, search, suppressed = false, maxResults = DEFAULT_MAX_RESULTS } = config;
  const [state, setState] = useState<TriggerPopupState>(INITIAL_STATE);

  // Keep config in refs so event handlers always see latest values
  const searchRef = useRef(search);
  searchRef.current = search;
  const suppressedRef = useRef(suppressed);
  suppressedRef.current = suppressed;

  function handleInput(text: string, cursorPos: number) {
    if (suppressedRef.current) {
      setState((prev) => (prev.isOpen ? INITIAL_STATE : prev));
      return;
    }

    // Scan backwards from cursor for the trigger character
    let triggerPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === triggerChar) {
        if (i === 0 || /[\s\n]/.test(text[i - 1])) {
          triggerPos = i;
        }
        break;
      }
      if (text[i] === '\n') break;
    }

    if (triggerPos === -1) {
      setState((prev) => (prev.isOpen ? INITIAL_STATE : prev));
      return;
    }

    const query = text.slice(triggerPos + 1, cursorPos);
    const matches = searchRef.current(query).slice(0, maxResults);

    if (query.trim() && matches.length === 0) {
      setState(INITIAL_STATE);
      return;
    }

    setState({
      isOpen: true,
      query,
      triggerPosition: triggerPos,
      matches,
      selectedIndex: 0,
    });
  }

  function selectPrevious() {
    setState((prev) => ({
      ...prev,
      selectedIndex: prev.selectedIndex <= 0 ? prev.matches.length - 1 : prev.selectedIndex - 1,
    }));
  }

  function selectNext() {
    setState((prev) => ({
      ...prev,
      selectedIndex: prev.selectedIndex >= prev.matches.length - 1 ? 0 : prev.selectedIndex + 1,
    }));
  }

  function setHighlight(index: number) {
    setState((prev) => ({ ...prev, selectedIndex: index }));
  }

  function close() {
    setState(INITIAL_STATE);
  }

  function getSelectedItem() {
    if (!state.isOpen || state.matches.length === 0) return null;
    return state.matches[state.selectedIndex]?.item ?? null;
  }

  return {
    state,
    handleInput,
    selectPrevious,
    selectNext,
    setHighlight,
    close,
    getSelectedItem,
  };
}
