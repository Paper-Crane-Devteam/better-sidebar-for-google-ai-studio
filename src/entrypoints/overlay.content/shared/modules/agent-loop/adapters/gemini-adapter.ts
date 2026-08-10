/**
 * Gemini Platform Adapter.
 * Implements AgentPlatformAdapter for Google Gemini's Quill-based rich-textarea.
 */

import type { AgentPlatformAdapter } from './types';
import {
  getEditor as quillGetEditor,
  getCursorPosition as quillGetCursorPosition,
  replaceAllContent,
  triggerSend as quillTriggerSend,
  getSendButtonState,
} from '@/entrypoints/overlay.content/shared/lib/quill-editor';

/** How often the page is sampled while waiting for a response to settle */
const RESPONSE_SAMPLE_MS = 400;

/**
 * Samples the text must hold still for after generation ends.
 *
 * The button flips back the moment the stream closes, but Gemini is still rendering
 * markdown and code blocks — reading at the exact flip can catch a half-rendered
 * tail, which then gets parsed as if it were the whole response.
 */
const SETTLE_TICKS = 2;

/**
 * Samples the text must hold still for when the button can't be read at all.
 *
 * Stricter than `SETTLE_TICKS` because there is no authoritative signal backing it
 * up: mid-stream pauses of a second do happen, so this has to outlast them.
 */
const BLIND_SETTLE_TICKS = 5;

export class GeminiAgentAdapter implements AgentPlatformAdapter {
  getEditor(): HTMLElement | null {
    return quillGetEditor();
  }

  insertText(text: string): void {
    const editor = this.getEditor();
    if (!editor) return;
    replaceAllContent(editor, text);
  }

  async triggerSend(options?: { humanDelay?: boolean }): Promise<boolean> {
    return quillTriggerSend(options);
  }

  getText(): string {
    return this.getEditor()?.textContent || '';
  }

  getCursorPosition(): number {
    const editor = this.getEditor();
    if (!editor) return 0;
    return quillGetCursorPosition(editor);
  }

  /**
   * Resolve once the last AI response has finished.
   *
   * The primary signal is the composer button's **edge**: it reads "stop generating"
   * while a turn is in flight, so watching it go back to "send" is watching
   * generation end. Level, not edge, would be wrong — we start waiting right after
   * clicking send, and the button hasn't flipped to "stop" yet at that instant, so
   * "button says send" is true before anything has happened.
   *
   * Text sampling is still here, but demoted to two jobs:
   *
   * 1. **Guard.** The text has to differ from the turn that existed when we started,
   *    or a fast-looking edge would hand back the previous answer.
   * 2. **Fallback.** `getSendButtonState()` is a four-level cascade over Gemini's own
   *    class names and can end up at `'unknown'` if they change it. Making the button
   *    the sole signal would mean one Gemini redesign kills the feature outright, in
   *    the worst possible shape: a promise that never settles.
   *
   * Two historical failure modes this has to keep avoiding:
   *
   * - Resolving on a *partial* stream. Gemini pauses >500ms mid-answer, so a plain
   *   debounce said "done"; the half-written response had no tool call, and the
   *   engine read that as task completion on round 1.
   * - Never resolving, because a streaming heuristic latched onto a stale node.
   *
   * The timeout is **idle time, not total time** — see `awaitAIResponse`. Anything
   * that proves the page is alive (text changing, button reading "stop") pushes it
   * back, so a model that thinks for ten minutes is fine and only real silence
   * gives up.
   */
  observeAIResponseComplete(idleTimeoutMs: number): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
      // Snapshot the response that already exists when we start waiting, so the
      // previous turn's answer is never mistaken for the new one.
      const baselineElement = this.getLastAIResponseElement();
      const baselineText = baselineElement
        ? this.extractResponseText(baselineElement).trim()
        : '';

      const isStaleResponse = (el: HTMLElement, text: string): boolean =>
        el === baselineElement && text === baselineText;

      /** Set once the button has been seen in "stop" — i.e. this turn really started */
      let sawGenerating = false;
      let lastText = '';
      let stableTicks = 0;
      let deadline = Date.now() + idleTimeoutMs;

      const cleanup = () => clearInterval(interval);

      /** Any proof the turn is alive postpones giving up */
      const keepAlive = () => {
        deadline = Date.now() + idleTimeoutMs;
      };

      const tick = () => {
        // Checked once, up front: every branch below either calls `keepAlive` or is
        // by definition a sample where nothing happened. Settling takes ~1s from the
        // last change, so this can't cut off a turn that was about to resolve.
        if (Date.now() > deadline) {
          cleanup();
          reject(new Error('AI response timeout'));
          return;
        }

        // ── Still generating: nothing to decide, just stay alive ──────────────
        if (getSendButtonState() === 'stop') {
          sawGenerating = true;
          stableTicks = 0;
          keepAlive();
          return;
        }

        const response = this.getLastAIResponseElement();
        if (!response) return;

        const text = this.extractResponseText(response).trim();

        // Empty means the bubble exists but nothing has streamed in yet; stale means
        // we're still looking at the turn that was there before we started waiting.
        if (!text || isStaleResponse(response, text)) {
          lastText = '';
          stableTicks = 0;
          return;
        }

        // Text is moving — the answer is arriving, whatever the button says.
        if (text !== lastText) {
          lastText = text;
          stableTicks = 0;
          keepAlive();
          return;
        }

        stableTicks++;

        // Past the edge: we watched it generate and the button has come back, so a
        // couple of still samples are only to let the final render land.
        //
        // Never having seen it generate means the button is unreadable or we started
        // too late, so text stability is carrying this alone and has to wait longer.
        const required = sawGenerating ? SETTLE_TICKS : BLIND_SETTLE_TICKS;
        if (stableTicks >= required) {
          cleanup();
          resolve(response);
        }
      };

      const interval = setInterval(tick, RESPONSE_SAMPLE_MS);
    });
  }

  extractResponseText(responseElement: HTMLElement): string {
    return responseElement.innerText || responseElement.textContent || '';
  }

  getLastAIResponseElement(): HTMLElement | null {
    // Gemini uses model-response elements
    const responses = document.querySelectorAll(
      'model-response .model-response-text, model-response .response-content, .model-response-text'
    );
    if (responses.length > 0) {
      return responses[responses.length - 1] as HTMLElement;
    }

    // Fallback: try message content containers
    const messages = document.querySelectorAll('[data-message-author-role="model"]');
    if (messages.length > 0) {
      return messages[messages.length - 1] as HTMLElement;
    }

    return null;
  }
}
