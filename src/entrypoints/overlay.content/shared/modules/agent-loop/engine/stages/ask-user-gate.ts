/**
 * Parking the loop on a question, and noticing every way it can be answered.
 *
 * The question is visible in the chat itself, so the most natural thing a user can
 * do is type the answer into the composer and press Enter — bypassing the Agent tab
 * entirely. If that isn't observed, the engine sits on a promise while the AI has
 * already received the answer and replied: its tool calls go unexecuted, the user
 * watches the model say "sure, doing that now" and nothing happens, and the only
 * way out is Stop. A silent death that looks like normal operation.
 *
 * Hence a three-way race:
 *
 *   answered  — the tab resolved it; the caller hands the text back to the AI
 *   external  — the user answered in the composer; it is already delivered, so the
 *               caller must skip the handoff and go straight to waiting for the AI
 *   aborted   — Stop, or a new session
 *
 * This does not carry the answer in the `external` case. Nothing to carry: the
 * platform already sent it.
 */

import type { AgentQuestion } from '../../types';
import type { LoopContext } from '../context';

/** How often the page is sampled for signs of a natively sent answer */
const NATIVE_POLL_MS = 400;

/**
 * Consecutive confirmations required before believing generation started.
 * Being wrong means abandoning the question to wait for a turn that isn't coming,
 * and generation lasts seconds, so a little patience is free.
 */
const STREAMING_CONFIRM_TICKS = 2;

/** Samples a changed response must hold still for before it counts as finished */
const SETTLED_TICKS = 3;

export type AskUserOutcome =
  /** Answered in the Agent tab — still needs handing back to the AI */
  | { kind: 'answered'; answer: string }
  /**
   * Answered in the composer, so the answer is already with the AI.
   *
   * `response` is set only when the reply had already finished by the time we
   * noticed — stage ① anchors on the turn present when it starts, so it would sit
   * waiting for a turn that has already happened, time out after a minute, and time
   * out again on retry. When it is set the caller must parse it directly; when null
   * the AI is still generating and stage ① can do its normal job.
   */
  | { kind: 'external'; response: HTMLElement | null }
  /** Cancelled */
  | { kind: 'aborted' };

export function waitForUserAnswer(
  ctx: LoopContext,
  question: AgentQuestion,
): Promise<AskUserOutcome> {
  ctx.store.awaitUser();
  ctx.store.noteAskUser();
  ctx.events.emit('user:question-asked', {
    question: question.question,
    optionCount: question.options.length,
    source: question.source,
  });
  console.log('[AgentLoop] Waiting for the user to answer:', question.question.slice(0, 120));

  return new Promise<AskUserOutcome>((resolve) => {
    const adapter = ctx.adapter;
    const signal = ctx.abort.signal;

    // Snapshot the turn that asked the question, so "a new turn appeared" can be
    // told apart from "the same answer is still on screen".
    const baselineElement = adapter.getLastAIResponseElement();
    const baselineText = baselineElement
      ? adapter.extractResponseText(baselineElement).trim()
      : '';

    // The button reads "stop" for a moment after a turn ends. Requiring an idle
    // observation first means the turn we just parsed can't be mistaken for a new one.
    let sawIdle = !adapter.isStreaming();
    let streamingTicks = 0;
    let quietText = '';
    let quietTicks = 0;
    let settled = false;

    const cleanup = () => {
      clearInterval(interval);
      signal.removeEventListener('abort', onAbort);
      // Whoever won, the question is no longer open
      if (ctx.store.pendingQuestion?.resolve === onAnswer) ctx.store.setPendingQuestion(null);
    };

    const settle = (outcome: AskUserOutcome) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(outcome);
    };

    function onAnswer(answer: string | null) {
      if (answer === null) {
        console.log('[AgentLoop] Question dismissed by the user');
        settle({ kind: 'aborted' });
        return;
      }
      ctx.events.emit('user:question-answered', { via: 'tab' });
      settle({ kind: 'answered', answer });
    }

    const onAbort = () => {
      console.log('[AgentLoop] Question wait aborted');
      settle({ kind: 'aborted' });
    };

    const goExternal = (response: HTMLElement | null) => {
      console.log('[AgentLoop] User answered in the chat input — catching up');
      ctx.events.emit('user:question-answered', { via: 'chat' });
      settle({ kind: 'external', response });
    };

    const interval = setInterval(() => {
      if (settled) return;

      if (!sawIdle) {
        // Still winding down from the turn that asked
        if (!adapter.isStreaming()) sawIdle = true;
        return;
      }

      // Strongest signal: the composer button went back to "stop generating", which
      // only happens once a message has been accepted. The reply is still coming, so
      // stage ① gets to observe it normally.
      if (adapter.isStreaming()) {
        quietTicks = 0;
        if (++streamingTicks >= STREAMING_CONFIRM_TICKS) goExternal(null);
        return;
      }
      streamingTicks = 0;

      // Backup for a reply that came and went between samples: a last response whose
      // text differs from the turn that asked. Empty text is ignored so a recycled
      // placeholder node can't trigger it, and the text has to hold still first —
      // handing over a half-streamed answer would get it parsed as if complete.
      const latest = adapter.getLastAIResponseElement();
      if (!latest) return;

      const text = adapter.extractResponseText(latest).trim();
      if (!text || text === baselineText) {
        quietTicks = 0;
        return;
      }

      if (text !== quietText) {
        quietText = text;
        quietTicks = 0;
        return;
      }

      if (++quietTicks >= SETTLED_TICKS) goExternal(latest);
    }, NATIVE_POLL_MS);

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort);

    // Published last: the UI can resolve synchronously, and the listeners above
    // must already be in place for cleanup to find this handler.
    ctx.store.setPendingQuestion({
      ...question,
      askedAt: Date.now(),
      resolve: onAnswer,
    });
  });
}
