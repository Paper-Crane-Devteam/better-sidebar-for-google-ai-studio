/**
 * AgentLoopStatusBar — Non-blocking status indicator shown while Agent Loop is running.
 * Displays current round, executing tool, and provides stop/retry controls.
 */

import React from 'react';
import { useAgentLoopStore } from './agent-loop-store';

interface AgentLoopStatusBarProps {
  onStop: () => void;
  onRetry: () => void;
}

export const AgentLoopStatusBar: React.FC<AgentLoopStatusBarProps> = ({ onStop, onRetry }) => {
  const status = useAgentLoopStore((s) => s.status);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const maxRounds = useAgentLoopStore((s) => s.maxRounds);
  const currentTool = useAgentLoopStore((s) => s.currentTool);
  const errorMessage = useAgentLoopStore((s) => s.errorMessage);

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
      className={`fixed bottom-20 left-1/2 z-[99998] flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 shadow-lg ${
        isError
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
          onClick={onStop}
          className="rounded-full bg-destructive/20 px-2.5 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/30 transition-colors"
        >
          Stop
        </button>
      )}

      {(isPaused || isError) && (
        <div className="flex gap-1.5">
          <button
            onClick={onRetry}
            className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={onStop}
            className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
};
