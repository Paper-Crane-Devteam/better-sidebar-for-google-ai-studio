/**
 * StreamingToolWidget — React component rendered inside Shadow DOM
 * while a tool call is being streamed (aria-busy="true").
 */

import React from 'react';
import { Loader2, Settings, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import { getToolLabel } from '../../tool-labels';

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
  const { t } = useI18n();

  return (
    <div className="my-2 overflow-hidden rounded-lg bg-warning/10 transition-all duration-300">
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        {!isComplete && (
          <Loader2 className="h-3 w-3 animate-spin text-warning" />
        )}
        <span className="flex h-5 w-5 items-center justify-center rounded bg-warning/10 text-warning">
          <Settings className="h-3 w-3" />
        </span>
        {/* Matches the settled card: a label a non-developer can read, not the
            snake_case tool name. There's no description to use yet — the model is
            still writing the call out. */}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-warning">
          {toolName ? getToolLabel(toolName, t) : '…'}
        </span>
        <span className={`ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] ${isComplete ? 'text-success' : 'text-warning'}`}>
          {isComplete ? (
            <>
              <CheckCircle2 className="h-3 w-3" />{' '}
              {t('agent.tool.streamDone', { defaultValue: 'Ready' })}
            </>
          ) : (
            t('agent.tool.streaming', { defaultValue: 'Writing it out...' })
          )}
        </span>
      </div>
      {preview && (
        <div className="border-t border-warning/15 px-3 py-1.5 text-[11px] text-muted-foreground font-mono whitespace-pre-wrap max-h-[80px] overflow-hidden opacity-70">
          {preview}
        </div>
      )}
    </div>
  );
};
