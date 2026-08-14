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
import { useI18n } from '@/shared/hooks/useI18n';
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
import type { DerivedToolOutcome } from '../helpers/tool-outcomes';
import { useAgentLoopStore } from '../../agent-loop-store';
import { buildToolCallFingerprint, isControlTool } from '../../execution-policy';
import { getToolLabel } from '../../tool-labels';

interface ToolCallWidgetProps {
  toolName?: string;
  description?: string;
  query?: string;
  rawText: string;
  /** Only the newest model turn can hold a call the engine is still waiting on */
  isLatestResponse?: boolean;
  /**
   * What became of this call according to the conversation itself, for turns the
   * live session's ledger knows nothing about — anything from before a reload.
   */
  outcome?: DerivedToolOutcome | null;
  parseToolCall?: (text: string) => ParsedToolCall | null;
}

export const ToolCallWidget: React.FC<ToolCallWidgetProps> = ({
  toolName: propToolName,
  description: propDescription,
  query: propQuery,
  rawText,
  isLatestResponse = false,
  outcome = null,
  parseToolCall = parseToolCallFromText,
}) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  const info = extractToolInfo(rawText);
  const toolName = propToolName || info.toolName;
  const description = propDescription || info.description;
  const query = propQuery || info.query;

  /**
   * The card's headline. The AI's own description reads as an intent ("find chats
   * older than a year"); the tool name reads as an implementation detail, so it
   * only stands in when there's no description at all.
   */
  const summary = description || getToolLabel(toolName, t, query);

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

  /**
   * The ledger wins where it exists — it is first-hand and knows about calls whose
   * results never made it into a message. Everywhere else the conversation answers,
   * which is the only source left after a reload.
   */
  const status: { success: boolean; rejected: boolean } | null = executedCall
    ? { success: executedCall.success, rejected: Boolean(executedCall.rejected) }
    : outcome;

  // Control tools never take an approval: `complete_task` just ends the session, so
  // there is nothing to allow or refuse. The policy agrees — `requiresApproval` is
  // false for them — so this is belt-and-braces, not the enforcement point.
  const engineOnly = isControlTool(toolName);
  const isPending =
    !engineOnly &&
    isLatestResponse &&
    fingerprint !== null &&
    pendingApproval?.fingerprint === fingerprint;

  const running = !status && currentTool === toolName && isLatestResponse;

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

  const renderStatus = () => {
    if (engineOnly) {
      return (
        <span className="ml-auto shrink-0 px-2 py-1 text-xs text-muted-foreground">
          {t('agent.summary.done', { defaultValue: 'Task finished' })}
        </span>
      );
    }

    if (isPending) {
      return (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded bg-warning/20 px-2 py-1 text-xs font-medium text-warning">
          {t('agent.tool.waiting', { defaultValue: 'Waiting for you' })}
        </span>
      );
    }

    if (running) {
      return (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />{' '}
          {t('agent.tool.running', { defaultValue: 'Running' })}
        </span>
      );
    }

    if (!status) {
      return (
        <span className="ml-auto shrink-0 px-2 py-1 text-xs text-muted-foreground">
          {t('agent.tool.notRun', { defaultValue: 'Not run' })}
        </span>
      );
    }

    if (status.rejected) {
      return (
        <span
          className="ml-auto inline-flex shrink-0 items-center gap-1 px-2 py-1 text-xs text-muted-foreground"
          title={t('agent.tool.rejectedTitle', { defaultValue: 'You turned this one down' })}
        >
          <Ban className="h-3 w-3" /> {t('agent.tool.rejected', { defaultValue: 'Rejected' })}
        </span>
      );
    }

    return (
      <span className="ml-auto inline-flex shrink-0 items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
        {status.success ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-success" />{' '}
            {t('agent.tool.done', { defaultValue: 'Done' })}
          </>
        ) : (
          <>
            <XCircle className="h-3 w-3 text-destructive" />{' '}
            {t('agent.tool.failed', { defaultValue: 'Failed' })}
          </>
        )}
      </span>
    );
  };

  return (
    <div
      className={cn(
        'my-2 overflow-hidden rounded-lg text-foreground transition-colors',
        isPending ? 'bg-warning/10' : 'bg-success/10',
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs transition-colors',
          isPending ? 'hover:bg-warning/15' : 'hover:bg-success/15',
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded',
            isPending ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success',
          )}
        >
          <Settings className="h-4 w-4" />
        </span>
        {/* `min-w-0 flex-1` rather than a fixed max-width: the old cap ellipsised at
            280px no matter how much room was actually left on the row. */}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[13px] font-medium',
            isPending ? 'text-warning' : 'text-success',
          )}
          title={summary}
        >
          {summary}
        </span>

        {renderStatus()}

        <span className="ml-1 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </div>

      {/* Approval. The statement stays folded, matching AgentApproval in the dock:
          the headline above already says what this does in words, and SQL you can't
          read doesn't help you decide. One click away rather than gone, because a
          write you can't inspect is the worse failure. */}
      {isPending && (
        <div className="space-y-2 bg-background/60 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowDetail(!showDetail)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {showDetail
              ? t('agent.approve.hideDetail', { defaultValue: 'Hide what will run' })
              : t('agent.approve.showDetail', { defaultValue: 'Show what will run' })}
          </button>
          {showDetail && (
            <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded border border-border/50 bg-background/60 p-2 font-mono text-xs text-foreground">
              {query || rawText}
            </pre>
          )}

          {rejecting ? (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                placeholder={t('agent.approve.reasonPlaceholder', {
                  defaultValue: "What's wrong with it? (optional)",
                })}
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
                  {t('agent.approve.back', { defaultValue: 'Back' })}
                </button>
                <button
                  type="button"
                  onClick={() => decide(false)}
                  className="rounded bg-destructive/20 px-2 py-1 text-xs font-medium text-destructive"
                >
                  {t('agent.approve.reject', { defaultValue: 'Reject' })}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => decide(true)}
                className="inline-flex items-center gap-1 rounded bg-success/20 px-2 py-1 text-xs font-medium text-success hover:bg-success/30"
              >
                <Play className="h-3 w-3" /> {t('agent.approve.run', { defaultValue: 'Run' })}
              </button>
              {/* Only when there is actually a rest to approve */}
              {(pendingApproval?.remaining ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => decide(true, 'round')}
                  className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-xs text-foreground hover:bg-muted/60"
                >
                  <FastForward className="h-3 w-3" />
                  {t('agent.approve.runRest', {
                    defaultValue: 'Run these {{count}} too',
                    count: pendingApproval?.remaining ?? 0,
                  })}
                </button>
              )}
              <button
                type="button"
                onClick={() => setRejecting(true)}
                className="ml-auto rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {t('agent.approve.reject', { defaultValue: 'Reject' })}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Body (collapsible) — the call, and its output when the conversation still
          carries it. Reading an old session, "what did that query return" is the
          question the card is opened to answer. */}
      {expanded && !isPending && (
        <div className="max-h-[300px] overflow-y-auto bg-background/50 px-3 py-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
          {/* The tool name lives down here now — it's a detail for whoever opens the
              card, not the first thing everyone else has to read past. */}
          <div className="mb-1.5 font-sans text-[11px] uppercase tracking-wide text-muted-foreground/70">
            {t('agent.tool.nameLabel', { defaultValue: 'Action' })} · {toolName}
          </div>
          {rawText}
          {outcome?.content && (
            <>
              <div className="my-2 border-t border-border/40" />
              <span className="font-sans text-[11px] uppercase tracking-wide text-muted-foreground/70">
                {t('agent.tool.output', { defaultValue: 'Output' })}
              </span>
              <div className="mt-1">{outcome.content}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
