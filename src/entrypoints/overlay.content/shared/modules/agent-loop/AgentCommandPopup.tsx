/**
 * AgentCommandPopup — Shows the agent entry list when `>` is typed.
 *
 * Layout: a tree-like hierarchy.
 * - "Better Sidebar Agent" (auto entry) is the root, always shown.
 * - Skills are its children, visually indented.
 *
 * Both levels are selectable; selecting the auto entry = let the agent decide.
 */

import React, { useRef } from 'react';
import { Bot } from 'lucide-react';
import { OverflowTooltip } from '@/shared/components/ui/overflow-tooltip';
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

interface AgentCommandItemProps {
  entry: AgentEntry;
  isSelected: boolean;
  isChild: boolean;
  onHighlight: () => void;
  onConfirm: () => void;
}

/**
 * One row. Auto entry renders at root level; skills are indented children.
 */
const AgentCommandItem: React.FC<AgentCommandItemProps> = ({
  entry,
  isSelected,
  isChild,
  onHighlight,
  onConfirm,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const isAuto = entry.id === AGENT_AUTO_ID;
  const hasDescription = !!entry.description;

  return (
    <div
      ref={rowRef}
      className={`flex cursor-pointer items-center gap-2 py-2 transition-colors ${
        isChild ? 'pl-8 pr-3' : 'px-3'
      } ${isSelected ? 'bg-accent' : 'hover:bg-accent/50'}`}
      onMouseEnter={onHighlight}
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent blur
        onConfirm();
      }}
    >
      {/* Icon */}
      {isAuto ? (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </div>
      ) : (
        <div className="flex h-4 w-4 shrink-0 items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        </div>
      )}

      {/* Title */}
      <div className="flex-1 overflow-hidden">
        <OverflowTooltip
          content={(isOverflowing) =>
            isOverflowing || !hasDescription ? (
              <div className="flex flex-col gap-1">
                <div className="font-medium">{entry.title}</div>
                {hasDescription && (
                  <div className="text-[10px] opacity-80">{entry.description}</div>
                )}
              </div>
            ) : (
              entry.description
            )
          }
          placement="right"
          offset={16}
          className={`select-none ${isAuto ? 'text-sm font-medium text-foreground' : 'text-xs text-foreground/90'}`}
          hoverRef={rowRef}
          positionRef={rowRef}
          forceShow={hasDescription}
        >
          {entry.title}
        </OverflowTooltip>
      </div>
    </div>
  );
};

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
      className="fixed z-[99999] max-w-[360px] min-w-[280px] overflow-hidden rounded-lg bg-popover shadow-[shadow:var(--shadow-popover)]"
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

      {/* Items — tree layout */}
      <div className="max-h-[320px] overflow-y-auto py-1">
        {matches.map((entry, index) => (
          <AgentCommandItem
            key={entry.id}
            entry={entry}
            isSelected={index === selectedIndex}
            isChild={entry.id !== AGENT_AUTO_ID}
            onHighlight={() => onHighlight(index)}
            onConfirm={() => onConfirm(index)}
          />
        ))}
      </div>

      {/* Footer hint */}
      <PopupFooterHints />
    </div>
  );
};
