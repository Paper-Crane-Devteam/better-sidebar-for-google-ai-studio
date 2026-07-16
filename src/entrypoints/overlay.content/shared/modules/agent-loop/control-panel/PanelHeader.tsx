/**
 * PanelHeader — Rich status display with useful metrics.
 * Shows: status indicator, round (no max), elapsed time, token estimation, tool stats.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAgentLoopStore } from '../agent-loop-store';
import { formatTokenCount } from './utils';

export const PanelHeader: React.FC = () => {
  const status = useAgentLoopStore((s) => s.status);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const currentResults = useAgentLoopStore((s) => s.currentResults);
  const history = useAgentLoopStore((s) => s.history);
  const breakpointRound = useAgentLoopStore((s) => s.breakpointRound);
  const tokenEstimation = useAgentLoopStore((s) => s.tokenEstimation);
  const speedMode = useAgentLoopStore((s) => s.speedMode);

  // Elapsed time tracking
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status === 'idle') return;
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [status, startTime]);

  const formatElapsed = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  // Aggregate stats
  const totalToolCalls = useMemo(() => {
    return currentResults.length + history.reduce((sum, h) => sum + h.results.length, 0);
  }, [currentResults, history]);

  const successRate = useMemo(() => {
    const all = [
      ...currentResults,
      ...history.flatMap((h) => h.results),
    ];
    if (all.length === 0) return 100;
    const successCount = all.filter((r) => r.success).length;
    return Math.round((successCount / all.length) * 100);
  }, [currentResults, history]);

  const isActive = status !== 'idle';

  const getStatusBadge = () => {
    switch (status) {
      case 'waiting_ai':
        return { label: 'Thinking', color: 'bg-blue-500/20 text-blue-600' };
      case 'parsing':
        return { label: 'Parsing', color: 'bg-purple-500/20 text-purple-600' };
      case 'executing':
        return { label: 'Executing', color: 'bg-green-500/20 text-green-600' };
      case 'sending':
        return { label: 'Sending', color: 'bg-cyan-500/20 text-cyan-600' };
      case 'paused':
        return { label: 'Paused', color: 'bg-yellow-500/20 text-yellow-700' };
      case 'error':
        return { label: 'Error', color: 'bg-red-500/20 text-red-600' };
      case 'idle':
        return { label: 'Completed', color: 'bg-muted text-muted-foreground' };
      default:
        return { label: '', color: '' };
    }
  };

  const badge = getStatusBadge();

  return (
    <div
      className={`border-b border-border px-4 py-3 ${
        speedMode ? 'border-orange-500/30 bg-orange-500/5' : ''
      }`}
    >
      {/* Top row: title + status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Agent Loop</span>
          {speedMode && (
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-500">
              ⚡ SPEED
            </span>
          )}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {/* Metrics row */}
      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
        {/* Round count */}
        <span className="flex items-center gap-1">
          <span className="opacity-60">🔄</span>
          <span>{currentRound} rounds</span>
          {breakpointRound && (
            <span className="text-orange-500" title={`断点: 第 ${breakpointRound} 轮`}>
              ⏸{breakpointRound}
            </span>
          )}
        </span>

        {/* Divider */}
        <span className="text-border">·</span>

        {/* Tool calls */}
        <span className="flex items-center gap-1">
          <span className="opacity-60">🔧</span>
          <span>{totalToolCalls} calls</span>
          {totalToolCalls > 0 && successRate < 100 && (
            <span className={successRate > 80 ? 'text-yellow-600' : 'text-destructive'}>
              ({successRate}%)
            </span>
          )}
        </span>

        {/* Divider */}
        <span className="text-border">·</span>

        {/* Elapsed time */}
        {isActive && (
          <>
            <span className="flex items-center gap-1">
              <span className="opacity-60">⏱</span>
              <span>{formatElapsed(elapsed)}</span>
            </span>
            <span className="text-border">·</span>
          </>
        )}

        {/* Token estimation */}
        <span className="flex items-center gap-1">
          <span className="opacity-60">📊</span>
          <span>{formatTokenCount(tokenEstimation)}</span>
        </span>
      </div>
    </div>
  );
};
