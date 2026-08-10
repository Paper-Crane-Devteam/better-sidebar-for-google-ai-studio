/**
 * AgentStatusHeader — Top section of the status panel.
 * Shows: status indicator, step counter, active skill, stop/retry.
 *
 * Stop / Retry act on the real engine instance (via the engine registry), not
 * just on the store — mutating the store alone left the engine running.
 */

import React from 'react';
import { Square, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { getActiveEngine } from '../../agent-loop/engine/engine-registry';
import { getSkillById } from '../../agent-loop/skills/skill-registry';
import type { AgentLoopStatus } from '../../agent-loop/types';

const STATUS_FALLBACK: Record<AgentLoopStatus, string> = {
  idle: 'Completed',
  waiting_ai: 'Thinking...',
  parsing: 'Reading response...',
  executing: 'Working...',
  awaiting_approval: 'Waiting for your approval',
  sending: 'Sending...',
  awaiting_send: 'Waiting for you',
  paused: 'Paused',
  error: 'Error',
};

const STATUS_COLORS: Record<AgentLoopStatus, string> = {
  idle: 'bg-muted-foreground',
  waiting_ai: 'bg-blue-500',
  parsing: 'bg-blue-500',
  executing: 'bg-green-500',
  awaiting_approval: 'bg-amber-500',
  sending: 'bg-blue-500',
  awaiting_send: 'bg-primary',
  paused: 'bg-orange-500',
  error: 'bg-red-500',
};

export const AgentStatusHeader: React.FC = () => {
  const { t } = useI18n();
  const status = useAgentLoopStore((s) => s.status);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const speedMode = useAgentLoopStore((s) => s.speedMode);
  const activeSkillId = useAgentLoopStore((s) => s.activeSkillId);
  const sessionTitle = useAgentLoopStore((s) => s.sessionTitle);
  const currentTool = useAgentLoopStore((s) => s.currentTool);
  const checkInSteps = useAgentLoopStore((s) => s.checkInSteps);

  const activeSkill = activeSkillId ? getSkillById(activeSkillId) : null;
  const isActive =
    status === 'waiting_ai' ||
    status === 'parsing' ||
    status === 'executing' ||
    status === 'sending';
  const canStop = status !== 'idle';
  const canRetry = status === 'paused' || status === 'error';

  const handleStop = () => {
    const engine = getActiveEngine();
    if (engine) engine.stop();
    // Fallback so the UI never gets stuck if the engine handle is gone
    else useAgentLoopStore.getState().stop();
  };

  const handleRetry = () => {
    const engine = getActiveEngine();
    if (engine) void engine.resume();
  };

  return (
    <div
      className={cn(
        'px-3 py-2 border-b border-border/50 space-y-1',
        speedMode && 'bg-orange-500/5 border-orange-500/20',
      )}
    >
      {/* Row 1: Status + Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative shrink-0">
            <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[status])} />
            {isActive && (
              <div
                className={cn(
                  'absolute inset-0 rounded-full animate-ping opacity-40',
                  STATUS_COLORS[status],
                )}
              />
            )}
          </div>

          {/* A check-in is `paused` too, but labelling it "Paused" next to a neutral
              "have a look" card reads like two different things happened. */}
          <span className="truncate text-xs font-medium text-foreground">
            {checkInSteps !== null
              ? t('agent.status.checkIn', { defaultValue: 'Waiting for your go-ahead' })
              : t(`agent.status.${status}`, { defaultValue: STATUS_FALLBACK[status] })}
          </span>

          {speedMode && (
            <SimpleTooltip
              content={t('agent.header.speedHint', {
                defaultValue: 'Nothing will be asked about for the rest of this task',
              })}
            >
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-orange-500">
                <Zap className="h-3 w-3" />
              </span>
            </SimpleTooltip>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canRetry && (
            <SimpleTooltip content={t('agent.actions.retry', { defaultValue: 'Retry' })}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleRetry}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </SimpleTooltip>
          )}
          {canStop && (
            <SimpleTooltip content={t('agent.actions.stop', { defaultValue: 'Stop' })}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={handleStop}
              >
                <Square className="h-3 w-3" />
              </Button>
            </SimpleTooltip>
          )}
        </div>
      </div>

      {/* Row 2: Task title */}
      {sessionTitle && (
        <div className="truncate text-xs text-muted-foreground" title={sessionTitle}>
          {sessionTitle}
        </div>
      )}

      {/* Row 3: Step + skill */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {currentRound > 0 && (
          <span className="shrink-0">
            {t('agent.header.step', {
              defaultValue: 'Step {{count}}',
              count: currentRound,
            })}
          </span>
        )}
        {activeSkill && (
          <span className="truncate rounded bg-primary/10 px-1 text-primary">
            {activeSkill.title}
          </span>
        )}
      </div>

      {/* Row 4: Currently executing tool */}
      {currentTool && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
          <span className="truncate">{currentTool}</span>
        </div>
      )}
    </div>
  );
};
