/**
 * AgentCommandPopup — Shows the agent entry list when `>` is typed.
 * First item is the "auto" agent, the rest are enabled skills.
 */

import React from 'react';
import { Bot } from 'lucide-react';
import type { AgentEntry } from './agent-entry';
import { AGENT_AUTO_ID } from './agent-entry';
import { PopupFooterHints } from '@/entrypoints/overlay.content/shared/features/trigger-popup';

interface AgentCommandPopupProps {
  matches: AgentEntry[];
  selectedIndex: number;
  onHighlight: (index: number) => void;
  onConfirm: (index: number) => void;
  position: { bottom: number; left: number };
  query: string;
}

export const AgentCommandPopup: React.FC<AgentCommandPopupProps> = ({
  matches,
  selectedIndex,
  onHighlight,
  onConfirm,
  position,
  query,
}) => {
  if (matches.length === 0) return null;

  return (
    <div
      className="fixed z-[99999] max-w-[360px] min-w-[280px] overflow-hidden rounded-lg bg-popover shadow-lg"
      style={{
        bottom: `${position.bottom}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">Agent</span>
        {query && (
          <span className="rounded bg-muted px-1 py-1 text-xs text-muted-foreground">{query}</span>
        )}
      </div>

      {/* Items */}
      <div className="max-h-[320px] overflow-y-auto py-1">
        {matches.map((entry, index) => {
          const isAuto = entry.id === AGENT_AUTO_ID;
          return (
            <div
              key={entry.id}
              className={`flex cursor-pointer items-start gap-3 px-3 py-2 transition-colors ${
                index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
              onMouseEnter={() => onHighlight(index)}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                onConfirm(index);
              }}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs text-primary">
                {isAuto ? <Bot className="h-4 w-4" /> : '>'}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="truncate text-sm font-medium text-foreground">{entry.title}</div>
                <div className="truncate text-xs text-muted-foreground">{entry.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <PopupFooterHints />
    </div>
  );
};
