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
import {
  useAiStudioStreamStore,
  selectLiveTail,
} from '@/shared/lib/aistudio-stream-store';
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
 * Read the conversation out of `conversation-messages-store`, plus the generation
 * currently in flight.
 *
 * Two sources, because the store is authoritative but late. `AI_STUDIO_RESPONSE` carries
 * the **whole** conversation rather than a delta, so the store needs no stitching — but it
 * is fed by `UpdatePrompt`, which is AI Studio *saving* the chat, not generating it.
 * Measured: the stream closed at t=32451 and the save landed at t=39938. The reply existed
 * for seven and a half seconds before the store heard about it, and three of those were
 * AI Studio sitting on a debounce.
 *
 * So the tail comes from `aistudio-stream-store`, fed by an interceptor that reads
 * `GenerateContent` as it streams (see `generate-content-stream.ts` for the wire format).
 * The handover is positional, not event-ordered — see `selectLiveTail` — so there is no
 * frame in which the reply is missing from both halves, and no flicker when it moves from
 * one to the other.
 *
 * Reading the DOM for that tail was the earlier alternative and it stays rejected: aligning
 * DOM turns with store messages is not sound under virtualisation. AI Studio gives a
 * thought its own `ms-chat-turn` while the store filters thoughts out, so the two lists
 * differ by however many thoughts the conversation contains — and a *virtualised* thought
 * turn has no `ms-thought-chunk` to recognise it by, because its content isn't rendered.
 * Any index alignment would silently go off by one on exactly the conversations that
 * matter. Intercepting the request sidesteps all of it: the text is the model's own output,
 * thoughts are flagged in the payload, and `<bs_agent_tool>` blocks arrive verbatim.
 *
 * The live tail is a *pair*, because the user's message is missing from the store for
 * exactly as long as the reply is — both arrive in that one late save. So the question comes
 * off the request body (`readPendingUserText`) and appears as soon as the request goes out,
 * ~2.7s before the model's first chunk. Feeding it through `assembleTurns` unchanged is
 * deliberate: an agent turn's "user" message is a tool-results payload, and this way its
 * result cards and prompt-marker stripping work live too, with no second code path.
 */
function useStoreConversationTurns(enabled: boolean): DisplayMessageTurn[] {
  const messages = useConversationMessagesStore((s) => s.messages);
  const streamState = useAiStudioStreamStore();
  const conversationId = useCurrentConversationId();
  const [turns, setTurns] = useState<DisplayMessageTurn[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const build = () => {
      const live = selectLiveTail(streamState, conversationId, messages);

      // Already ordered by `orderIndex` in the store.
      const raw: RawTurn[] = messages.map((m, index) => ({
        id: m.id,
        role: m.role,
        text: m.content,
        // Only the newest model turn can be in flight, and the composer is what says so.
        // With a live tail present the newest turn is that tail, not this one — marking
        // both would put a caret on a finished turn as well as the one being written.
        isStreaming:
          !live &&
          m.role === 'model' &&
          index === messages.length - 1 &&
          getRunState() === 'stop',
      }));

      // Keyed by the stream, so React reuses these nodes for the whole generation
      // instead of remounting them, and so they cannot collide with a store id.
      if (live?.user) {
        raw.push({
          id: `live-${streamState.streamId}-user`,
          role: 'user',
          text: live.user,
          isStreaming: false,
        });
      }
      if (live?.answer) {
        raw.push({
          id: `live-${streamState.streamId}-model`,
          role: 'model',
          text: live.answer,
          isStreaming: !live.finished,
        });
      }

      const next = assembleTurns(raw);
      setTurns((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };

    build();

    // `isStreaming` comes off the Run button, which changes without the store changing —
    // so this needs a clock as well as the store subscription above.
    const interval = setInterval(build, 500);
    return () => clearInterval(interval);
  }, [enabled, messages, streamState, conversationId]);

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
