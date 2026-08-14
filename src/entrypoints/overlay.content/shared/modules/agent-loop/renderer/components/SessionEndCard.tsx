/**
 * SessionEndCard — the "that's the end of the task" marker in the conversation.
 *
 * A divider rather than a card: the dock already carries the detailed summary (step
 * counts, failures, upgrade prompts), and repeating it here would give the same
 * information two competing homes.
 *
 * It does own the *primary* undo entry point, though. The dock can be collapsed,
 * dismissed, or left behind by switching conversations, while this sits at the bottom
 * of the transcript — which is where someone looking over what the agent did actually
 * is when they decide they want it reverted.
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, Square, Undo2, RotateCcw } from 'lucide-react';
import type { AgentEndReason } from '../../types';
import { useI18n } from '@/shared/hooks/useI18n';
import { useUndoAvailable, useUndoWasUndone, useUndoAction } from '../../undo';

interface SessionEndCardProps {
  endReason: AgentEndReason;
}

export const SessionEndCard: React.FC<SessionEndCardProps> = ({ endReason }) => {
  const { t } = useI18n();
  const undoAvailable = useUndoAvailable();
  const undone = useUndoWasUndone();
  const { undoing, runUndo } = useUndoAction();

  const isSuccess = endReason === 'complete';
  const isStop = endReason === 'user_stop';

  const label = (() => {
    switch (endReason) {
      case 'complete':
        return t('agent.summary.done', { defaultValue: 'Task finished' });
      case 'infeasible':
        return t('agent.summary.infeasible', { defaultValue: "Couldn't be done" });
      case 'user_stop':
        return t('agent.summary.stopped', { defaultValue: 'Stopped' });
      case 'circuit_breaker':
        return t('agent.summary.stuck', { defaultValue: 'Stopped — the agent was looping' });
      case 'no_tool_call':
        return t('agent.summary.noToolCall', { defaultValue: 'Stopped — no action was taken' });
      case 'paywall':
        return t('agent.summary.paywall', { defaultValue: 'Upgrade required' });
      default:
        return t('agent.summary.ended', { defaultValue: 'Session ended' });
    }
  })();

  // Reverted wins over the end reason: the transcript above still describes changes
  // that no longer exist, so "Task finished" alone would read as confirmation.
  const Icon = undone ? RotateCcw : isSuccess ? CheckCircle2 : isStop ? Square : AlertTriangle;
  const iconColor = undone
    ? 'text-muted-foreground'
    : isSuccess
      ? 'text-green-500'
      : isStop
        ? 'text-muted-foreground'
        : 'text-amber-500';

  return (
    <div className="my-6 flex items-center gap-2 py-3">
      <div className="h-px flex-1 bg-border/50" />

      <div className="flex items-center gap-2 px-3">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <span className="text-xs font-medium text-muted-foreground">
          {undone ? t('agent.undo.reverted', { defaultValue: 'Changes reverted' }) : label}
        </span>

        {undoAvailable && (
          <button
            type="button"
            onClick={runUndo}
            disabled={undoing}
            className="ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs
                       font-medium text-[rgb(var(--highlight))] transition-colors
                       hover:bg-[rgb(var(--highlight)/0.1)] disabled:opacity-50"
          >
            <Undo2 className="h-3 w-3" />
            {undoing
              ? t('agent.undo.working', { defaultValue: 'Undoing…' })
              : t('agent.undo.action', { defaultValue: 'Undo changes' })}
          </button>
        )}
      </div>

      <div className="h-px flex-1 bg-border/50" />
    </div>
  );
};
