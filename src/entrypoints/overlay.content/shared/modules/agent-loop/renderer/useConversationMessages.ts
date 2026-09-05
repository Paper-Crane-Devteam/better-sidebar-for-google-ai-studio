/**
 * useConversationMessages — the conversation, as turns the agent view can render.
 *
 * Two readers, one per platform, because the two platforms keep the conversation in
 * genuinely different places:
 *
 * | | source | why |
 * |---|---|---|
 * | Gemini | the DOM | every turn is in the document, and there is no API capture of them |
 * | AI Studio | `conversation-messages-store` | its transcript is **virtualised** — measured: 16 turns in the document, 5 with any content in them; scroll to the top and it is 1. Reading the DOM there does not return a partial conversation, it returns a confidently wrong one |
 *
 * The store is not a consolation prize on AI Studio, it is the better source: it is fed by
 * the API interceptor, so the text is the model's own output rather than a
 * render-then-scrape round trip, and the `<bs_agent_tool>` blocks arrive verbatim.
 *
 * Parsing is shared — see `turn-assembly.ts`. Only the reading differs.
 */

import { useState, useEffect, useCallback } from 'react';
import { findConversationScroller } from './constants';
import { useCurrentConversationId } from '@/entrypoints/overlay.content/shared/hooks/useCurrentConversationId';
import type { ExtractedToolCall } from './helpers/tool-parser';
import type { DerivedToolOutcome, ToolResultEntry } from './helpers/tool-outcomes';
import { assembleTurns, type RawTurn } from './turn-assembly';
import { htmlToMarkdown } from '@/shared/lib/utils/utils';
import { detectPlatform, Platform } from '@/shared/types/platform';
import { useConversationMessagesStore } from '@/shared/lib/conversation-messages-store';
import { getRunState } from '@/entrypoints/overlay.content/shared/lib/aistudio-editor';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { ToolResultEntry, DerivedToolOutcome };

