import React, { useRef, useCallback } from 'react';
import { ScrollText } from 'lucide-react';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useI18n } from '@/shared/hooks/useI18n';
import { Button } from '@/shared/components/ui/button';

interface SaveSnippetButtonProps {
  onSave: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onMouseDown: () => void;
  getLongPressActive: () => boolean;
}

export const SaveSnippetButton = ({
  onSave,
  onDragStart,
  onMouseDown,
  getLongPressActive,
}: SaveSnippetButtonProps) => {
  const { t } = useI18n();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didDragRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      didDragRef.current = false;
      onMouseDown();

      const mouseEvent = e;

      longPressTimerRef.current = setTimeout(() => {
        didDragRef.current = true;
        onDragStart(mouseEvent);
      }, 300);

      const handleUp = () => {
        document.removeEventListener('mouseup', handleUp, true);
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (!didDragRef.current) {
          onSave();
        }
      };
      document.addEventListener('mouseup', handleUp, true);
    },
    [onSave, onDragStart, onMouseDown],
  );

  return (
    <SimpleTooltip content={t('snippets.saveSnippetTooltip')} side="top">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 cursor-grab active:cursor-grabbing border-border/60 bg-background hover:bg-accent"
        onMouseDown={handleMouseDown}
      >
        <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </SimpleTooltip>
  );
};
