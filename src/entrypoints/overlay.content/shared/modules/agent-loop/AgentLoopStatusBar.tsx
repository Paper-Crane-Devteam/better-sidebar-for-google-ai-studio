/**
 * AgentLoopStatusBar — Non-blocking status indicator for Agent Loop.
 * Shows a compact pill with current activity status + action buttons.
 * Persists after loop ends so user can review the session history via the panel.
 *
 * Uses forwardRef so it can serve as Radix Popover.Trigger via `asChild`.
 */

import React, { forwardRef, useMemo } from 'react';
import { useAgentLoopStore } from './agent-loop-store';

interface AgentLoopStatusBarProps extends React.HTMLAttributes<HTMLDivElement> {
  onStop: () => void;
  onRetry: () => void;
}

export const AgentLoopStatusBar = forwardRef<HTMLDivElement, AgentLoopStatusBarProps>(
  ({ onStop, onRetry, ...props }, ref) => {
    const status = useAgentLoopStore((s) => s.status);
    const currentRound = useAgentLoopStore((s) => s.currentRound);
    const currentTool = useAgentLoopStore((s) => s.currentTool);
    const currentResults = useAgentLoopStore((s) => s.currentResults);
    const history = useAgentLoopStore((s) => s.history);
    const errorMessage = useAgentLoopStore((s) => s.errorMessage);
    const speedMode = useAgentLoopStore((s) => s.speedMode);

    // Total tool calls across all rounds
    const totalToolCalls = useMemo(() => {
      return currentResults.length + history.reduce((sum, h) => sum + h.results.length, 0);
    }, [currentResults, history]);

    // Don't render if never started (no history and idle)
    if (status === 'idle' && currentRound === 0 && history.length === 0) return null;

    const getStatusDisplay = () => {
      switch (status) {
        case 'waiting_ai':
          return { text: 'Thinking...', icon: '🧠' };
        case 'parsing':
          return { text: 'Parsing...', icon: '📋' };
        case 'executing':
          return { text: currentTool ? `${currentTool}` : 'Executing...', icon: '⚙️' };
        case 'sending':
          return { text: 'Sending...', icon: '📤' };
        case 'paused':
          return { text: errorMessage || 'Paused', icon: '⏸️' };
        case 'error':
          return { text: errorMessage || 'Error', icon: '❌' };
        case 'idle':
          return { text: `${totalToolCalls} tools · ${currentRound} rounds`, icon: '✅' };
        default:
          return { text: '', icon: '' };
      }
    };

    const { text, icon } = getStatusDisplay();
    const isActive = ['waiting_ai', 'parsing', 'executing', 'sending'].includes(status);
    const isPaused = status === 'paused';
    const isError = status === 'error';
    const isIdle = status === 'idle';

    return (
      <div
        ref={ref}
        {...props}
        className={`fixed bottom-20 left-1/2 z-[99998] flex -translate-x-1/2 cursor-pointer items-center gap-2.5 rounded-full border px-4 py-2 shadow-lg transition-all duration-200 ${
          speedMode
            ? 'border-orange-500/50 bg-orange-500/10'
            : isError
              ? 'border-destructive/30 bg-destructive/10'
              : isPaused
                ? 'border-warning/30 bg-warning/10'
                : isIdle
                  ? 'border-border/50 bg-muted/80'
                  : 'border-primary/30 bg-primary/10'
        }`}
      >
        {/* Activity indicator */}
        {isActive ? (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <span className="text-xs">{icon}</span>
        )}

        {/* Speed mode badge */}
        {speedMode && <span className="text-[10px] font-bold text-orange-500">⚡</span>}

        {/* Round badge (only during active execution) */}
        {!isIdle && (
          <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            R{currentRound}
          </span>
        )}

        {/* Status text */}
        <span className="max-w-[180px] truncate text-xs text-muted-foreground">
          {text}
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
              Dismiss
            </button>
          </div>
        )}

        {/* Idle state: view details hint */}
        {isIdle && (
          <span className="text-[10px] text-muted-foreground/60">Click to view</span>
        )}
      </div>
    );
  },
);

AgentLoopStatusBar.displayName = 'AgentLoopStatusBar';
