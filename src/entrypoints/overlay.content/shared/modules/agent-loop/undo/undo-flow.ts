/**
 * The undo interaction, in one place.
 *
 * Three entry points offer it — the marker in the conversation, the dock's summary
 * card, and a toast — and they must not drift apart: each one confirms with the same
 * warning, reports the same way, and leaves the same state behind. So they all call
 * this, and none of them own any of the logic.
 *
 * Not a hook, because the toast's button fires from outside React. `useUndoAction`
 * wraps it for components that also want a pending flag.
 */

import i18n from '@/locale/i18n';
import { modal } from '@/shared/lib/modal';
import { toast } from '@/shared/lib/toast';
import { affectedTables } from './snapshot-store';
import { undoAgentWrites } from './restore';

/** Guards against two entry points running a restore at the same time */
let inFlight = false;

/**
 * Confirm, restore, report. Returns true if changes were reverted.
 *
 * Resolves false for every other outcome — declined, nothing to undo, or failed —
 * because callers only use it to drop a pending flag.
 */
export async function runUndoFlow(): Promise<boolean> {
  if (inFlight) return false;

  const tables = affectedTables();
  if (tables.length === 0) {
    /**
     * The offer outlived the snapshot. Reachable from the toast, which lingers for
     * some seconds — long enough for a new task to start and reset it, or for the
     * summary card to be dismissed. Says so rather than doing nothing, because a
     * button that silently no-ops reads as broken.
     */
    toast.info(i18n.t('agent.undo.expired'), 5000);
    return false;
  }

  /**
   * The confirmation names the tables rather than the agent's steps, because that is
   * what actually happens: whole tables go back to their state at the start of the
   * task, so an unrelated edit made in the meantime is reverted too. Promising a
   * surgical undo of just the agent's work would be a lie.
   */
  const confirmed = await modal.confirm({
    title: i18n.t('agent.undo.title'),
    content: i18n.t('agent.undo.body', { tables: tables.join(', ') }),
    confirmText: i18n.t('agent.undo.confirm'),
    cancelText: i18n.t('common.cancel'),
    destructive: true,
  });
  if (!confirmed) return false;

  inFlight = true;
  // Restoring several thousand rows is not instant, and the buttons that start it may
  // be in a card the user closes. A sticky toast is the one indicator that survives.
  const progressId = toast.info(i18n.t('agent.undo.working'), Infinity);

  try {
    const result = await undoAgentWrites();
    toast.dismiss(progressId);
    if (!result) return false;

    // Two facts, and the second one matters more: the model's context still says the
    // changes went through, so a follow-up message would build on data that no longer
    // exists. Nothing can tell it — only the user can.
    toast.success(
      `${i18n.t('agent.undo.done', { count: result.rowsRestored })} · ${i18n.t('agent.undo.aiUnaware')}`,
      8000,
    );
    return true;
  } catch (e) {
    toast.dismiss(progressId);
    // The restore rolled back, so the database is untouched and the snapshot is still
    // held — saying "try again" is accurate, not a platitude.
    toast.error(i18n.t('agent.undo.failed', { message: (e as Error).message }), 8000);
    return false;
  } finally {
    inFlight = false;
  }
}
