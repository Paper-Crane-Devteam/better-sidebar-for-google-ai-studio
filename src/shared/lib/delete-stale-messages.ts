/**
 * The write half of stale-row cleanup.
 *
 * Kept out of `stale-messages.ts` on purpose: that module is imported by
 * `conversation-messages-store.ts` for the diff, so importing the store back
 * into it would close a cycle. Detection stays pure and dependency-free here;
 * only this file knows about the store and the background channel.
 */

import { browser } from 'wxt/browser';
import { useConversationMessagesStore } from '@/shared/lib/conversation-messages-store';

/**
 * Delete the detected stale rows, then drop them from the store so the UI
 * updates without a page reload.
 *
 * Returns how many rows the DB actually removed. That can be lower than
 * `ids.length` — something else may have cleaned up first — which is why the
 * caller should report this number rather than the number it asked for.
 */
export async function deleteStaleMessages(
  conversationId: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;

  const response = await browser.runtime.sendMessage({
    type: 'DELETE_MESSAGES_BY_IDS',
    payload: { conversationId, ids },
  });

  if (!response?.success) {
    throw new Error(response?.error || 'Failed to delete stale messages');
  }

  useConversationMessagesStore.getState().forgetMessages(ids);
  return typeof response.data === 'number' ? response.data : ids.length;
}
