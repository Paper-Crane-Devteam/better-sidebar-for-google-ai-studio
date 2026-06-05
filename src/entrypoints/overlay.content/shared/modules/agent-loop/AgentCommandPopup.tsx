/**
 * AgentCommandPopup — Shows the built-in prompt selection list when `>` is typed.
 * Similar to SlashCommandPopup but for Agent Loop built-in prompts.
 */

import React from 'react';
import type { BuiltInPrompt } from './types';

interface AgentCommandPopupProps {
  matches: BuiltInPrompt[];
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
      className="fixed z-[99999] max-w-[360px] min-w-[280px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
      style={{
        bottom: `${position.bottom}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Agent Commands</span>
        {query && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {query}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="max-h-[320px] overflow-y-auto py-1">
        {matches.map((prompt, index) => (
          <div
            key={prompt.id}
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
              &gt;
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium text-foreground">
                {prompt.title}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {prompt.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="border-t border-border px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">
          ↑↓ navigate · Enter select · Esc close
        </span>
      </div>
    </div>
  );
};
