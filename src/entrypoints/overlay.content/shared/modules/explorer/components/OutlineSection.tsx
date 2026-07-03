import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SectionHeader } from './SectionHeader';
import { useI18n } from '@/shared/hooks/useI18n';
import { cn } from '@/shared/lib/utils/utils';
import { OutlineContent } from './outline/OutlineContent';
import { useSettingsStore } from '@/shared/lib/settings-store';

const MIN_HEIGHT = 80;
const MAX_HEIGHT_RATIO = 0.75; // 75% of container height

/**
 * Collapsible outline section at the bottom of the Explorer.
 * The section height is resizable via a drag handle on the top edge,
 * and the height is persisted in the settings store.
 */
export const OutlineSection = () => {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const { outlineHeight, setOutlineHeight } = useSettingsStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragDataRef = useRef({ startY: 0, startHeight: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const maxHeightRef = useRef(600);

  // Calculate max height on mount and window resize
  useEffect(() => {
    const updateMaxHeight = () => {
      const parentHeight = containerRef.current?.parentElement?.clientHeight ?? 800;
      maxHeightRef.current = Math.floor(parentHeight * MAX_HEIGHT_RATIO);
    };
    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    return () => window.removeEventListener('resize', updateMaxHeight);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragDataRef.current = { startY: e.clientY, startHeight: outlineHeight };
    },
    [outlineHeight],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const delta = dragDataRef.current.startY - e.clientY;
      const newHeight = Math.min(
        maxHeightRef.current,
        Math.max(MIN_HEIGHT, dragDataRef.current.startHeight + delta),
      );
      setOutlineHeight(newHeight);
    },
    [isDragging, setOutlineHeight],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsDragging(false);
    },
    [isDragging],
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col shrink-0 relative"
      style={isExpanded ? { height: outlineHeight } : undefined}
    >
      {/* Resize handle — absolute positioned over the top border, no layout space */}
      {isExpanded && (
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

      <SectionHeader
        title={t('outline.title')}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />

      {isExpanded && (
        <div className="flex-1 overflow-hidden">
          <OutlineContent />
        </div>
      )}

      {/* Full-screen overlay during drag to prevent hover on other elements */}
      {isDragging && (
        <div className="fixed inset-0 z-[9999] cursor-ns-resize" style={{ pointerEvents: 'auto' }} />
      )}
    </div>
  );
};
