/**
 * The contract for `AI_STUDIO_STREAM`, shared by the two sides that never import
 * each other: the main-world interceptor that dispatches it
 * (`main-world/aistudio/interceptors/generate-content.ts`) and the overlay hook that
 * listens for it (`shared/hooks/useAiStudioStream.ts`).
 *
 * Its own module so neither bundle has to pull in the other. Types and one string,
 * nothing with a runtime cost.
 */

/** Fired repeatedly while the model generates, then once more when it stops. */
export const AI_STUDIO_STREAM_EVENT = 'AI_STUDIO_STREAM';

export interface AiStudioStreamDetail {
  /**
   * Identifies this generation, so a consumer can tell a fresh run from the one it
   * is already showing without diffing text.
   */
  streamId: string;
  /**
   * Reasoning so far. Accumulated rather than a delta — a consumer that misses an
   * event to throttling or a slow render still ends up with the right text.
   */
  thought: string;
  /** Answer so far, accumulated for the same reason. */
  answer: string;
  /**
   * The message this generation is answering, read off the request — or `null`
   * meaning "unchanged, keep what you have".
   *
   * Carried alongside the reply because the question is no more available than the
   * answer until AI Studio saves the chat, and rendering a reply with nothing above
   * it looks like a bug.
   *
   * `null` on the events in between is not premature optimisation: during an agent
   * run this string is the assembled prompt or a tool-results payload — tens of
   * kilobytes — and every event is structured-cloned across the world boundary. It
   * is sent when the stream opens and again when it closes, and those are the only
   * two moments it can differ.
   */
  user: string | null;
  /** True on the final event for this stream. */
  finished: boolean;
}
