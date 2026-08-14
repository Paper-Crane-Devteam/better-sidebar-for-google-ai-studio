/**
 * ConversationViewSwitcher — top-left control for choosing between the site's own
 * conversation DOM and the agent's rendered view.
 *
 * Deliberately a two-segment control rather than a single action button. The old
 * button labelled itself with the view you would *get* by pressing it while colouring
 * itself like a status badge, so "Agent 渲染" in green meant "you are currently NOT in
 * the agent view" — the exact opposite of how it read. Showing both views at once and
 * highlighting the active one removes the guesswork; the round counter and the pulsing
 * dot are gone too, since the dock already reports what the loop is doing.
 */

import React, { useEffect } from 'react';
import { useAgentLoopStore } from '../agent-loop-store';
import { useAgentViewStore } from '../agent-view-store';
import { useAgentViewState } from './useAgentViewState';
import { cn } from '@/shared/lib/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { useAppStore } from '@/shared/lib/store';
import { detectPlatform, Platform } from '@/shared/types/platform';
import { useCurrentConversationId } from '@/entrypoints/overlay.content/shared/hooks/useCurrentConversationId';

type ViewMode = 'custom' | 'original';

/**
 * Hook to compute dynamic left offset for elements placed beside the sidebar.
 * Derived purely from Zustand stores (usePegasusStore & useAppStore).
 */
function useSidebarOffset(defaultOffset = 16) {
  const platform = detectPlatform();

  const aistudioWidth = usePegasusStore(
    (s) => s.enhancedFeatures.aistudio?.sidebarWidth ?? 320,
  );
  const geminiWidth = usePegasusStore(
    (s) => s.enhancedFeatures.gemini?.sidebarWidth ?? 320,
  );
  const isSidebarExpanded = useAppStore(
    (s) => s.ui.overlay.isSidebarExpanded,
  );

  let width = 320;
  if (platform === Platform.AI_STUDIO) {
    width = aistudioWidth;
  } else {
    width = isSidebarExpanded ? geminiWidth : 56;
  }

  return width + defaultOffset;
}

export const ConversationViewSwitcher: React.FC = () => {
  const { t } = useI18n();
  const viewMode = useAgentLoopStore((s) => s.viewMode);
  const setViewMode = useAgentLoopStore((s) => s.setViewMode);
  const { hasAgentContent, isRunning } = useAgentViewState();
  const leftPx = useSidebarOffset(16);
  const conversationId = useCurrentConversationId();

  // Nothing to switch between on a plain conversation: the overlay has nothing to
  // render there, so a toggle would just blank the chat out.
  const shouldShow = hasAgentContent || isRunning;

  const override = useAgentViewStore((s) =>
    conversationId ? s.overrides[conversationId] : undefined,
  );
  const setOverride = useAgentViewStore((s) => s.setOverride);

  /**
   * Resolve the view from the conversation instead of resetting it on navigation.
   *
   * The old effect forced 'original' whenever the conversation id changed while
   * idle, which is also what happens on a reload (null → id) and on reopening an
   * old chat. So an agent conversation always came up as raw Gemini DOM and the user
   * had to press the toggle every single time, even though the page plainly contains
   * agent turns.
   *
   * Now the presence of agent content *is* the default, and only an explicit toggle
   * is remembered. `hasAgentContent` is in the deps for a reason: it starts false on
   * mount and turns true once the DOM has been parsed, a tick or two later.
   */
  useEffect(() => {
    const desired = override ?? (hasAgentContent || isRunning ? 'custom' : 'original');
    if (viewMode !== desired) setViewMode(desired);
  }, [override, hasAgentContent, isRunning, viewMode, setViewMode]);

  if (!shouldShow) {
    return null;
  }

  const active: ViewMode = viewMode === 'custom' ? 'custom' : 'original';

  const selectView = (next: ViewMode) => {
    if (next === active) return;
    setViewMode(next);
    if (conversationId) setOverride(conversationId, next);
  };

  const options: { mode: ViewMode; label: string; hint: string }[] = [
    {
      mode: 'custom',
      label: t('agent.view.agent', { defaultValue: 'Agent' }),
      hint: t('agent.view.agentHint', {
        defaultValue: "The agent's steps and results, laid out to be readable",
      }),
    },
    {
      mode: 'original',
      label: t('agent.view.original', { defaultValue: 'Original' }),
      hint: t('agent.view.originalHint', {
        defaultValue: 'The conversation exactly as the site renders it',
      }),
    },
  ];

  return (
    <div
      className="fixed top-3 z-[60] transition-[left] duration-200 ease-out"
      style={{ left: `${leftPx}px` }}
    >
      <div
        role="group"
        aria-label={t('agent.view.label', { defaultValue: 'Conversation view' })}
        className="flex items-center gap-1 rounded-full border border-border/60 bg-background/85 p-1 shadow-md backdrop-blur-md"
      >
        {options.map((option) => {
          const isActive = option.mode === active;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => selectView(option.mode)}
              title={option.hint}
              aria-pressed={isActive}
              className={cn(
                'cursor-pointer select-none rounded-full px-3 py-1 text-xs font-medium leading-4 transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
