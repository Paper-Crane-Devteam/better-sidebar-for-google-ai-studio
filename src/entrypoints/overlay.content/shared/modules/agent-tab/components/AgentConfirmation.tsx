/**
 * AgentConfirmation — Inline write operation confirmation.
 * Shown when the engine has a pending write confirmation.
 */

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';

export const AgentConfirmation: React.FC = () => {
  const pendingConfirmation = useAgentLoopStore((s) => s.pendingConfirmation);
  const [expanded, setExpanded] = useState(false);

  if (!pendingConfirmation) return null;

  const sql = pendingConfirmation.sql;
  const truncated = sql.length > 500 && !expanded;
  const displaySql = truncated ? sql.slice(0, 500) + '...' : sql;

  return (
    <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
        <span className="text-xs font-medium text-foreground">Write Confirmation</span>
      </div>

      {/* SQL preview */}
      <div className="max-h-[160px] overflow-auto rounded border border-border/50 bg-muted/40 p-2">
        <pre className="whitespace-pre-wrap text-[10px] font-mono text-foreground break-all">
          {displaySql}
        </pre>
      </div>

      {/* Show full button */}
      {truncated && (
        <button
          onClick={() => setExpanded(true)}
          className="text-[10px] text-primary hover:underline"
        >
          Show full query
        </button>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px]"
          onClick={() => pendingConfirmation.resolve(false)}
        >
          Reject
        </Button>
        <Button
          size="sm"
          className="h-6 text-[10px]"
          onClick={() => pendingConfirmation.resolve(true)}
        >
          Approve
        </Button>
      </div>
    </div>
  );
};
