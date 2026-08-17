/**
 * Scrolling an open conversation back to its first message.
 *
 * Why scrolling is the whole mechanism: we never fetch anything ourselves. Gemini
 * pages its own history as you scroll up, and the main-world interceptor
 * (`interceptors/chat-content.ts`) catches every one of those responses and hands the
 * messages to the background for upsert. So "sync a conversation" reduces to: open
 * it, scroll to the top, let the extension's normal capture path do the recording.
 *
 * Gemini-specific, like every DOM assumption in this file: the target is
 * `chat-window infinite-scroller`. If Gemini renames it, a run degrades to
 * `no-scroller` — it still records whatever the initial page load fetched, and says so
 * rather than reporting a full sync it didn't do.
 */

export type ScrollOutcome =
  /** Hit the first message — the whole history has been through the interceptor */
  | 'reached-top'
  /** Still loading older pages when the time budget ran out */
  | 'timed-out'
  /** No scrollable element found, so only the initial page was captured */
  | 'no-scroller'
  /** The user stopped the run mid-scroll */
  | 'cancelled';

export interface ScrollToTopOptions {
  /** Hard cap for one conversation. Defaults to 60s. */
  maxDuration?: number;
  /** Pause after each scroll step, giving Gemini time to fetch. Defaults to 800ms. */
  stepDelay?: number;
  /**
   * Checked between steps so "Stop" doesn't have to wait out the budget.
   *
   * One conversation can hold the run here for a full minute, which is long enough that
   * a cancel with no effect until it returns reads as a button that does nothing.
   */
  shouldCancel?: () => boolean;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Scoped on purpose: `infinite-scroller` is also the sidebar's history list, so a bare
 * `querySelector('infinite-scroller')` can resolve to the wrong one depending on
 * document order — the same trap `content/gemini/tasks/history-scroller.ts` ran into
 * from the other side.
 */
const SCROLLER_SELECTORS = [
  'chat-window infinite-scroller',
  'chat-window #chat-history',
];

/**
 * Locate the element that scrolls the message list.
 *
 * Same element SmartScrollbar reads (`getChatScrollContainer()`), re-derived here
 * rather than imported: nothing under `shared/` reaches into `gemini/`, and a
 * one-line selector isn't worth being the first thing to.
 */
export function findConversationScroller(): HTMLElement | null {
  for (const selector of SCROLLER_SELECTORS) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) return resolveScrollable(el);
  }
  return null;
}

/**
 * The custom element isn't always the one with the overflow.
 *
 * Checks itself first, then its descendants — and falls back to the element we
 * matched, since a conversation short enough not to scroll yet has no overflow to
 * find, and returning null there would report "no scroller" for a page that is simply
 * already showing everything.
 */
function resolveScrollable(root: HTMLElement): HTMLElement {
  const scrolls = (el: HTMLElement) => {
    const overflowY = getComputedStyle(el).overflowY;
    return (
      (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight - el.clientHeight > 4
    );
  };

  if (scrolls(root)) return root;

  const inner = (Array.from(root.querySelectorAll('*')) as HTMLElement[])
    .slice(0, 200)
    .find(scrolls);

  return inner ?? root;
}

/**
 * Scroll upward until the conversation stops growing.
 *
 * Mirror image of the sidebar's `scrollHistoryToEnd`: older messages are *above*, so
 * this drives `scrollTop` to 0 and treats "already at the top and the height hasn't
 * changed" as the end. The height check matters on its own — prepending older
 * messages usually pushes `scrollTop` back off zero, so position alone would call it
 * done far too early.
 */
export async function scrollConversationToTop(
  options: ScrollToTopOptions = {},
): Promise<ScrollOutcome> {
  const { maxDuration = 60_000, stepDelay = 800, shouldCancel } = options;

  const scroller = findConversationScroller();
  if (!scroller) {
    console.warn('[AgentLoop][sync] no conversation scroller found; captured first page only');
    return 'no-scroller';
  }

  const deadline = Date.now() + maxDuration;
  let previousScrollHeight = -1;
  let settledRounds = 0;

  while (Date.now() < deadline) {
    if (shouldCancel?.()) return 'cancelled';

    scroller.scrollTop = 0;
    // Virtual scrollers often only react to a real event, not to the property write.
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    await wait(stepDelay);

    const grew = scroller.scrollHeight !== previousScrollHeight;
    previousScrollHeight = scroller.scrollHeight;

    if (grew || scroller.scrollTop > 4) {
      settledRounds = 0;
      continue;
    }

    // Two quiet rounds in a row: nothing more is being fetched.
    if (++settledRounds >= 2) return 'reached-top';
  }

  return 'timed-out';
}
