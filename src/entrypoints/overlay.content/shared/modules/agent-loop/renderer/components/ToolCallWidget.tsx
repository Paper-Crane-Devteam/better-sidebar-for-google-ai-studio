/**
 * ToolCallWidget — one card per tool call detected in a model response.
 *
 * Two rules decide whether the Run button is offered, because the engine also
 * executes these same calls automatically:
 *
 * 1. Position — only the latest model response is actionable. Older turns are
 *    settled history; re-running them would act on stale intent.
 * 2. Identity — a call already executed (by the engine or by an earlier click)
 *    is marked as done. Writes are then locked for good; reads can be repeated
 *    on purpose, since re-reading is harmless.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { cn } from '@/shared/lib/utils';
import {
  Settings,
  Play,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Lock,
  RotateCcw,
} from 'lucide-react';
import type { ParsedToolCall } from '../../types';
import { parseToolCallFromText, extractToolInfo } from '../helpers/tool-parser';
import { executeToolCallFn, fillResultToEditor as defaultFillResult } from '../helpers/tool-executor';
import { useAgentLoopStore } from '../../agent-loop-store';
import { buildToolCallFingerprint, isWriteOperation } from '../../execution-policy';

interface ToolCallWidgetProps {
  toolName?: string;
  description?: string;
  query?: string;
  rawText: string;
  /** Only the newest model response may run tools manually */
  isLatestResponse?: boolean;
  parseToolCall?: (text: string) => ParsedToolCall | null;
  executeToolCall?: (parsed: ParsedToolCall) => Promise<string>;
  fillResultToEditor?: (toolName: string, result: string) => void;
}

export const ToolCallWidget: React.FC<ToolCallWidgetProps> = ({
  toolName: propToolName,
  description: propDescription,
  query: propQuery,
  rawText,
  isLatestResponse = false,
  parseToolCall = parseToolCallFromText,
  executeToolCall = executeToolCallFn,
  fillResultToEditor = defaultFillResult,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = extractToolInfo(rawText);
  const toolName = propToolName || info.toolName;
  const description = propDescription || info.description;
  const query = propQuery || info.query;

  const parsed = useMemo(() => parseToolCall(rawText), [rawText, parseToolCall]);
  const fingerprint = useMemo(
    () => (parsed ? buildToolCallFingerprint(parsed) : null),
    [parsed],
  );
  const isWrite = parsed ? isWriteOperation(parsed) : false;

  const executedCall = useAgentLoopStore((s) =>
    fingerprint ? s.executedCalls[fingerprint] : undefined,
  );

  // While the engine is mid-flight it may be about to run this very call, and it
  // only claims the fingerprint after finishing — so a click here could double
  // fire. Manual runs are allowed only when the loop isn't driving.
  const engineBusy = useAgentLoopStore((s) =>
    ['waiting_ai', 'parsing', 'executing', 'sending'].includes(s.status),
  );

  const alreadyRan = Boolean(executedCall);
  // A finished write is final. Reads stay repeatable.
  const locked = alreadyRan && isWrite;
  const canRun = isLatestResponse && !locked && !executing && !engineBusy;

  const handleRun = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canRun) return;

      setError(null);
      setExecuting(true);

      try {
        if (!parsed) {
          setError('解析失败');
          setTimeout(() => setError(null), 1500);
          return;
        }

        const result = await executeToolCall(parsed);
        fillResultToEditor(parsed.description || parsed.name, result);
      } catch (err) {
        console.error('[ToolCallWidget] Execute error:', err);
        setError('执行失败');
        setTimeout(() => setError(null), 1500);
      } finally {
        setExecuting(false);
      }
    },
    [canRun, parsed, executeToolCall, fillResultToEditor],
  );

  const previewText = query ? (query.length > 80 ? query.slice(0, 80) + '…' : query) : '';

  const renderAction = () => {
    // History: no action, just whether it ran
    if (!isLatestResponse) {
      return (
        <span
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground"
          title="历史消息中的工具调用不可执行"
        >
          {alreadyRan ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> 已执行
            </>
          ) : (
            '未执行'
          )}
        </span>
      );
    }

    if (executing) {
      return (
        <span className="ml-auto inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-700 opacity-60 dark:text-emerald-300">
          <Loader2 className="h-3 w-3 animate-spin" /> 执行中...
        </span>
      );
    }

    if (locked) {
      return (
        <span
          className="ml-auto inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300"
          title="写操作已执行，不能重复执行"
        >
          <Lock className="h-3 w-3" /> 已执行
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={handleRun}
        disabled={!canRun}
        className={cn(
          'ml-auto inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs font-medium shadow-xs transition-all',
          error
            ? 'border-destructive/30 bg-destructive/15 text-destructive'
            : 'border-emerald-500/30 bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 dark:text-emerald-300',
          !canRun && 'cursor-not-allowed opacity-40 hover:bg-emerald-500/20',
        )}
        title={
          engineBusy
            ? 'Agent 正在执行，请稍候'
            : alreadyRan
              ? '该读操作已执行过，可再执行一次'
              : '手动执行此工具调用'
        }
      >
        {error ? (
          <>
            <AlertCircle className="h-3 w-3" /> {error}
          </>
        ) : alreadyRan ? (
          <>
            <RotateCcw className="h-3 w-3" /> 重新执行
          </>
        ) : (
          <>
            <Play className="h-3 w-3" /> 执行
          </>
        )}
      </button>
    );
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-foreground shadow-sm dark:bg-emerald-950/20">
      {/* Header */}
      <div
        className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-emerald-500/15"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <Settings className="h-4 w-4" />
        </span>
        <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {toolName}
        </span>
        {description && (
          <span className="ml-1 max-w-[280px] truncate text-xs text-muted-foreground">
            {description}
          </span>
        )}
        {!description && previewText && (
          <span className="ml-1 max-w-[240px] truncate font-mono text-xs text-muted-foreground">
            {previewText}
          </span>
        )}

        {renderAction()}

        <span className="ml-1 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </div>

      {/* Body (collapsible) */}
      {expanded && (
        <div className="max-h-[300px] overflow-y-auto border-t border-emerald-500/20 bg-background/50 px-3 py-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
          {rawText}
        </div>
      )}
    </div>
  );
};
