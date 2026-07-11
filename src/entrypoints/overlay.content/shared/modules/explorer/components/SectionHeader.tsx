import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';

interface SectionHeaderProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * A collapsible section header matching the project's existing row styling.
 * Uses the same px-3, h-7 button sizing, and text-sm as other header rows.
 */
export const SectionHeader = ({
  title,
  isExpanded,
  onToggle,
  actions,
  className,
}: SectionHeaderProps) => {
  return (
    <div
      className={cn(
        'flex items-center h-7 px-3 select-none',
        'hover:bg-accent/50 cursor-pointer group',
        className,
      )}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={isExpanded}
    >
      {/* Chevron + title */}
      <div className="flex items-center flex-1 min-w-0 gap-1">
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
          {title}
        </span>
      </div>

      {/* Action buttons on the right: only visible on hover */}
      {actions && isExpanded && (
        <div
          className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
};
