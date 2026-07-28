/**
 * AgentConfirmation — Inline write confirmation.
 *
 * Leads with the AI's plain-language description of the change and keeps the
 * SQL collapsed, since most users can't judge a statement at a glance. The
 * third action ("Allow all in this task") is the write-policy switch surfaced
 * at the moment it actually matters.
 */

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';

export const AgentConfirmation: React.FC = () => {
  const { t } = useI18n();
  const pendingConfirmation = useAgentLoopStore((s) => s.pendingConfirmation);
  const currentResults = useAgentLoopStore((s) => s.currentResults);
  const setSpeedMode = useAgentLoopStore((s) => s.setSpeedMode);
  const [showSql, setShowSql] = useState(false);

  if (!pendingConfirmation) return null;

  const { sql, resolve } = pendingConfirmation;

  // Best-effort plain-language summary: the description the AI gave for its
  // most recent step is usually about the change it's asking to make.
  const lastDescription = [...currentResults].reverse().find((r) => r.description)?.description;

  const approveAll = () => {
    setSpeedMode(true);
    resolve(true);
  };

  return (
    <div className="space-y-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3 w-3 shrink-0 text-orange-500" />
        <span className="text-xs font-medium text-foreground">
          {t('agent.confirm.title', { defaultValue: 'Confirm changes' })}
        </span>
      </div>

      {lastDescription && (
        <p className="text-xs leading-relaxed text-foreground">{lastDescription}</p>
      )}

      <button
        type="button"
        onClick={() => setShowSql((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {showSql ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {t('agent.confirm.showFull', { defaultValue: 'Show full query' })}
      </button>

      {showSql && (
        <div className="max-h-[160px] overflow-auto rounded border border-border/50 bg-muted/40 p-2">
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
            {sql}
          </pre>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs"
          onClick={() => resolve(false)}
        >
          {t('agent.confirm.reject', { defaultValue: 'Reject' })}
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={approveAll}>
          {t('agent.confirm.approveAll', { defaultValue: 'Allow all in this task' })}
        </Button>
        <Button size="sm" className="h-6 text-xs" onClick={() => resolve(true)}>
          {t('agent.confirm.approve', { defaultValue: 'Approve' })}
        </Button>
      </div>
    </div>
  );
};
