/**
 * StreamingToolWidget — React component rendered inside Shadow DOM
 * while a tool call is being streamed (aria-busy="true").
 */

import React from 'react';
import { Loader2, Settings, CheckCircle2 } from 'lucide-react';

interface StreamingToolWidgetProps {
  toolName: string;
  preview: string;
  isComplete: boolean;
}

export const StreamingToolWidget: React.FC<StreamingToolWidgetProps> = ({
  toolName,
  preview,
  isComplete,
}) => {
  return (
    <div className="my-2 overflow-hidden rounded-lg bg-amber-500/10 transition-all duration-300">
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        {!isComplete && (
          <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
        )}
        <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Settings className="h-3 w-3" />
        </span>
        <span className="font-mono font-medium text-amber-700 dark:text-amber-300 text-xs">
          {toolName || '…'}
        </span>
        <span className={`ml-auto inline-flex items-center gap-1 text-[11px] ${isComplete ? 'text-emerald-500' : 'text-amber-500'}`}>
          {isComplete ? (
            <><CheckCircle2 className="h-3 w-3" /> 完成</>
          ) : (
            '流式生成中...'
          )}
        </span>
      </div>
      {preview && (
        <div className="border-t border-amber-500/15 px-3 py-1.5 text-[11px] text-muted-foreground font-mono whitespace-pre-wrap max-h-[80px] overflow-hidden opacity-70">
          {preview}
        </div>
      )}
    </div>
  );
};
