/**
 * AgentInterruptNotice — surfaces why the loop stopped (timeout, breakpoint,
 * circuit breaker, max rounds, error). `errorMessage` had no UI before, so the
 * user saw "Paused" with no explanation.
 */

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { getActiveEngine } from '../../agent-loop/engine/engine-registry';

export const AgentInterruptNotice: React.FC = () => {
  const { t } = useI18n();
  const status = useAgentLoopStore((s) => s.status);
  const errorMessage = useAgentLoopStore((s) => s.errorMessage);
  const checkInSteps = useAgentLoopStore((s) => s.checkInSteps);

  if (status !== 'paused' && status !== 'error') return null;
  // A routine check-in is also `paused`, but it isn't a fault — AgentCheckIn has it
  if (checkInSteps !== null) return null;

  const isError = status === 'error';

  return (
    <div
      className={cn(
        'space-y-2 rounded-md p-3',
        isError ? 'bg-destructive/10' : 'bg-orange-500/10',
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={cn('h-3 w-3 shrink-0', isError ? 'text-destructive' : 'text-orange-500')}
        />
        <span className="text-xs font-medium text-foreground">
          {isError
            ? t('agent.interrupt.errorTitle', { defaultValue: 'Something went wrong' })
            : t('agent.interrupt.pausedTitle', { defaultValue: 'Loop paused' })}
        </span>
      </div>

      {errorMessage && (
        <p className="text-xs leading-relaxed text-muted-foreground">{errorMessage}</p>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={() => {
            const engine = getActiveEngine();
            if (engine) void engine.resume();
          }}
        >
          <RotateCcw className="h-3 w-3" />
          {t('agent.actions.retry', { defaultValue: 'Retry' })}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            const engine = getActiveEngine();
            if (engine) engine.stop();
            else useAgentLoopStore.getState().stop();
          }}
        >
          {t('agent.actions.dismiss', { defaultValue: 'Dismiss' })}
        </Button>
      </div>
    </div>
  );
};
