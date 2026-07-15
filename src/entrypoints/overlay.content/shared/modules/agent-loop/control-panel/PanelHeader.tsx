/**
 * PanelHeader — Status indicator, round counter, breakpoint mark, speed badge, token estimation.
 */

import React from 'react';
import { useAgentLoopStore } from '../agent-loop-store';
import { formatTokenCount } from './utils';

export const PanelHeader: React.FC = () => {
  const status = useAgentLoopStore((s) => s.status);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const maxRounds = useAgentLoopStore((s) => s.maxRounds);
  const breakpointRound = useAgentLoopStore((s) => s.breakpointRound);
  const tokenEstimation = useAgentLoopStore((s) => s.tokenEstimation);
  const speedMode = useAgentLoopStore((s) => s.speedMode);

  return (
    <div
      className={`flex items-center justify-between border-b border-border px-4 py-3 ${
        speedMode ? 'border-orange-500/30 bg-orange-500/5' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Agent Loop</span>
        {status !== 'idle' && (
          <span className="text-xs text-muted-foreground">
            Round {currentRound}/{maxRounds}
            {breakpointRound && (
              <span className="ml-1 text-orange-500">⏸{breakpointRound}</span>
            )}
          </span>
        )}
        {speedMode && (
          <span className="text-xs font-medium text-orange-500">⚡ SPEED</span>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {formatTokenCount(tokenEstimation)}
      </span>
    </div>
  );
};
