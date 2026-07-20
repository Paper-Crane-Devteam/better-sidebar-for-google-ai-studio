/**
 * ConversationViewSwitcher — Top-left toggle control for switching between
 * native AI Studio conversation DOM and custom Agent rendered view.
 */

import React from 'react';
import { useAgentLoopStore } from '../agent-loop-store';
import { useConversationMessages } from './useConversationMessages';
import { Eye, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export const ConversationViewSwitcher: React.FC = () => {
  const viewMode = useAgentLoopStore((s) => s.viewMode);
  const setViewMode = useAgentLoopStore((s) => s.setViewMode);
  const status = useAgentLoopStore((s) => s.status);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const messages = useConversationMessages();

  const hasAgentContent = messages.some(
    (m) => Boolean(m.promptId) || (m.toolCalls && m.toolCalls.length > 0) || Boolean(m.isToolResult),
  );

  return (
    <div className="absolute top-3 left-4 z-[60] flex items-center gap-1 rounded-full border border-border/60 bg-background/85 px-1.5 py-1 backdrop-blur-md shadow-lg transition-all duration-200">
      <button
        type="button"
        onClick={() => setViewMode('original')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 cursor-pointer select-none',
          viewMode === 'original'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
        title="切换到 AI Studio 原生对话 DOM 视图"
      >
        <Eye className="h-3.5 w-3.5" />
        <span>原生视图</span>
      </button>

      <button
        type="button"
        onClick={() => setViewMode('custom')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 cursor-pointer select-none',
          viewMode === 'custom'
            ? 'bg-emerald-600 text-white dark:bg-emerald-500 shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
        title="切换到 Agent 定制渲染视图 (包含 Tool Widget 及 Agent 步骤)"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Agent 渲染</span>
        {status !== 'idle' ? (
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-emerald-400/30 px-1.5 text-[10px] font-bold text-emerald-100">
            R{currentRound}
          </span>
        ) : hasAgentContent ? (
          <span className="ml-1 h-2 w-2 rounded-full bg-emerald-300 animate-pulse" title="检测到 Agent 历史记录" />
        ) : null}
      </button>
    </div>
  );
};