export interface DisplayMessageTurn {
  id: string;
  role: 'user' | 'model';
  rawText: string;
  /** Clean text for display (prompt content stripped, tool results stripped) */
  displayText: string;
  promptId?: string;
  promptTitle?: string;
  promptContent?: string;
  /** Parsed tool result entries (user message contains tool results sent back to AI) */
  toolResults: ToolResultEntry[];
  toolCalls: ExtractedToolCall[];
  /**
   * What became of each `toolCalls[i]`, recovered from the results message that followed
   * this turn. `null` where nothing could be matched — and always null on the turn
   * currently running, whose results haven't been sent yet. The live session's own ledger
   * covers that case.
   */
  toolOutcomes: Array<DerivedToolOutcome | null>;
  isStreaming: boolean;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function useConversationMessages(): DisplayMessageTurn[] {
  // Fixed for the lifetime of the page, so both readers are called on every render and
  // the inactive one is told to stay idle. Calling only one would be a conditional hook.
  const isAiStudio = detectPlatform() === Platform.AI_STUDIO;

  const domTurns = useDomConversationTurns(!isAiStudio);
  const storeTurns = useStoreConversationTurns(isAiStudio);

  return isAiStudio ? storeTurns : domTurns;
}

// ─── Reader: the store (AI Studio) ───────────────────────────────────────────

/**
 * Read the conversation out of `conversation-messages-store`.
 *
 * Measured behaviour this relies on: AI Studio's interceptor fires once per completed
 * generation, carrying the **whole** conversation — not a delta. So the store is complete
 * as of the last finished turn, and there is nothing to stitch together.
 *
 * ⚠️ It therefore lags by one turn *while a response is streaming*: the user's message and
 * the model's reply both land in the store only when generation ends. Accepted rather than
 * patched over with a DOM tail, and the reason it is acceptable is timing: the store
 * catches up when the stream closes, which is *before* the engine finishes its own settle
 * detection (two extra samples, ~800ms) and therefore before any approval can be pending.
 * So the tool cards are there by the time they have a decision to carry. The Dock reports
 * what the loop is doing in the meantime.
 *
 * Reading the DOM for that tail was the alternative and it was rejected: aligning DOM turns
 * with store messages is not sound under virtualisation. AI Studio gives a thought its own
 * `ms-chat-turn` while the store filters thoughts out, so the two lists differ by however
 * many thoughts the conversation contains — and a *virtualised* thought turn has no
 * `ms-thought-chunk` to recognise it by, because its content isn't rendered. Any index
 * alignment would silently go off by one on exactly the conversations that matter.
 */
function useStoreConversationTurns(enabled: boolean): DisplayMessageTurn[] {
  const messages = useConversationMessagesStore((s) => s.messages);
  const [turns, setTurns] = useState<DisplayMessageTurn[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const build = () => {
      // Already ordered by `orderIndex` in the store.
      const raw: RawTurn[] = messages.map((m, index) => ({
        id: m.id,
        role: m.role,
        text: m.content,
        // Only the newest model turn can be in flight, and the composer is what says so.
        isStreaming:
          m.role === 'model' && index === messages.length - 1 && getRunState() === 'stop',
      }));

      const next = assembleTurns(raw);
      setTurns((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };

    build();

    // `isStreaming` comes off the Run button, which changes without the store changing —
    // so this needs a clock as well as the store subscription above.
    const interval = setInterval(build, 500);
    return () => clearInterval(interval);
  }, [enabled, messages]);

  return turns;
}

// ─── Reader: the DOM (Gemini) ────────────────────────────────────────────────

/**
 * Extract markdown text from a conversation element (user-query or model-response).
 * Strips accessibility-only elements before conversion.
 */
function extractMarkdown(el: Element): string {
  // Find the most specific content container
  const contentEl =
    el.querySelector('.markdown, .model-response-text, .response-content') ||
    el.querySelector('.user-query-content, .query-text, .user-query-text') ||
    el;

  const clone = contentEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.cdk-visually-hidden').forEach((h) => h.remove());

  return htmlToMarkdown(clone);
}

function useDomConversationTurns(enabled: boolean): DisplayMessageTurn[] {
  const [turns, setTurns] = useState<DisplayMessageTurn[]>([]);
  // Navigating between conversations must force a re-parse and re-bind
  const conversationId = useCurrentConversationId();

  const parseConversationDOM = useCallback(() => {
    const container = findConversationScroller();
    if (!container) {
      setTurns([]);
      return;
    }

    const elements = container.querySelectorAll('user-query, model-response');

    const raw: RawTurn[] = Array.from(elements).map((el, index) => {
      const isUser = el.tagName === 'USER-QUERY';
      return {
        id: `${isUser ? 'user' : 'model'}-${index}`,
        role: isUser ? ('user' as const) : ('model' as const),
        text: extractMarkdown(el),
        // aria-busy is not used by Gemini (always null). Use the send button's "stop"
        // class instead — but only for the last model-response (earlier ones are done).
        isStreaming:
          !isUser &&
          index === elements.length - 1 &&
          document.querySelector('gem-icon-button.send-button.stop') !== null,
      };
    });

    const next = assembleTurns(raw);
    setTurns((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Starting from a clean slate matters: message ids are index-based, so leftovers from
    // the previous conversation would be reused by React.
    setTurns([]);

    let observed: HTMLElement | null = null;
    const observer = new MutationObserver(() => parseConversationDOM());

    /**
     * (Re)bind to the current scroll container.
     *
     * Gemini swaps this element out on SPA navigation. The observer used to be bound once
     * on mount, so after switching conversations it was watching a detached node — no more
     * mutations arrived and the overlay kept showing the previous conversation forever.
     */
    const bind = () => {
      const next = findConversationScroller();
      if (next === observed) return;

      observed = next;
      observer.disconnect();
      if (next) {
        observer.observe(next, { childList: true, subtree: true, characterData: true });
      }
      parseConversationDOM();
    };

    bind();
    const interval = setInterval(bind, 1000);

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [enabled, conversationId, parseConversationDOM]);

  return turns;
}
