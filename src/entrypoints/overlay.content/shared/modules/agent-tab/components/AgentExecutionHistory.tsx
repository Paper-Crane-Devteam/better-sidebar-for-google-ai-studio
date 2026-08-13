/**
 * AgentExecutionHistory — compact step list for the current session.
 *
 * Shows the AI's own wording for each step ("Create folder Coding") and keeps
 * the tool name as secondary detail. Newest first; the raw result is available
 * on expand for debugging.
 */

import React, { useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import type { ToolCallResult } from '../../agent-loop/types';

const MAX_ITEMS = 50;
const MAX_DETAIL_CHARS = 500;

function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

interface HistoryItemProps {
  result: ToolCallResult & { round: number };
  isExpanded: boolean;
  onToggle: () => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ result, isExpanded, onToggle }) => {
  // Fall back to the tool name only when the AI gave no description
  const label = result.description?.trim() || result.toolName;
  const showToolName = label !== result.toolName;

  return (
    <div className="overflow-hidden rounded-md border border-border/40">
      <button
        className="flex w-full items-start gap-2 px-2 py-1 text-left transition-colors hover:bg-accent/30"
        onClick={onToggle}
      >
        {result.success ? (
          <CheckCircle2 className="mt-1 h-3 w-3 shrink-0 text-green-500" />
        ) : (
          <XCircle className="mt-1 h-3 w-3 shrink-0 text-red-500" />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-foreground">{label}</span>
          {showToolName && (
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {result.toolName}
            </span>
          )}
        </span>

        <span className="mt-1 shrink-0 text-xs text-muted-foreground">
          {relativeTime(result.timestamp)}
        </span>

        {isExpanded ? (
          <ChevronDown className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="bg-muted/40 px-2 py-1">
          <pre className="max-h-[120px] overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">
            {result.result.length > MAX_DETAIL_CHARS
              ? result.result.slice(0, MAX_DETAIL_CHARS) + '...'
              : result.result}
          </pre>
        </div>
      )}
    </div>
  );
};

export const AgentExecutionHistory: React.FC = () => {
  const { t } = useI18n();
  const currentResults = useAgentLoopStore((s) => s.currentResults);
  const history = useAgentLoopStore((s) => s.history);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const allResults = [
    ...currentResults.map((r) => ({ ...r, round: currentRound })),
    ...history.flatMap((h) => h.results.map((r) => ({ ...r, round: h.round }))),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ITEMS);

  if (allResults.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('agent.history.title', { defaultValue: 'Steps' })}
        </span>
        <span className="text-xs text-muted-foreground">{allResults.length}</span>
      </div>

      <div className="space-y-1">
        {allResults.map((result, i) => {
          const key = `${result.timestamp}-${i}`;
          return (
            <HistoryItem
              key={key}
              result={result}
              isExpanded={expandedKey === key}
              onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
            />
          );
        })}
      </div>
    </div>
  );
};
