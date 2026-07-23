/**
 * AgentActivationPopup — Shows the agent selection list when `!` is typed.
 * Currently only one agent (Better Sidebar), but designed for future expansion.
 */

import React from 'react';
import { Bot } from 'lucide-react';
import type { AgentDefinition } from './agents/types';
import { PopupFooterHints } from '@/entrypoints/overlay.content/shared/features/trigger-popup';

interface AgentActivationPopupProps {
  matches: AgentDefinition[];
  selectedIndex: number;
  onHighlight: (index: number) => void;
  onConfirm: (index: number) => void;
  position: { bottom: number; left: number };
  query: string;
}

export const AgentActivationPopup: React.FC<AgentActivationPopupProps> = ({
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
      className="fixed z-[99999] max-w-[360px] min-w-[280px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
      style={{
        bottom: `${position.bottom}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Bot className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">Activate Agent</span>
        {query && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {query}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="max-h-[320px] overflow-y-auto py-1">
        {matches.map((agent, index) => (
          <div
            key={agent.id}
            className={`flex cursor-pointer items-start gap-3 px-3 py-2 transition-colors ${
              index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
            }`}
            onMouseEnter={() => onHighlight(index)}
            onMouseDown={(e) => {
              e.preventDefault();
              onConfirm(index);
            }}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium text-foreground">{agent.name}</div>
              <div className="truncate text-xs text-muted-foreground">{agent.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <PopupFooterHints />
    </div>
  );
};
