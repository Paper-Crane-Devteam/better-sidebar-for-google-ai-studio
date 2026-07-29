import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';

// ── Types ────────────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  /** Section title displayed in the header */
  title: string;
  /** Whether the section is expanded (controlled) */
  isExpanded: boolean;
  /** Toggle expand/collapse */
  onToggle: () => void;
  /** Action buttons shown on the right side of the header on hover */
  actions?: React.ReactNode;
  /** Section body content */
  children: React.ReactNode;
  /** Additional className for the outermost container */
  className?: string;
  /** Override the content wrapper className (default: "flex-1 min-h-0 overflow-hidden") */
  contentClassName?: string;

  // ── Resize support (optional) ──────────────────────────────────────

  /** Enable vertical resize via top-edge drag handle */
  resizable?: boolean;
  /** Current height in pixels (controlled, required when resizable) */
  height?: number;
  /** Callback when height changes via drag (required when resizable) */
  onHeightChange?: (height: number) => void;
  /** Minimum height in pixels (default 80) */
  minHeight?: number;
  /** Maximum height ratio of parent (default 0.75) */
  maxHeightRatio?: number;

  // ── Layout ─────────────────────────────────────────────────────────

  /** When true, the section fills all remaining vertical space instead of using a fixed height */
  fillAvailable?: boolean;

  // ── Hover scope ────────────────────────────────────────────────────

  /**
   * Custom className for the actions container to control visibility.
   * When set, this replaces the default internal hover-based opacity logic.
   * Use Tailwind group-hover classes like "opacity-0 group-hover/chats:opacity-100"
   * when actions should respond to a parent group hover instead of self hover.
   */
  actionsVisibilityClass?: string;
}

const DEFAULT_MIN_HEIGHT = 80;
const DEFAULT_MAX_HEIGHT_RATIO = 0.75;

/**
 * A reusable collapsible section with:
 * - Chevron toggle header
 * - Hover-to-show action buttons on the header row
 * - Optional top-edge resize handle
 * - Smooth expand/collapse behavior
 *
 * Usage:
 * ```tsx
 * <CollapsibleSection
 *   title="Outline"
 *   isExpanded={expanded}
 *   onToggle={() => setExpanded(!expanded)}
 *   actions={<>...buttons...</>}
 *   resizable
 *   height={sectionHeight}
 *   onHeightChange={setSectionHeight}
 * >
 *   <MyContent />
 * </CollapsibleSection>
 * ```
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isExpanded,
  onToggle,
  actions,
  children,
  className,
  contentClassName,
  resizable = false,
  height,
  onHeightChange,
  minHeight = DEFAULT_MIN_HEIGHT,
  maxHeightRatio = DEFAULT_MAX_HEIGHT_RATIO,
  fillAvailable = false,
  actionsVisibilityClass,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragDataRef = useRef({ startY: 0, startHeight: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const maxHeightRef = useRef(600);

  // Calculate max height on mount and window resize
  useEffect(() => {
    if (!resizable) return;
    const updateMaxHeight = () => {
      const parentHeight = containerRef.current?.parentElement?.clientHeight ?? 800;
      maxHeightRef.current = Math.floor(parentHeight * maxHeightRatio);
    };
    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    return () => window.removeEventListener('resize', updateMaxHeight);
  }, [resizable, maxHeightRatio]);

  // ── Resize handlers ────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!resizable || !height || !onHeightChange) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragDataRef.current = { startY: e.clientY, startHeight: height };
    },
    [resizable, height, onHeightChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !onHeightChange) return;
      const delta = dragDataRef.current.startY - e.clientY;
      const newHeight = Math.min(
        maxHeightRef.current,
        Math.max(minHeight, dragDataRef.current.startHeight + delta),
      );
      onHeightChange(newHeight);
    },
    [isDragging, onHeightChange, minHeight],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsDragging(false);
    },
    [isDragging],
  );

  // ── Compute container style ────────────────────────────────────────

  const containerStyle: React.CSSProperties | undefined =
    isExpanded && resizable && !fillAvailable && height
      ? { height }
      : undefined;

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col relative',
        fillAvailable
          ? 'flex-1 min-h-0'
          : isExpanded && resizable
            ? 'min-h-0'   // allow shrink when expanded with fixed height
            : 'shrink-0', // don't shrink when collapsed (header only)
        className,
      )}
      style={containerStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Resize handle — absolute positioned over the top border */}
      {resizable && isExpanded && (
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-[6px] -translate-y-1/2 cursor-ns-resize z-10',
            'before:absolute before:inset-x-0 before:top-1/2 before:h-[2px] before:-translate-y-1/2',
            'before:transition-colors before:duration-150',
            isDragging ? 'before:bg-primary' : 'hover:before:bg-primary/60',
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none' }}
        />
      )}

      {/* Header row */}
      <div
        className={cn(
          'flex items-center h-7 px-3 select-none bg-muted/30',
          'hover:bg-accent/50 cursor-pointer',
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

        {/* Action buttons — visible on hover */}
        {actions && isExpanded && (
          <div
            className={cn(
              'flex items-center gap-0 transition-opacity',
              actionsVisibilityClass
                ? actionsVisibilityClass
                : isHovered ? 'opacity-100' : 'opacity-0',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div className={contentClassName ?? 'flex-1 min-h-0 overflow-hidden'}>
          {children}
        </div>
      )}

      {/* Full-screen overlay during drag to prevent hover on other elements */}
      {isDragging && (
        <div className="fixed inset-0 z-[9999] cursor-ns-resize" style={{ pointerEvents: 'auto' }} />
      )}
    </div>
  );
};
