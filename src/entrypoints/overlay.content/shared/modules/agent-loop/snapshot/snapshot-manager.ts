/**
 * DB Snapshot Manager — Placeholder.
 * Will be implemented in Phase 2.
 *
 * Planned functionality:
 * - Create full DB snapshot (via db.dump()) before first write operation
 * - Store up to 10 snapshots in OPFS/IndexedDB
 * - Restore from snapshot (via importDB flow)
 * - Manage snapshot list in settings UI
 */

export interface Snapshot {
  id: string;
  createdAt: number;
  triggerReason: string;
  size: number;
}

export async function createSnapshot(_reason: string): Promise<boolean> {
  // TODO: Phase 2 implementation
  console.log('[AgentLoop] Snapshot creation skipped (not yet implemented)');
  return false;
}

export async function restoreSnapshot(_snapshotId: string): Promise<boolean> {
  // TODO: Phase 2 implementation
  console.log('[AgentLoop] Snapshot restore skipped (not yet implemented)');
  return false;
}

export async function listSnapshots(): Promise<Snapshot[]> {
  // TODO: Phase 2 implementation
  return [];
}

export async function deleteSnapshot(_snapshotId: string): Promise<boolean> {
  // TODO: Phase 2 implementation
  return false;
}
