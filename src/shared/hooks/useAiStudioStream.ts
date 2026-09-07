/**
 * Hook: useAiStudioStream
 *
 * Carries `AI_STUDIO_STREAM` from the main-world interceptor into the live stream
 * store. Call once at the AI Studio overlay root, alongside
 * `useInitConversationMessages`.
 *
 * The event crosses from the page's own JS context into the content script, same as
 * `AI_STUDIO_RESPONSE` already does — `detail` is structured-cloned on the way.
 */

import { useEffect, useRef } from 'react';
import { useAiStudioStreamStore } from '@/shared/lib/aistudio-stream-store';
import { useConversationMessagesStore } from '@/shared/lib/conversation-messages-store';
import { getPlatformDomAdapter } from '@/shared/lib/platform-dom-adapter';
import { useUrl } from '@/shared/hooks/useUrl';
import {
  AI_STUDIO_STREAM_EVENT,
  type AiStudioStreamDetail,
} from '@/shared/types/aistudio-stream';

export function useAiStudioStream() {
  const { path } = useUrl();
  const apply = useAiStudioStreamStore((s) => s.apply);
  const reset = useAiStudioStreamStore((s) => s.reset);

  // Read at event time rather than closed over, so a generation that finishes just
  // after a navigation is attributed to the conversation it actually came from.
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  /**
   * Drop the live turn when the user genuinely changes conversation.
   *
   * Keyed on the conversation id, not the path, and skipping the unbound → bound
   * step. That step is a new chat receiving its real id *during* the generation it
   * is streaming; treating it as a switch would wipe the turn mid-write, which is
   * the one case this whole feature exists to cover.
   */
  const previousIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const adapter = getPlatformDomAdapter();
    const id = adapter?.extractExternalId(path) ?? null;
    const previous = previousIdRef.current;
    previousIdRef.current = id;

    if (previous === undefined) return; // first run, nothing to leave behind
    if (previous === id) return;
    if (previous === null && id !== null) return; // new chat adopting its id

    reset();
  }, [path, reset]);

  useEffect(() => {
    const onStream = (event: Event) => {
      const detail = (event as CustomEvent<AiStudioStreamDetail>).detail;
      if (!detail?.streamId) return;

      const adapter = getPlatformDomAdapter();
      // May be null on a brand new chat. Passed through rather than dropped — the
      // store binds it as soon as AI Studio assigns the real id.
      const conversationId = adapter?.extractExternalId(pathRef.current) ?? null;

      apply({
        streamId: detail.streamId,
        conversationId,
        thought: detail.thought ?? '',
        answer: detail.answer ?? '',
        // `?? null`, never `?? ''`: null means "keep the question you have", while
        // '' means "there is no question" and would blank it on every tick.
        user: detail.user ?? null,
        finished: !!detail.finished,
        // Only used when this is the first event of a new stream — see the store.
        anchorId:
          useConversationMessagesStore.getState().messages.at(-1)?.id ?? null,
      });
    };

    globalThis.addEventListener(AI_STUDIO_STREAM_EVENT, onStream);
    return () => globalThis.removeEventListener(AI_STUDIO_STREAM_EVENT, onStream);
  }, [apply]);
}
