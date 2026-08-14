/**
 * AgentSessionSummary — the card shown after a session ends.
 *
 * Answers "what just happened, and what can I do about it": outcome, step
 * count, a paywall upsell when the run was blocked, and a way to start over.
 * The engine's end reason used to be discarded, so a finished run and a
 * paywalled run looked identical.
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, Lock, RotateCcw, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAppStore } from '@/shared/lib/store';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';

export const AgentSessionSummary: React.FC = () => {
  const { t } = useI18n();
  const status = useAgentLoopStore((s) => s.status);
  const endReason = useAgentLoopStore((s) => s.endReason);
  const history = useAgentLoopStore((s) => s.history);
  const sessionTitle = useAgentLoopStore((s) => s.sessionTitle);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  if (status !== 'idle') return null;

  const steps = history.reduce((sum, h) => sum + h.results.length, 0);
  const failed = history.reduce(
    (sum, h) => sum + h.results.filter((r) => !r.success).length,
    0,
  );

  const isPaywall = endReason === 'paywall';
  const isClean = endReason === 'complete' && failed === 0;

  const finalNote =
    endReason === 'infeasible'
      ? [...history]
          .reverse()
          .flatMap((h) => [...h.results].reverse())
          .find((r) => r.toolName === 'complete_task')?.result
      : null;

  const headline = (() => {
    switch (endReason) {
      case 'complete':
        return t('agent.summary.done', { defaultValue: 'Task finished' });
      case 'infeasible':
        return t('agent.summary.infeasible', { defaultValue: "Couldn't be done" });
      case 'paywall':
        return t('agent.summary.paywall', { defaultValue: 'Upgrade required' });
      case 'user_stop':
        return t('agent.summary.stopped', { defaultValue: 'Stopped' });
      case 'circuit_breaker':
        return t('agent.summary.stuck', { defaultValue: 'Stopped — the agent was looping' });
      case 'no_tool_call':
        return t('agent.summary.noToolCall', { defaultValue: 'Stopped — no action was taken' });
      default:
        return t('agent.summary.ended', { defaultValue: 'Session ended' });
    }
  })();

  return (
    <div
      className={cn(
        'space-y-2 rounded-md p-3',
        isPaywall
          ? 'bg-primary/10'
          : isClean
            ? 'bg-green-500/10'
            : 'bg-muted/40',
      )}
    >
      <div className="flex items-center gap-2">
        {isPaywall ? (
          <Lock className="h-3 w-3 shrink-0 text-primary" />
        ) : isClean ? (
          <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
        ) : (
          <AlertTriangle className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="text-xs font-medium text-foreground">{headline}</span>
      </div>

      {sessionTitle && (
        <p className="truncate text-xs text-muted-foreground" title={sessionTitle}>
          {sessionTitle}
        </p>
      )}

      {/* For a verdict of "can't be done", the reason *is* the outcome — a step
          count tells the user nothing about what to do next. */}
      {finalNote && (
        <p className="text-xs leading-relaxed text-foreground">{finalNote}</p>
      )}

      {/* The last message is the whole explanation here, and it's right there in the
          chat — so point at it instead of repeating a step count. */}
      {endReason === 'no_tool_call' && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('agent.summary.noToolCallDesc', {
            defaultValue:
              "The agent's last reply didn't run anything. Read it in the chat — if the task still needs doing, start it again.",
          })}
        </p>
      )}

      {isPaywall ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('agent.summary.paywallDesc', {
            defaultValue:
              'The free plan lets the agent read your data but not change it. Upgrade to allow writes.',
          })}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {steps > 0
            ? t('agent.summary.steps', { defaultValue: '{{count}} steps run', count: steps })
            : t('agent.summary.noSteps', { defaultValue: 'No tools were run.' })}
          {failed > 0 &&
            ` · ${t('agent.summary.failed', { defaultValue: '{{count}} failed', count: failed })}`}
        </p>
      )}

      <div className="flex items-center gap-2">
        {isPaywall ? (
          <Button size="sm" className="h-7 text-xs" onClick={() => setSettingsOpen(true)}>
            {t('agent.summary.upgrade', { defaultValue: 'See plans' })}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => useAgentLoopStore.getState().reset()}
          >
            <RotateCcw className="h-3 w-3" />
            {t('agent.summary.again', { defaultValue: 'New task' })}
          </Button>
        )}
        {isPaywall && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => useAgentLoopStore.getState().reset()}
          >
            <X className="h-3 w-3" />
            {t('agent.summary.clear', { defaultValue: 'Clear' })}
          </Button>
        )}
      </div>
    </div>
  );
};
