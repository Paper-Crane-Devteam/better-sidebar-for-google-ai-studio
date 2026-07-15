/**
 * ConfirmationSection — Inline write operation confirmation (replaces full-screen dialog).
 */

import React, { useState } from 'react';
import { useAgentLoopStore } from '../agent-loop-store';

export const ConfirmationSection: React.FC = () => {
  const pendingConfirmation = useAgentLoopStore((s) => s.pendingConfirmation);
  const [expanded, setExpanded] = useState(false);

  if (!pendingConfirmation) return null;

  const sql = pendingConfirmation.sql;
  const truncated = sql.length > 500 && !expanded;
  const displaySql = truncated ? sql.slice(0, 500) + '...' : sql;

  return (
    <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">⚠️</span>
        <span className="text-xs font-medium text-foreground">写操作确认</span>
      </div>
      <div className="max-h-[200px] overflow-auto rounded border border-border bg-muted/50 p-2">
        <pre className="whitespace-pre-wrap text-xs font-mono text-foreground">
          {displaySql}
        </pre>
      </div>
      {truncated && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-primary hover:underline"
        >
          查看完整内容
        </button>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => pendingConfirmation.resolve(false)}
          className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          Reject
        </button>
        <button
          onClick={() => pendingConfirmation.resolve(true)}
          className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          Approve
        </button>
      </div>
    </div>
  );
};
