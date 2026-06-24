/**
 * PromptWidget — React component rendered inside Shadow DOM
 * for user-query elements containing agent prompt markers or tool results.
 */

import React, { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { Zap, ClipboardList, ChevronRight, ChevronDown } from 'lucide-react';

interface PromptWidgetProps {
  type: 'prompt' | 'result';
  title: string;
  rawText: string;
}

export const PromptWidget: React.FC<PromptWidgetProps> = ({
  type,
  title,
  rawText,
}) => {
  const [expanded, setExpanded] = useState(false);

  const isPrompt = type === 'prompt';
  const Icon = isPrompt ? Zap : ClipboardList;

  return (
    <div className="flex flex-col gap-1 my-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
            isPrompt
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{title}</span>
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
          aria-label="Toggle"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>
      {expanded && (
        <div className="mt-1 max-h-[250px] overflow-y-auto rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono">
          {rawText}
        </div>
      )}
    </div>
  );
};
