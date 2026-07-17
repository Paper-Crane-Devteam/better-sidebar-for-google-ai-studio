/**
 * Per-element content readiness watcher.
 *
 * Attaches a lightweight MutationObserver to a single element,
 * waiting for its content to become ready (e.g., .query-text-line or .markdown appears).
 * Disconnects on success or timeout.
 */

/** Max wait before giving up on content readiness */
const ELEMENT_OBSERVER_TIMEOUT_MS = 10000;

export interface ElementWatcher {
  observer: MutationObserver;
  timeout: ReturnType<typeof setTimeout>;
}

export class ElementWatcherManager {
  private watchers = new Map<HTMLElement, ElementWatcher>();

  /**
   * Watch an element for content readiness.
   * Calls tryRender repeatedly on childList mutations.
   * Stops when tryRender returns true or timeout.
   */
  watch(el: HTMLElement, tryRender: () => boolean): void {
    if (this.watchers.has(el)) return;

    const observer = new MutationObserver(() => {
      if (tryRender()) {
        this.remove(el);
      }
    });

    observer.observe(el, { childList: true, subtree: true });

    const timeout = setTimeout(() => {
      tryRender();
      this.remove(el);
    }, ELEMENT_OBSERVER_TIMEOUT_MS);

    this.watchers.set(el, { observer, timeout });
  }

  remove(el: HTMLElement): void {
    const watcher = this.watchers.get(el);
    if (!watcher) return;
    watcher.observer.disconnect();
    clearTimeout(watcher.timeout);
    this.watchers.delete(el);
  }

  cleanup(): void {
    for (const [, watcher] of this.watchers) {
      watcher.observer.disconnect();
      clearTimeout(watcher.timeout);
    }
    this.watchers.clear();
  }
}
