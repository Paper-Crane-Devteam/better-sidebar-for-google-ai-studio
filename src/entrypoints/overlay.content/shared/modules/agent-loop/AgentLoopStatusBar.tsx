/**
 * AgentLoopStatusBar — Non-blocking status indicator shown while Agent Loop is running.
 * Displays current round, executing tool, and provides stop/retry controls.
 *
 * Uses forwardRef so it can serve as Radix Popover.Trigger via `asChild`.
 */

import React, { forwardRef } from 'react';
import { useAgentLoopStore } from './agent-loop-store';

interface AgentLoopStatusBarProps extends React.HTMLAttributes<HTMLDivElement> {
  onStop: () => void;
  onRetry: () => void;
}

export const AgentLoopStatusBar = forwardRef<HTMLDivElement, AgentLoopStatusBarProps>(
  ({ onStop, onRetry, ...props }, ref) => {
    const status = useAgentLoopStore((s) => s.status);
    const currentRound = useAgentLoopStore((s) => s.currentRound);
    const maxRounds = useAgentLoopStore((s) => s.maxRounds);
    const currentTool = useAgentLoopStore((s) => s.currentTool);
    const errorMessage = useAgentLoopStore((s) => s.errorMessage);
    const speedMode = useAgentLoopStore((s) => s.speedMode);

    if (status === 'idle') return null;

    const getStatusText = () => {
      switch (status) {
        case 'waiting_ai':
          return 'Waiting for AI response...';
        case 'parsing':
          return 'Parsing tool calls...';
        case 'executing':
          return currentTool ? `Executing: ${currentTool}` : 'Executing tools...';
        case 'sending':
          return 'Sending results...';
        case 'paused':
          return errorMessage || 'Paused';
        case 'error':
          return errorMessage || 'Error occurred';
        default:
          return '';
      }
    };

    const isActive = ['waiting_ai', 'parsing', 'executing', 'sending'].includes(status);
    const isPaused = status === 'paused';
    const isError = status === 'error';

    return (
      <div
        ref={ref}
        {...props}
        className={`fixed bottom-20 left-1/2 z-[99998] flex -translate-x-1/2 cursor-pointer items-center gap-3 rounded-full border px-4 py-2 shadow-lg ${
          speedMode
            ? 'border-orange-500/50 bg-orange-500/10'
            : isError
              ? 'border-destructive/30 bg-destructive/10'
              : isPaused
                ? 'border-warning/30 bg-warning/10'
                : 'border-primary/30 bg-primary/10'
        }`}
      >
        {/* Spinner */}
        {isActive && (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}

        {/* Speed mode indicator */}
        {speedMode && <span className="text-xs text-orange-500">⚡</span>}

        {/* Round indicator */}
        <span className="text-xs font-medium text-foreground">
          Round {currentRound}/{maxRounds}
        </span>

        {/* Status text */}
        <span className="max-w-[200px] truncate text-xs text-muted-foreground">
          {getStatusText()}
        </span>

        {/* Action buttons */}
        {isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStop();
            }}
            className="rounded-full bg-destructive/20 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/30 transition-colors"
          >
            Stop
          </button>
        )}

        {(isPaused || isError) && (
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/30 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStop();
              }}
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              Stop
            </button>
          </div>
        )}
      </div>
    );
  },
);

AgentLoopStatusBar.displayName = 'AgentLoopStatusBar';
