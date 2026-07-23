/**
 * AgentStatusHeader — Top section of the status panel.
 * Shows: status indicator, round counter, active skill, token count, stop/retry buttons.
 */

import React from 'react';
import { Square, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils/utils';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { getSkillById } from '../../agent-loop/skills/skill-registry';

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  waiting_ai: 'Waiting for AI...',
  parsing: 'Parsing...',
  executing: 'Executing...',
  sending: 'Sending...',
  paused: 'Paused',
  error: 'Error',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-muted-foreground',
  waiting_ai: 'bg-yellow-500',
  parsing: 'bg-blue-500',
  executing: 'bg-green-500',
  sending: 'bg-blue-500',
  paused: 'bg-orange-500',
  error: 'bg-red-500',
};

function formatTokenCount(count: number): string {
  if (count < 1000) return `~${count}`;
  if (count < 1000000) return `~${(count / 1000).toFixed(1)}k`;
  return `~${(count / 1000000).toFixed(1)}M`;
}

export const AgentStatusHeader: React.FC = () => {
  const status = useAgentLoopStore((s) => s.status);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const maxRounds = useAgentLoopStore((s) => s.maxRounds);
  const speedMode = useAgentLoopStore((s) => s.speedMode);
  const tokenEstimation = useAgentLoopStore((s) => s.tokenEstimation);
  const activeSkillId = useAgentLoopStore((s) => s.activeSkillId);
  const currentTool = useAgentLoopStore((s) => s.currentTool);

  const activeSkill = activeSkillId ? getSkillById(activeSkillId) : null;
  const isRunning = status !== 'idle';
  const isPulsing = status === 'waiting_ai' || status === 'executing' || status === 'sending';

  return (
    <div
      className={cn(
        'px-3 py-3 border-b border-border/50 space-y-2',
        speedMode && 'bg-orange-500/5 border-orange-500/20',
      )}
    >
      {/* Row 1: Status + Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Status dot with pulse animation */}
          <div className="relative">
            <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[status])} />
            {isPulsing && (
              <div
                className={cn(
                  'absolute inset-0 rounded-full animate-ping',
                  STATUS_COLORS[status],
                  'opacity-40',
                )}
              />
            )}
          </div>

          <span className="text-xs font-medium text-foreground">
            {STATUS_LABELS[status] || status}
          </span>

          {speedMode && (
            <span className="flex items-center gap-0.5 text-[10px] text-orange-500 font-medium">
              <Zap className="h-3 w-3" />
              SPEED
            </span>
          )}
        </div>

        {/* Stop / Retry buttons */}
        <div className="flex items-center gap-1">
          {isRunning && (
            <SimpleTooltip content="Stop">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                onClick={() => useAgentLoopStore.getState().stop()}
              >
                <Square className="h-3 w-3" />
              </Button>
            </SimpleTooltip>
          )}
          {status === 'paused' || status === 'error' ? (
            <SimpleTooltip content="Retry">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => useAgentLoopStore.getState().resume()}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </SimpleTooltip>
          ) : null}
        </div>
      </div>

      {/* Row 2: Round + Skill + Token */}
      {(currentRound > 0 || activeSkill) && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            {currentRound > 0 && (
              <span>
                Round {currentRound}/{maxRounds}
              </span>
            )}
            {activeSkill && (
              <span className="px-1 py-0.5 rounded bg-primary/10 text-primary text-[9px]">
                {activeSkill.title}
              </span>
            )}
          </div>
          {tokenEstimation > 0 && <span>{formatTokenCount(tokenEstimation)} tokens</span>}
        </div>
      )}

      {/* Row 3: Currently executing tool */}
      {currentTool && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div className="h-3 w-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          <span className="truncate">{currentTool}</span>
        </div>
      )}
    </div>
  );
};
