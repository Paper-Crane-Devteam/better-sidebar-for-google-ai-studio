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

/** How often the response is sampled while waiting for it to settle */
const RESPONSE_SAMPLE_MS = 400;
/** Consecutive identical samples required before a response counts as finished */
const STABLE_TICKS_REQUIRED = 3;
/** How long `isStreaming()` may hold back an otherwise stable response */
const STREAMING_VETO_TICKS = 8;

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
   * Resolve once the last AI response has settled.
   *
   * Uses sampling rather than a debounced MutationObserver. Two failure modes
   * killed the loop before:
   *
   * - Resolving on a *partial* stream. Gemini pauses for >500ms mid-answer, and
   *   `message-actions` does not exist yet early in a turn, so the old streaming
   *   check said "done". The half-written response contained no tool call, the
   *   engine read that as "task complete" and ended the session on round 1.
   * - Never resolving at all, because `isStreaming()` matched an unrelated hidden
   *   progress bar somewhere in the page and stayed true until the 60s timeout.
   *
   * So: the text must be identical across several consecutive samples, and the
   * streaming signal only gets to veto for a limited grace window.
   */
  observeAIResponseComplete(timeoutMs: number): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
      // Snapshot the response that already exists when we start waiting, so the
      // previous turn's answer is never mistaken for the new one.
      const baselineElement = this.getLastAIResponseElement();
      const baselineText = baselineElement
        ? this.extractResponseText(baselineElement).trim()
        : '';

      const isStaleResponse = (el: HTMLElement, text: string): boolean =>
        el === baselineElement && text === baselineText;

      let lastText = '';
      let stableTicks = 0;

      const cleanup = () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };

      const tick = () => {
        const response = this.getLastAIResponseElement();
        if (!response) return;

        const text = this.extractResponseText(response).trim();
        // Empty means the bubble exists but nothing has streamed in yet
        if (!text || isStaleResponse(response, text)) {
          lastText = '';
          stableTicks = 0;
          return;
        }

        if (text !== lastText) {
          lastText = text;
          stableTicks = 0;
          return;
        }

        stableTicks++;

        // The composer button is authoritative: while it reads "stop generating"
        // the turn is definitely unfinished, so this veto has no grace limit.
        if (getSendButtonState() === 'stop') return;

        // The DOM heuristics below can latch on stale nodes, so they only get to
        // hold things back for a bounded window.
        if (this.isStreaming(response) && stableTicks < STREAMING_VETO_TICKS) return;
        if (stableTicks < STABLE_TICKS_REQUIRED) return;

        cleanup();
        resolve(response);
      };

      const interval = setInterval(tick, RESPONSE_SAMPLE_MS);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('AI response timeout'));
      }, timeoutMs);
    });
  }

  extractResponseText(responseElement: HTMLElement): string {
    return responseElement.innerText || responseElement.textContent || '';
  }

  /**
   * Whether the given (or last) response is still streaming.
   *
   * Scoped to the response element on purpose. The previous version queried the
   * whole document for things like `mat-progress-bar` and `message-actions[hidden]`,
   * which match unrelated parts of Gemini's UI — that made the loop believe the
   * answer never finished and it sat there until the 60s timeout.
   */
  isStreaming(responseElement?: HTMLElement): boolean {
    // Strongest signal: the composer button is "stop generating" while streaming.
    // It lags slightly behind the real stream end, which is fine here — the send
    // path waits for it separately, so a click can never hit stop by mistake.
    if (getSendButtonState() === 'stop') return true;

    const response = responseElement ?? this.getLastAIResponseElement();
    const turn = response?.closest('model-response');
    if (!turn) return false;

    if (turn.getAttribute('aria-busy') === 'true') return true;
    if (response?.getAttribute('aria-busy') === 'true') return true;

    // Gemini keeps the per-turn action bar hidden until the answer is complete
    const actions = turn.querySelector('message-actions');
    if (actions?.hasAttribute('hidden')) return true;

    return turn.querySelector('.loading-indicator, .streaming-indicator, .response-streaming') !== null;
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
