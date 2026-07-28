/**
 * ConversationViewSwitcher — Top-left toggle control for switching between
 * native AI Studio conversation DOM and custom Agent rendered view.
 */

import React, { useEffect, useRef } from 'react';
import { useAgentLoopStore } from '../agent-loop-store';
import { useConversationMessages } from './useConversationMessages';
import { Eye, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { useAppStore } from '@/shared/lib/store';
import { detectPlatform, Platform } from '@/shared/types/platform';
import { useCurrentConversationId } from '@/entrypoints/overlay.content/shared/hooks/useCurrentConversationId';

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
  const viewMode = useAgentLoopStore((s) => s.viewMode);
  const setViewMode = useAgentLoopStore((s) => s.setViewMode);
  const status = useAgentLoopStore((s) => s.status);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const messages = useConversationMessages();
  const leftPx = useSidebarOffset(16);
  const conversationId = useCurrentConversationId();

  const hasAgentContent = messages.some(
    (m) =>
      Boolean(m.promptId) ||
      (m.toolCalls && m.toolCalls.length > 0) ||
      m.toolResults.length > 0,
  );

  const isRunning = status !== 'idle';
  const shouldShow = hasAgentContent || isRunning;

  // Reset to the native view when the user actually navigates to another
  // conversation. Keying this on `status` too used to flip the view back to
  // native the moment a session finished, and on mount before it even started.
  const previousConversationId = useRef(conversationId);
  useEffect(() => {
    if (previousConversationId.current === conversationId) return;
    previousConversationId.current = conversationId;
    if (useAgentLoopStore.getState().status === 'idle') {
      setViewMode('original');
    }
  }, [conversationId, setViewMode]);

  if (!shouldShow) {
    return null;
  }

  const isCustom = viewMode === 'custom';

  const toggleViewMode = () => {
    setViewMode(isCustom ? 'original' : 'custom');
  };

  return (
    <div
      className="fixed top-3 z-[60] flex items-center transition-[left] duration-200 ease-out"
      style={{ left: `${leftPx}px` }}
    >
      <button
        type="button"
        onClick={toggleViewMode}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md shadow-md transition-all duration-200 cursor-pointer select-none',
          !isCustom
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/30'
            : 'border-border/60 bg-background/85 text-muted-foreground hover:text-foreground hover:bg-muted/60',
        )}
        title={
          isCustom
            ? '切换至 AI Studio 原生 DOM 视图'
            : '切换至 Agent 定制渲染视图'
        }
      >
        {!isCustom ? (
          <Sparkles className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
        ) : (
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span>{!isCustom ? 'Agent 渲染' : '原生视图'}</span>

        {status !== 'idle' ? (
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
            R{currentRound}
          </span>
        ) : hasAgentContent ? (
          <span
            className="ml-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
            title="检测到 Agent 历史记录"
          />
        ) : null}
      </button>
    </div>
  );
};

