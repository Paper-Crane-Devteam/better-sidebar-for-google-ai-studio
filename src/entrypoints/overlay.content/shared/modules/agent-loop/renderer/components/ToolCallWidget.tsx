/**
 * ToolCallWidget — React component rendered inside Shadow DOM
 * for each detected <bs_agent_tool> block in model responses.
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/shared/lib/utils';
import { Settings, Play, Loader2, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import type { ParsedToolCall } from '../../types';

interface ToolCallWidgetProps {
  toolName: string;
  description?: string;
  query?: string;
  rawText: string;
  parseToolCall: (text: string) => ParsedToolCall | null;
  executeToolCall: (parsed: ParsedToolCall) => Promise<string>;
  fillResultToEditor: (toolName: string, result: string) => void;
}

export const ToolCallWidget: React.FC<ToolCallWidgetProps> = ({
  toolName,
  description,
  query,
  rawText,
  parseToolCall,
  executeToolCall,
  fillResultToEditor,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    setExecuting(true);

    try {
      const parsed = parseToolCall(rawText);
      if (!parsed) {
        setError('解析失败');
        setTimeout(() => setError(null), 1500);
        setExecuting(false);
        return;
      }

      const result = await executeToolCall(parsed);
      fillResultToEditor(parsed.name, result);
    } catch (err) {
      console.error('[ToolCallWidget] Execute error:', err);
      setError('执行失败');
      setTimeout(() => setError(null), 1500);
    } finally {
      setExecuting(false);
    }
  }, [rawText, parseToolCall, executeToolCall, fillResultToEditor]);

  const previewText = query
    ? query.length > 80 ? query.slice(0, 80) + '…' : query
    : '';

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/5">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer select-none hover:bg-emerald-500/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Settings className="h-3 w-3" />
        </span>
        <span className="font-mono font-medium text-emerald-700 dark:text-emerald-300 text-xs">
          {toolName}
        </span>
        {description && (
          <span className="ml-2 max-w-[300px] truncate text-muted-foreground text-[11px]">
            {description}
          </span>
        )}
        {!description && previewText && (
          <span className="ml-2 max-w-[240px] truncate text-muted-foreground font-mono text-[11px]">
            {previewText}
          </span>
        )}

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={executing}
          className={cn(
            'ml-auto inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer border',
            error
              ? 'bg-destructive/15 text-destructive border-destructive/30'
              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border-emerald-500/30',
            executing && 'opacity-60 cursor-wait',
          )}
          title="执行此工具调用"
        >
          {executing ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> 执行中...</>
          ) : error ? (
            <><AlertCircle className="h-3 w-3" /> {error}</>
          ) : (
            <><Play className="h-3 w-3" /> 执行</>
          )}
        </button>

        {/* Toggle icon */}
        <span className="text-muted-foreground ml-1">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
      </div>

      {/* Body (collapsible) */}
      {expanded && (
        <div className="border-t border-emerald-500/15 px-3 py-2 text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
          {rawText}
        </div>
      )}
    </div>
  );
};
