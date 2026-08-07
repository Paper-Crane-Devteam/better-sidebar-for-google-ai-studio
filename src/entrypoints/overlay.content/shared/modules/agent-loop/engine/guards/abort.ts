/**
 * Abort handling for the agent loop.
 *
 * The loop is a long `while` with awaits everywhere, so stopping it has to work
 * from the outside at any point. The mechanism: one `AbortToken` per run, checked
 * between stages (`check()` throws) and listened to inside long waits.
 *
 * Aborts are signalled by throwing, so they unwind through every stage without
 * each one needing a "was I cancelled?" return value. `AgentLoopEngine` catches
 * them at the top and treats them as a normal stop, not an error.
 */

/** Message carried by the abort error — kept stable, some call sites match on it */
export const ABORT_MESSAGE = 'Agent loop aborted';

export class AbortError extends Error {
  constructor() {
    super(ABORT_MESSAGE);
    this.name = 'AbortError';
  }
}

/** Whether `e` is the loop's own abort signal rather than a real failure */
export function isAbortError(e: unknown): boolean {
  return e instanceof AbortError || (e as Error | undefined)?.message === ABORT_MESSAGE;
}

/**
 * One run's cancellation state. `renew()` starts a fresh run — the old signal
 * stays aborted so anything still waiting on it unwinds instead of leaking.
 */
export class AbortToken {
  private controller = new AbortController();

  /** Arm a fresh token for a new run (start / resume) */
  renew(): void {
    this.controller = new AbortController();
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get aborted(): boolean {
    return this.controller.signal.aborted;
  }

  abort(): void {
    this.controller.abort();
  }

  /** Throw if the run was cancelled — call between stages */
  check(): void {
    if (this.aborted) throw new AbortError();
  }
}
