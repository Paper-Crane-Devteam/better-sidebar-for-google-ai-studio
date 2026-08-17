/**
 * The one thing on screen while a sync run drives the tab.
 *
 * A run moves the page from conversation to conversation for minutes at a time, and the
 * agent session that started it is already over — so without this the user watches the
 * tab wander with nothing to read and no way out. A sticky toast is the right shape:
 * it survives SPA navigation (the overlay React tree is never torn down), it carries
 * the cancel button, and it costs no layout anywhere else.
 *
 * Re-created rather than only updated when the toast is gone: the toast has its own
 * close button, and a user who dismisses it must not thereby lose the only stop
 * control. Each conversation re-asserts the indicator.
 */

import i18n from '@/locale/i18n';
import { toast, useToastStore } from '@/shared/lib/toast';

let toastId: string | null = null;

function stillOnScreen(id: string | null): id is string {
  if (!id) return false;
  return useToastStore.getState().toasts.some((t) => t.id === id);
}

export function showSyncProgress(
  current: number,
  total: number,
  onCancel: () => void,
): void {
  const message = i18n.t('agent.sync.progress', { current, total });
  const action = { label: i18n.t('agent.sync.stop'), onClick: onCancel };

  if (stillOnScreen(toastId)) {
    toast.update(toastId, { message, action });
    return;
  }

  toastId = toast.withAction(message, 'info', action);
}

export function hideSyncProgress(): void {
  if (toastId) toast.dismiss(toastId);
  toastId = null;
}
