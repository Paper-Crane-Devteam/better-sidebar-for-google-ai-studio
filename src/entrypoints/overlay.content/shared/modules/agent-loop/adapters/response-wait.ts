/**
 * Why waiting for an AI response gave up.
 *
 * Two failures that look the same from the outside but need opposite handling, and
 * opposite words in front of the user:
 *
 * - `timeout` — a turn was under way (or we couldn't tell) and then went quiet for
 *   the whole silence budget. "The AI stopped responding" is a fair thing to say.
 * - `not_delivered` — the page is provably idle and no new turn ever started, so
 *   there is nothing to wait for: the message never reached the model. Saying "no
 *   response for 30s" here is a lie, and Retry re-entering the same wait is what
 *   made it look like the button did nothing.
 */
export type ResponseWaitFailure = 'timeout' | 'not_delivered';

export class ResponseWaitError extends Error {
  constructor(
    readonly kind: ResponseWaitFailure,
    message: string,
  ) {
    super(message);
    this.name = 'ResponseWaitError';
  }
}

/**
 * Classify whatever `observeAIResponseComplete` rejected with.
 *
 * Anything unrecognised counts as a timeout: that's the conservative reading, since
 * it keeps the longer budget and the vaguer message rather than telling the user a
 * message wasn't delivered on a guess.
 */
export function responseWaitFailureOf(error: unknown): ResponseWaitFailure {
  return error instanceof ResponseWaitError ? error.kind : 'timeout';
}
