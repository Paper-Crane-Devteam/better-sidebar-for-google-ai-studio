/**
 * Aria-busy attribute observer for streaming completion detection.
 *
 * Watches for aria-busy=false transitions on .markdown elements
 * within model-response, signaling streaming has completed.
 */

export type StreamCompleteCallback = (modelResp: HTMLElement) => void;

export class BusyObserver {
  private observer: MutationObserver | null = null;
  private pendingResponses = new Set<HTMLElement>();

  start(onStreamComplete: StreamCompleteCallback): void {
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'aria-busy') continue;
        const target = mutation.target as HTMLElement;
        if (target.getAttribute('aria-busy') !== 'false') continue;

        const modelResp = target.closest('model-response') as HTMLElement | null;
        if (modelResp && this.pendingResponses.has(modelResp)) {
          this.pendingResponses.delete(modelResp);
          onStreamComplete(modelResp);
        }
      }
    });

    this.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-busy'],
      subtree: true,
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.pendingResponses.clear();
  }

  /** Mark a model-response as currently streaming */
  trackStreaming(el: HTMLElement): void {
    this.pendingResponses.add(el);
  }

  isTracking(el: HTMLElement): boolean {
    return this.pendingResponses.has(el);
  }
}
