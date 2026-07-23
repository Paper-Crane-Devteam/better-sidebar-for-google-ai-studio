/**
 * AgentExecutionHistory — Scrollable list of tool execution results.
 * Shows all rounds, newest first.
 */

import React, { useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import type { ToolCallResult } from '../../agent-loop/types';

function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

interface HistoryItemProps {
  result: ToolCallResult & { round: number };
  isExpanded: boolean;
  onToggle: () => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ result, isExpanded, onToggle }) => (
  <div className="border border-border/40 rounded-md overflow-hidden">
    <button
      className="flex items-center gap-2 w-full px-2 py-1 text-left hover:bg-accent/30 transition-colors"
      onClick={onToggle}
    >
      {/* Status icon */}
      {result.success ? (
        <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
      ) : (
        <XCircle className="h-3 w-3 shrink-0 text-red-500" />
      )}

      {/* Tool name + time */}
      <span className="flex-1 text-[10px] font-medium text-foreground truncate">
        {result.toolName}
      </span>
      <span className="text-[9px] text-muted-foreground shrink-0">
        {relativeTime(result.timestamp)}
      </span>

      {/* Expand chevron */}
      {isExpanded ? (
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
    </button>

    {/* Expanded detail */}
    {isExpanded && (
      <div className="px-2 py-1 border-t border-border/30 bg-muted/30">
        <pre className="text-[9px] text-muted-foreground whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto font-mono">
          {result.result.length > 500 ? result.result.slice(0, 500) + '...' : result.result}
        </pre>
      </div>
    )}
  </div>
);

export const AgentExecutionHistory: React.FC = () => {
  const currentResults = useAgentLoopStore((s) => s.currentResults);
  const history = useAgentLoopStore((s) => s.history);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Flatten all results, newest first
  const allResults = [
    ...currentResults.map((r) => ({ ...r, round: currentRound })),
    ...history.flatMap((h) => h.results.map((r) => ({ ...r, round: h.round }))),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);

  if (allResults.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          History
        </span>
        <span className="text-[9px] text-muted-foreground">{allResults.length} executions</span>
      </div>

      <div className="space-y-1">
        {allResults.map((result, i) => (
          <HistoryItem
            key={`${result.timestamp}-${i}`}
            result={result}
            isExpanded={expandedIdx === i}
            onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
          />
        ))}
      </div>
    </div>
  );
};
