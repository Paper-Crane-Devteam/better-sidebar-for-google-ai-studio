/**
 * Agent undo — public API.
 *
 * One undo point per session, held in memory: snapshot the tables a session is
 * about to write, restore them on request. See snapshot-store.ts for why whole
 * tables rather than inverse statements.
 */

export {
  captureBeforeWrite,
  resetSnapshots,
  discardSnapshots,
  canUndo,
  undoBlockedReason,
  affectedTables,
  snapshotRowCount,
  wasUndone,
  subscribeUndoState,
} from './snapshot-store';

export { undoAgentWrites, describeUndo } from './restore';
export type { UndoResult } from './restore';

export { runUndoFlow } from './undo-flow';
export { useUndoAction } from './useUndoAction';
export { useUndoAvailable, useUndoBlockedReason, useUndoWasUndone } from './useUndoState';

export { KNOWN_TABLES, cascadeClosure } from './schema-map';
export { scanWriteTargets, splitStatements } from './sql-targets';
export type { WriteOperation, WriteTarget } from './sql-targets';
