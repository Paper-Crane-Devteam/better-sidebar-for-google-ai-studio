/**
 * The generation currently in flight on AI Studio, as it arrives.
 *
 * Deliberately *not* part of `conversation-messages-store`. That store is the
 * conversation as the API reported it, and three other features read it —
 * SmartScrollbar, the Outline, and the DB dedup pass. A half-written turn in there
 * would show up as a flickering outline entry and a scrollbar node that moves under
 * the cursor, and the dedup pass would be comparing against text that is still
 * growing. So the live turn is kept beside that store and merged only by the agent
 * view, which is the one place it belongs.
 *
 * The authoritative transcript still arrives the way it always did, via
 * `UpdatePrompt` → `AI_STUDIO_RESPONSE`. This is strictly a head start.
 */

import { create } from 'zustand';

export interface AiStudioStreamState {
  /** Identifies the generation, so a new run replaces rather than appends. */
  streamId: string | null;
  /**
   * Which conversation this belongs to, or null for "not bound yet".
   *
   * Null is the new-chat case and it has to be allowed: the first message of a new
   * chat is sent from `/prompts/new_chat`, which is a route rather than an id, and
   * AI Studio only navigates to the real id part-way through the generation.
   * Rejecting the unbound events would blank the agent view for exactly the turn a
   * user is most likely to be watching. Same "adopt the id when it arrives" rule the
   * agent loop's own session binding uses — see `RESERVED_CONVERSATION_SEGMENTS`.
   */
  conversationId: string | null;
  /** Reasoning so far. Not rendered today, but it is free to carry and cheap to keep. */
  thought: string;
  /** Answer so far. */
  answer: string;
  /** The message being answered, from the request body. */
  user: string;
  /** False while the model is still generating. */
  finished: boolean;
  /**
   * The last message id in the conversation store when this stream began.
   *
   * How the live turn knows to step aside: once a model message appears *after*
   * this anchor, the real transcript has caught up and the live copy is redundant.
   * Derived from position rather than from an event, so there is no ordering race
   * between the merge that adds the real turn and the clear that removes this one —
   * and therefore no frame where the reply is missing from both.
   */
  anchorId: string | null;

  /** Record progress for a stream, starting a new one if the id changed. */
  apply: (input: {
    streamId: string;
    conversationId: string | null;
    thought: string;
    answer: string;
    /** `null` leaves the stored question alone — see `AiStudioStreamDetail`. */
    user: string | null;
    finished: boolean;
    /** Only read when this is a new stream. */
    anchorId: string | null;
  }) => void;

  /** Drop the live turn — on conversation change, or when a session is undone. */
  reset: () => void;
}

const EMPTY = {
  streamId: null,
  conversationId: null,
  thought: '',
  answer: '',
  user: '',
  finished: false,
  anchorId: null,
};

export const useAiStudioStreamStore = create<AiStudioStreamState>((set, get) => ({
  ...EMPTY,

  apply: ({ streamId, conversationId, thought, answer, user, finished, anchorId }) => {
    const previous = get();
    const isNewStream = previous.streamId !== streamId;
    set({
      streamId,
      // Bind on the first id we see and keep it. Upgrading null → real is the
      // new-chat handover; never the reverse, or navigating to a route without an id
      // would unbind a live turn and let it show up in the next conversation.
      conversationId: isNewStream
        ? conversationId
        : (previous.conversationId ?? conversationId),
      thought,
      answer,
      // A new stream starts from nothing even if it says "unchanged", so a question
      // can never be inherited from the generation before it.
      user: user ?? (isNewStream ? '' : previous.user),
      finished,
      // The anchor belongs to the stream, not to the event: later events for the
      // same generation must not re-read it, because by then the store may already
      // have moved on and the live turn would hide itself early.
      anchorId: isNewStream ? anchorId : previous.anchorId,
    });
  },

  reset: () => set({ ...EMPTY }),
}));

/**
 * The live turns still worth showing, or null once the saved transcript covers them.
 *
 * Returning null is what makes the handover seamless: the live pair stays up through
 * the gap between the stream closing and AI Studio saving — measured at 7.5s, three
 * of them a debounce before the save is even sent — and disappears the moment the
 * saved turns land.
 *
 * `user` without `answer` is a normal state, not a half-built one: the question is
 * known from the request while the model is still thinking, and showing it then is
 * the whole point. `answer` without `user` is normal too, when the request body
 * could not be read.
 */
export function selectLiveTail(
  state: AiStudioStreamState,
  currentConversationId: string | null,
  messages: Array<{ id: string; role: 'user' | 'model' }>,
): { user: string; answer: string; finished: boolean } | null {
  if (!state.answer && !state.user) return null;
  if (!currentConversationId) return null;
  // An unbound stream is the new chat we are currently looking at — it has nowhere
  // else it could belong. Anything already bound has to match.
  if (state.conversationId !== null && state.conversationId !== currentConversationId) {
    return null;
  }

  const anchorIndex = state.anchorId
    ? messages.findIndex((m) => m.id === state.anchorId)
    : -1;

  // A model turn past the anchor means the saved transcript has caught up. When
  // there was no anchor (empty conversation) any model turn at all means that.
  const caughtUp = messages
    .slice(anchorIndex + 1)
    .some((m) => m.role === 'model');
  if (caughtUp) return null;

  return { user: state.user, answer: state.answer, finished: state.finished };
}
