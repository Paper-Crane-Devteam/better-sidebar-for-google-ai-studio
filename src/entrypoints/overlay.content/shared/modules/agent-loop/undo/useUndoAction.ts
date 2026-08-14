/**
 * `runUndoFlow` plus a pending flag, for components that render a button.
 */

import { useCallback, useState } from 'react';
import { runUndoFlow } from './undo-flow';

export function useUndoAction(): { undoing: boolean; runUndo: () => void } {
  const [undoing, setUndoing] = useState(false);

  const runUndo = useCallback(() => {
    setUndoing(true);
    // Fire-and-forget: the flow reports its own outcome through toasts, and awaiting
    // it here would only duplicate that. `finally` is the point — the flag has to
    // clear whether the user confirmed, declined, or the restore failed.
    void runUndoFlow().finally(() => setUndoing(false));
  }, []);

  return { undoing, runUndo };
}
