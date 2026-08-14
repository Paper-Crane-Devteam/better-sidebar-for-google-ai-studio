/**
 * SessionEndCard — inline indicator at the bottom of the conversation overlay
 * showing the task has finished, with a short status summary.
 *
 * Deliberately minimal: the detailed summary with step counts, retry, etc.
 * lives in the dock (AgentSessionSummary). This just makes it visible in the
 * conversation flow that nothing more is coming.
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, Square } from 'lucide-react';
import type { AgentEndReason } from '../../types';
import { useI18n } from '@/shared/hooks/useI18n';

interface SessionEndCardProps {
  endReason: AgentEndReason;
}

export const SessionEndCard: React.FC<SessionEndCardProps> = ({ endReason }) => {
  const { t } = useI18n();

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

  const Icon = isSuccess ? CheckCircle2 : isStop ? Square : AlertTriangle;
  const iconColor = isSuccess
    ? 'text-green-500'
    : isStop
      ? 'text-muted-foreground'
      : 'text-amber-500';

  return (
    <div className="my-6 flex items-center justify-center gap-2 py-3">
      <div className="h-px flex-1 bg-border/50" />
      <div className="flex items-center gap-1.5 px-3">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  );
};
