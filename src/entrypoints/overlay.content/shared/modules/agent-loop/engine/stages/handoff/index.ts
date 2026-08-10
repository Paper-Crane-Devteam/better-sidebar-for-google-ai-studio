/**
 * Stage ④ — get the round's results back to the AI.
 *
 * Three steps: stage the payload in the composer, park in `awaiting_send`, then
 * either click send or leave it to the user. Sending always goes through the real
 * send button so the capsule-merging interceptor runs.
 *
 * Who clicks is the caller's decision, passed in as `autoSend` — it follows from
 * whether anything this round needed approval (see `shouldAutoSend`). There used to
 * be a persisted `autoContinue` switch here instead, which could disagree with the
 * approval settings: approve a write by hand, and the results still went out on
 * their own.
 *
 * Stateful, unlike the other stages: between the stage and the confirmed send there
 * is a payload in limbo, and `resume` / `continueNow` need to know about it. That
 * pending text is the difference between "retry sends the results" and "retry waits
 * forever for an answer nobody asked for".
 */

import { triggerSend } from '@/entrypoints/overlay.content/shared/lib/quill-editor';
import type { LoopContext } from '../../context';
import { isStaged, stageResults, type StagedShape } from './staging';
import { waitForSend } from './send-watcher';

export { formatResults, wrapForAI, RESULT_OPEN_TAG } from './formatter';

export class ResultHandoff {
  private shape: StagedShape = 'capsule';

  /** Staged but not yet confirmed sent — kept so a retry can re-stage it */
  private pending: string | null = null;

  constructor(private readonly ctx: LoopContext) {}

  /** Whether a payload is still waiting to reach the AI */
  hasPending(): boolean {
    return this.pending !== null;
  }

  /** Whether the payload is still sitting in the composer */
  isStagedInEditor(): boolean {
    return isStaged(this.ctx.editor(), this.shape);
  }

  /**
   * Full stage-④ run. Returns false when the payload never made it out — the caller
   * must stop the loop then, because waiting for a reply to an undelivered message
   * is the "hangs until timeout" failure mode.
   *
   * `autoSend: false` stages the payload and waits: the user is already here, having
   * just approved something, so the send is theirs. The watcher stays armed either
   * way, so pressing Enter in the composer is picked up exactly like our own click.
   */
  async deliver(text: string, autoSend: boolean): Promise<boolean> {
    this.ctx.setStatus('sending');
    console.log('[AgentLoop] Inserting results into editor, length:', text.length);

    this.pending = text;
    this.shape = await stageResults(this.ctx.adapter, text);

    // A normal checkpoint, not a fault — hence its own status.
    this.ctx.store.awaitSend();
    this.ctx.events.emit('loop:paused', { reason: 'Waiting for user to send results' });

    let clicked = true;
    const sent = await this.watchSend(async () => {
      if (autoSend) clicked = await triggerSend();
    });

    if (!sent) {
      // A refused click means the button was still "stop generating"; pausing is
      // right, because clicking anyway would have aborted the AI's answer.
      console.warn('[AgentLoop] Results were never sent, pausing');
      this.ctx.pause(
        clicked
          ? 'Tool results were not sent. Click "Continue" to send them.'
          : 'Could not send while the AI was still generating. Click "Continue" to retry.',
        'Results not sent',
      );
      return false;
    }

    this.pending = null;
    return true;
  }

  /**
   * Remember a payload the AI is owed, without touching the composer.
   *
   * Used when a guard stops the round mid-way. `pending` is what makes "Retry" send
   * the report instead of restarting a wait for a message that never went out —
   * `resend()` stages it at that point.
   *
   * Deliberately *not* written to the composer now: the loop is about to pause, and
   * text sitting in the input box invites the user to press Enter, which would
   * deliver it with no engine listening for the reply.
   */
  holdForRetry(text: string): void {
    this.pending = text;
    console.log('[AgentLoop] Holding undelivered results for retry, length:', text.length);
  }

  /**
   * Retry path (Agent tab → Retry). Re-stages the payload first if it is no longer
   * in the composer — staging can fail, and the user can clear the input.
   */
  async resend(): Promise<boolean> {
    if (this.pending === null) return true;

    if (!this.isStagedInEditor()) {
      console.warn('[AgentLoop] Re-staging the unsent results before resuming');
      this.shape = await stageResults(this.ctx.adapter, this.pending);
    }

    const sent = await this.watchSend(() => triggerSend({ humanDelay: false }));
    if (sent) this.pending = null;
    return sent;
  }

  /**
   * User pressed "Continue" at the `awaiting_send` checkpoint.
   * Returns false when there was nothing to send.
   */
  async continueNow(): Promise<boolean> {
    if (!this.isStagedInEditor()) {
      console.warn('[AgentLoop] Continue requested but no staged results in the editor');
      return false;
    }
    // User-initiated, so no artificial pause. `triggerSend` still waits out any
    // in-progress generation so the click can't land on the stop button.
    await triggerSend({ humanDelay: false });
    return true;
  }

  /** Forget the pending payload (new session) */
  reset(): void {
    this.pending = null;
    this.shape = 'capsule';
  }

  /**
   * Arm the watcher *before* running `action`, so a send that completes fast can't
   * slip through between the click and the start of observation.
   */
  private async watchSend(action: () => Promise<unknown>): Promise<boolean> {
    const watcher = waitForSend({
      adapter: this.ctx.adapter,
      shape: this.shape,
      signal: this.ctx.abort.signal,
    });
    await action();
    return watcher;
  }
}
