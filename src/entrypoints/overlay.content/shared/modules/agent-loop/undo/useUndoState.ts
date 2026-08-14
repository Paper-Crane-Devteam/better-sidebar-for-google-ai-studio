/**
 * React bindings for the undo snapshot.
 *
 * The snapshot lives in a module variable rather than a store, because it holds
 * whole-table row arrays that nothing should be re-rendering on. These hooks expose
 * only the two scalars the UI needs, via `useSyncExternalStore`.
 *
 * Each hook returns a primitive on purpose — a getSnapshot that built a fresh array
 * (`affectedTables()`) would return a new reference every time and re-render forever.
 * Read that one imperatively, at click time.
 */

import { useSyncExternalStore } from 'react';
import { canUndo, undoBlockedReason, wasUndone, subscribeUndoState } from './snapshot-store';

export function useUndoAvailable(): boolean {
  return useSyncExternalStore(subscribeUndoState, canUndo, () => false);
}

export function useUndoBlockedReason(): string | null {
  return useSyncExternalStore(subscribeUndoState, undoBlockedReason, () => null);
}

/** True once this session's changes have been rolled back */
export function useUndoWasUndone(): boolean {
  return useSyncExternalStore(subscribeUndoState, wasUndone, () => false);
}
