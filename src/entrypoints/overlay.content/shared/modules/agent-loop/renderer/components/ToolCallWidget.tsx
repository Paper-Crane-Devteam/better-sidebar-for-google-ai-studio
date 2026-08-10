/**
 * ToolCallWidget — one card per tool call detected in a model response.
 *
 * The card is where you approve. When the engine reaches a call that needs the
 * user's go-ahead it parks and publishes the call's fingerprint; the matching card
 * lights up with the buttons, and answering resolves the engine's wait.
 *
 * It used to be the other way round: this button ran the tool *itself*, appended the
 * result to the composer, and left the user to send it — a second execution path
 * alongside the engine's. Keeping the two from colliding required a ledger of
 * executed fingerprints, a disabled state whenever the engine was busy, and there
 * was still a check-then-act race, because the engine only claimed a fingerprint
 * after finishing. One path removes all of it.
 *
 * Every other card is read-only: what the AI asked for, and what became of it.
 */

import React, { useMemo, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import {
  Settings,
  Play,
  Loader2,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  FastForward,
  Ban,
} from 'lucide-react';
import type { ParsedToolCall } from '../../types';
import { parseToolCallFromText, extractToolInfo } from '../helpers/tool-parser';
import { useAgentLoopStore } from '../../agent-loop-store';
import { buildToolCallFingerprint, isControlTool } from '../../execution-policy';

interface ToolCallWidgetProps {
  toolName?: string;
  description?: string;
  query?: string;
  rawText: string;
  /** Only the newest model turn can hold a call the engine is still waiting on */
  isLatestResponse?: boolean;
  parseToolCall?: (text: string) => ParsedToolCall | null;
}

export const ToolCallWidget: React.FC<ToolCallWidgetProps> = ({
  toolName: propToolName,
  description: propDescription,
  query: propQuery,
  rawText,
  isLatestResponse = false,
  parseToolCall = parseToolCallFromText,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const info = extractToolInfo(rawText);
  const toolName = propToolName || info.toolName;
  const description = propDescription || info.description;
  const query = propQuery || info.query;

  const parsed = useMemo(() => parseToolCall(rawText), [rawText, parseToolCall]);
  const fingerprint = useMemo(
    () => (parsed ? buildToolCallFingerprint(parsed) : null),
    [parsed],
  );

  const executedCall = useAgentLoopStore((s) =>
    fingerprint ? s.executedCalls[fingerprint] : undefined,
  );
  const pendingApproval = useAgentLoopStore((s) => s.pendingApproval);
  const currentTool = useAgentLoopStore((s) => s.currentTool);

  // Control tools never take an approval: `complete_task` just ends the session, so
  // there is nothing to allow or refuse. The policy agrees — `requiresApproval` is
  // false for them — so this is belt-and-braces, not the enforcement point.
  const engineOnly = isControlTool(toolName);
  const isPending =
    !engineOnly &&
    isLatestResponse &&
    fingerprint !== null &&
    pendingApproval?.fingerprint === fingerprint;

  const running = !executedCall && currentTool === toolName && isLatestResponse;

  const decide = (approved: boolean, scope: 'once' | 'round' | 'task' = 'once') => {
    if (!pendingApproval) return;
    pendingApproval.resolve({
      approved,
      scope,
      reason: approved ? undefined : reason.trim() || undefined,
    });
    setRejecting(false);
    setReason('');
  };

  const previewText = query ? (query.length > 80 ? query.slice(0, 80) + '…' : query) : '';

  const renderStatus = () => {
    if (engineOnly) {
      return (
        <span className="ml-auto shrink-0 px-2 py-1 text-xs text-muted-foreground">任务结束</span>
      );
    }

    if (isPending) {
      return (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
          等待批准
        </span>
      );
    }

    if (running) {
      return (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> 执行中
        </span>
      );
    }

    if (!executedCall) {
      return (
        <span className="ml-auto shrink-0 px-2 py-1 text-xs text-muted-foreground">未执行</span>
      );
    }

    if (executedCall.rejected) {
      return (
        <span
          className="ml-auto inline-flex shrink-0 items-center gap-1 px-2 py-1 text-xs text-muted-foreground"
          title="你拒绝了这个操作"
        >
          <Ban className="h-3 w-3" /> 已拒绝
        </span>
      );
    }

    return (
      <span className="ml-auto inline-flex shrink-0 items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
        {executedCall.success ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> 已执行
          </>
        ) : (
          <>
            <XCircle className="h-3 w-3 text-destructive" /> 执行失败
          </>
        )}
      </span>
    );
  };

  return (
    <div
      className={cn(
        'my-2 overflow-hidden rounded-lg border text-foreground shadow-sm transition-colors',
        isPending
          ? 'border-amber-500/50 bg-amber-500/10 dark:bg-amber-950/20'
          : 'border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20',
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs transition-colors',
          isPending ? 'hover:bg-amber-500/15' : 'hover:bg-emerald-500/15',
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded',
            isPending
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
          )}
        >
          <Settings className="h-4 w-4" />
        </span>
        <span
          className={cn(
            'font-mono text-xs font-semibold',
            isPending
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-emerald-700 dark:text-emerald-300',
          )}
        >
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

        {renderStatus()}

        <span className="ml-1 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </div>

      {/* Approval — the full text is shown unfolded, since you're being asked to
          judge it and a collapsed preview isn't enough to judge anything. */}
      {isPending && (
        <div className="space-y-2 border-t border-amber-500/25 bg-background/60 px-3 py-2">
          <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground">
            {query || rawText}
          </pre>

          {rejecting ? (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                placeholder="哪里不对？（可留空）"
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    decide(false);
                  }
                }}
                className="w-full resize-none rounded-md border border-border/50 bg-background px-2 py-1
                           text-xs text-foreground placeholder:text-muted-foreground
                           focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  返回
                </button>
                <button
                  type="button"
                  onClick={() => decide(false)}
                  className="rounded border border-destructive/40 bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive"
                >
                  拒绝
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => decide(true)}
                className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/30 dark:text-emerald-300"
              >
                <Play className="h-3 w-3" /> 执行
              </button>
              {/* Only when there is actually a rest to approve */}
              {(pendingApproval?.remaining ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => decide(true, 'round')}
                  className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-xs text-foreground hover:bg-muted/60"
                >
                  <FastForward className="h-3 w-3" />
                  本轮全部执行（还有 {pendingApproval?.remaining}）
                </button>
              )}
              <button
                type="button"
                onClick={() => setRejecting(true)}
                className="ml-auto rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                拒绝
              </button>
            </div>
          )}
        </div>
      )}

      {/* Body (collapsible) */}
      {expanded && !isPending && (
        <div className="max-h-[300px] overflow-y-auto border-t border-emerald-500/20 bg-background/50 px-3 py-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
          {rawText}
        </div>
      )}
    </div>
  );
};
