/**
 * @deprecated Use `AgentLoopControlPanel` (control-panel/ConfirmationSection) instead.
 * This full-screen confirmation dialog is kept as a fallback but no longer rendered by default.
 *
 * AgentLoopConfirmDialog — Shows SQL write confirmation dialog.
 * Rendered when agent-loop-store.pendingConfirmation is non-null.
 */

import React from 'react';
import { useAgentLoopStore } from './agent-loop-store';

export const AgentLoopConfirmDialog: React.FC = () => {
  const pendingConfirmation = useAgentLoopStore((s) => s.pendingConfirmation);
  const setPendingConfirmation = useAgentLoopStore((s) => s.setPendingConfirmation);

  if (!pendingConfirmation) return null;

  const handleConfirm = () => {
    pendingConfirmation.resolve(true);
    setPendingConfirmation(null);
  };

  const handleCancel = () => {
    pendingConfirmation.resolve(false);
    setPendingConfirmation(null);
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50">
      <div className="mx-4 max-w-lg rounded-lg border border-border bg-popover p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/20">
            <span className="text-lg">⚠️</span>
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Confirm Database Write
          </h3>
        </div>

        {/* Description */}
        <p className="mb-3 text-sm text-muted-foreground">
          The AI wants to execute a write operation. Please review the SQL statement below:
        </p>

        {/* SQL preview */}
        <div className="mb-4 max-h-[200px] overflow-auto rounded-md border border-border bg-muted/50 p-3">
          <pre className="whitespace-pre-wrap text-xs text-foreground font-mono">
            {pendingConfirmation.sql}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Execute
          </button>
        </div>
      </div>
    </div>
  );
};
