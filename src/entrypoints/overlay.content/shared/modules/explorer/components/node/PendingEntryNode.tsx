import React, { useRef, useEffect } from 'react';
import { Pencil, X, Loader2, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { useExplorerContext } from '../../ExplorerContext';
import { useI18n } from '@/shared/hooks/useI18n';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import type { PendingNewChatPhase } from '../../hooks/usePendingNewChat';

interface PendingEntryNodeProps {
  style: React.CSSProperties;
  phase: PendingNewChatPhase;
  title: string;
  dragHandle?: (el: HTMLDivElement | null) => void;
}

export const PendingEntryNode = ({ style, phase, title, dragHandle }: PendingEntryNodeProps) => {
  const { t } = useI18n();
  const {
    updatePendingTitle,
    commitPendingEditing,
    startPendingEditing,
    removePendingEntry,
  } = useExplorerContext();

  const inputRef = useRef<HTMLInputElement>(null);
  const isReadyRef = useRef(false);

  // Auto-focus input when in editing phase
  useEffect(() => {
    if (phase === 'editing' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }

    // Prevent immediate blur
    const timer = setTimeout(() => {
      isReadyRef.current = true;
    }, 300);

    return () => clearTimeout(timer);
  }, [phase]);

  const handleBlur = () => {
    if (!isReadyRef.current) {
      inputRef.current?.focus();
      return;
    }
    commitPendingEditing?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop all key events from bubbling to react-arborist's typeahead search
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      commitPendingEditing?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      removePendingEntry?.();
    }
  };

  return (
    <div style={style} className="h-[calc(100%-2px)] w-[calc(100%-4px)] mx-auto mt-[1px]">
      <div
        ref={dragHandle}
        className={cn(
          'flex items-center h-full px-1 pr-2 gap-1.5',
          phase === 'editing' && '',
          phase === 'idle' && 'group relative cursor-grab bg-accent/40',
          phase === 'intercepted' && 'bg-accent/20',
        )}
      >
        {/* Left spacer (toggle area) */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0" />

        {/* Icon */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground">
          {phase === 'intercepted' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <MessageSquarePlus className="w-4 h-4" />
          )}
        </div>

        {/* Content area */}
        {phase === 'editing' && (
          <form
            className="flex-1 min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              commitPendingEditing?.();
            }}
          >
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={title}
              onChange={(e) => updatePendingTitle?.(e.target.value)}
              placeholder={t('pendingEntry.placeholder')}
              maxLength={60}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full bg-background border border-primary rounded-sm h-6 px-1 text-sm outline-none shadow-sm placeholder:text-muted-foreground/50"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            />
          </form>
        )}

        {phase === 'idle' && (
          <span className={cn(
            'flex-1 min-w-0 text-sm truncate select-none',
            title ? 'text-foreground/80' : 'text-muted-foreground',
          )}>
            {title || t('pendingEntry.waitingForChat')}
          </span>
        )}

        {phase === 'intercepted' && (
          title ? (
            <span className="flex-1 min-w-0 text-sm truncate select-none text-foreground/70">
              {title}
            </span>
          ) : (
            <div
              className="flex-1 h-3 rounded-full"
              style={{
                background: 'linear-gradient(90deg, rgb(var(--muted-foreground) / 0.1) 25%, rgb(var(--muted-foreground) / 0.05) 50%, rgb(var(--muted-foreground) / 0.1) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
          )
        )}

        {/* Action buttons for idle phase */}
        {phase === 'idle' && (
          <div className="invisible group-hover:visible flex items-center gap-1 absolute right-0 pr-2 top-0 bottom-0 bg-accent/40">
            <div className="absolute inset-y-0 -left-4 w-4 pointer-events-none [background:inherit] [mask-image:linear-gradient(to_right,transparent,black)]" />
            <SimpleTooltip content={t('node.rename')}>
              <div
                role="button"
                className="h-5 w-5 flex items-center justify-center rounded-sm cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  startPendingEditing?.();
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </div>
            </SimpleTooltip>
            <SimpleTooltip content={t('node.delete')}>
              <div
                role="button"
                className="h-5 w-5 flex items-center justify-center rounded-sm cursor-pointer text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  removePendingEntry?.();
                }}
              >
                <X className="h-3.5 w-3.5" />
              </div>
            </SimpleTooltip>
          </div>
        )}
      </div>
    </div>
  );
};
