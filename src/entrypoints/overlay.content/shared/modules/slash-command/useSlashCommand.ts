/**
 * useSlashCommand — Slash command popup triggered by `/`.
 * Thin wrapper around shared useTriggerPopup.
 */

import { useAppStore } from '@/shared/lib/store/store-impl';
import type { Prompt } from '@/shared/types/db';
import type { SlashCommandState, SlashCommandMatch } from './types';
import { useTriggerPopup } from '../../features/trigger-popup';
import type { TriggerPopupMatch } from '../../features/trigger-popup';

export function useSlashCommand() {
  const prompts = useAppStore((s) => s.prompts);

  /**
   * Search prompts by title (multi-word AND, scored by position).
   */
  function search(query: string): TriggerPopupMatch[] {
    if (!query || !query.trim()) {
      return prompts.slice(0, 8).map((p) => ({
        item: { id: p.id, title: p.title, icon: p.icon, content: p.content || '', meta: p },
      }));
    }

    const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const results: Array<{ prompt: Prompt; score: number; ranges: Array<[number, number]> }> = [];

    for (const prompt of prompts) {
      const title = prompt.title.toLowerCase();
      let allMatch = true;
      const ranges: Array<[number, number]> = [];
      let totalScore = 0;

      for (const word of queryWords) {
        const idx = title.indexOf(word);
        if (idx === -1) { allMatch = false; break; }
        ranges.push([idx, idx + word.length]);
        totalScore += idx === 0 ? 100 : 50 - Math.min(idx, 49);
      }

      if (allMatch) {
        ranges.sort((a, b) => a[0] - b[0]);
        results.push({ prompt, score: totalScore, ranges });
      }
    }

    results.sort((a, b) => b.score - a.score || a.prompt.title.localeCompare(b.prompt.title));

    return results.slice(0, 8).map((r) => ({
      item: { id: r.prompt.id, title: r.prompt.title, icon: r.prompt.icon, content: r.prompt.content || '', meta: r.prompt },
      matchRanges: r.ranges,
    }));
  }

  const popup = useTriggerPopup({ triggerChar: '/', search });

  // ─── Adapt to legacy SlashCommandState for backward compat ─────────

  const state: SlashCommandState = {
    isOpen: popup.state.isOpen,
    query: popup.state.query,
    slashPosition: popup.state.triggerPosition,
    matches: popup.state.matches.map((m) => ({
      prompt: m.item.meta as Prompt,
      matchRanges: m.matchRanges,
    })),
    selectedIndex: popup.state.selectedIndex,
  };

  function getSelectedPrompt(): Prompt | null {
    const item = popup.getSelectedItem();
    return item ? (item.meta as Prompt) : null;
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
