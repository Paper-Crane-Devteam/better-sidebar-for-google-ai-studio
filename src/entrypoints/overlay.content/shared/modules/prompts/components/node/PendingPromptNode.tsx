import React, { useRef, useEffect } from 'react';
import { FilePlus } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';

interface PendingPromptNodeProps {
  style: React.CSSProperties;
  title: string;
  onTitleChange: (title: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export const PendingPromptNode = ({
  style,
  title,
  onTitleChange,
  onCommit,
  onCancel,
}: PendingPromptNodeProps) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const isReadyRef = useRef(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    const timer = setTimeout(() => {
      isReadyRef.current = true;
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleBlur = () => {
    if (!isReadyRef.current) {
      inputRef.current?.focus();
      return;
    }
    if (title.trim()) {
      onCommit();
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (title.trim()) {
        onCommit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div style={style} className="h-[calc(100%-2px)] w-[calc(100%-4px)] mx-auto mt-[1px]">
      <div className="flex items-center h-full px-1 pr-2 gap-1">
        {/* Left spacer (toggle area) */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0" />

        {/* Icon */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground">
          <FilePlus className="w-4 h-4" />
        </div>

        {/* Input */}
        <form
          className="flex-1 min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) onCommit();
          }}
        >
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={t('prompts.promptTitlePlaceholder')}
            maxLength={100}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full bg-background border border-primary rounded-sm h-6 px-1 text-sm outline-none shadow-sm placeholder:text-muted-foreground/50"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          />
        </form>
      </div>
    </div>
  );
};
