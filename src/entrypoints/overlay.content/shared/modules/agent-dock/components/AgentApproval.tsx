/**
 * AgentApproval — the fallback place to approve a tool call.
 *
 * The primary place is the call's own card in the chat. This copy exists because
 * those cards only render in our own conversation view, and the user can switch back
 * to Gemini's native rendering mid-task — without a mirror here, the engine would be
 * parked with no reachable way to answer it. The two are kept deliberately alike,
 * down to folding the statement away, so answering from either reads the same.
 *
 * Same pending object, same resolve. Whichever is answered first wins.
 */

import React, { useState } from 'react';
import { AlertTriangle, FastForward, Play, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { getToolLabel } from '../../agent-loop/tool-labels';
import type { ApprovalScope } from '../../agent-loop/types';

export const AgentApproval: React.FC = () => {
  const { t } = useI18n();
  const pendingApproval = useAgentLoopStore((s) => s.pendingApproval);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  if (!pendingApproval) return null;

  const { toolName, description, params, risk, remaining, resolve } = pendingApproval;
  const isWrite = risk === 'write';
  const detail = params.query || params.summary || params.ids || '';
  /** What the AI said it's doing, falling back to a label when it said nothing. */
  const summary = description || getToolLabel(toolName, t, params.query);

  const decide = (approved: boolean, scope: ApprovalScope = 'once') => {
    resolve({ approved, scope, reason: approved ? undefined : reason.trim() || undefined });
    setRejecting(false);
    setReason('');
  };

  return (
    <div
      className={cn(
        'space-y-2 rounded-md p-3',
        isWrite ? 'bg-orange-500/10' : 'bg-muted/40',
      )}
    >
      <div className="flex items-center gap-2">
        {isWrite ? (
          <AlertTriangle className="h-3 w-3 shrink-0 text-orange-500" />
        ) : (
          <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="text-xs font-medium text-muted-foreground">
          {isWrite
            ? t('agent.approve.writeTitle', { defaultValue: 'Approve this change?' })
            : t('agent.approve.readTitle', { defaultValue: 'Approve this query?' })}
        </span>
      </div>

      {/* What you're actually deciding on, in words. */}
      <p className="text-sm font-medium leading-relaxed text-foreground">{summary}</p>

      {/* The statement itself is folded away: it's SQL, and being shown SQL you can't
          read is no help in deciding. Still one click away, because a write you can't
          inspect is worse. */}
      {detail && (
        <div className="space-y-1.5">
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
            <div className="max-h-[160px] overflow-auto rounded border border-border/50 bg-background/60 p-2">
              <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
                {detail}
              </pre>
            </div>
          )}
        </div>
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
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => setRejecting(false)}
            >
              {t('agent.approve.back', { defaultValue: 'Back' })}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs"
              onClick={() => decide(false)}
            >
              {t('agent.approve.reject', { defaultValue: 'Reject' })}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-6 gap-1 text-xs" onClick={() => decide(true)}>
              <Play className="h-3 w-3" />
              {t('agent.approve.run', { defaultValue: 'Run' })}
            </Button>
            {remaining > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1 text-xs"
                onClick={() => decide(true, 'round')}
              >
                <FastForward className="h-3 w-3" />
                {t('agent.approve.runRest', {
                  defaultValue: 'Run these {{count}} too',
                  count: remaining,
                })}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-6 text-xs text-muted-foreground"
              onClick={() => setRejecting(true)}
            >
              {t('agent.approve.reject', { defaultValue: 'Reject' })}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => decide(true, 'task')}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t('agent.approve.allTask', { defaultValue: "Don't ask again for this task" })}
          </button>
        </div>
      )}
    </div>
  );
};
