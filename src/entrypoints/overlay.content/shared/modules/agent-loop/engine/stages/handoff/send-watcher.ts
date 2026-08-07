/**
 * Confirming that the staged results actually left the composer.
 *
 * There is no callback for "the platform accepted my message", so the signal is
 * indirect: the staged payload disappearing from the editor. Whether the send came
 * from the engine's own click, the user pressing Enter, or the user clicking the
 * button, it looks the same here — which is exactly why this is observed rather
 * than assumed.
 *
 * Getting this wrong is expensive: an unnoticed miss makes the loop wait for a reply
 * to a message that was never delivered, i.e. a round that hangs until the AI
 * timeout fires. So the wait reports a boolean instead of resolving optimistically.
 */

import type { AgentPlatformAdapter } from '../../../adapters/types';
import { AbortError } from '../../guards/abort';
import { isStaged, type StagedShape } from './staging';

/** Upper bound on how long the loop will sit waiting for a send */
const SEND_WAIT_TIMEOUT_MS = 300000; // 5 min
/** Grace period after the payload vanishes, letting the platform process it */
const POST_SEND_SETTLE_MS = 500;

export interface WaitForSendOptions {
  adapter: AgentPlatformAdapter;
  shape: StagedShape;
  /** Cancels the wait immediately; rejects with AbortError */
  signal?: AbortSignal;
}

/**
 * Resolve true once the payload is gone, false on timeout.
 * Rejects with `AbortError` if the run is cancelled while waiting.
 */
export function waitForSend({ adapter, shape, signal }: WaitForSendOptions): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const editor = adapter.getEditor();
    if (!editor) {
      resolve(false);
      return;
    }

    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      observer.disconnect();
      parentObserver.disconnect();
      signal?.removeEventListener('abort', onAbort);
    };

    const finish = (sent: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      setTimeout(() => resolve(sent), POST_SEND_SETTLE_MS);
    };

    // Abort must interrupt immediately. When this only reacted to DOM mutations,
    // stopping the loop while idle left it hanging here forever.
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new AbortError());
    };

    // Report the miss rather than rejecting, so the caller can pause with a reason
    const timeout = setTimeout(() => finish(false), SEND_WAIT_TIMEOUT_MS);

    const check = (target: HTMLElement | null) => {
      if (target && !isStaged(target, shape)) finish(true);
    };

    const observer = new MutationObserver(() => check(editor));
    observer.observe(editor, { childList: true, subtree: true, characterData: true });

    // The editor element itself can be replaced on SPA navigation, so watch the
    // parent too and re-resolve the editor when it fires.
    const parentObserver = new MutationObserver(() => check(adapter.getEditor()));
    if (editor.parentElement) {
      parentObserver.observe(editor.parentElement, { childList: true, subtree: true });
    }

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort);
  });
}
