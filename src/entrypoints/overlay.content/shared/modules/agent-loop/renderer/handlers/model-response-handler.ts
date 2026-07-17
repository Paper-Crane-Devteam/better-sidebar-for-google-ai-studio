/**
 * Model response detection and rendering handler.
 *
 * Handles streaming detection, skeleton overlays, stability checks,
 * and final shadow DOM rendering of tool call widgets.
 */

import type ReactDOM from 'react-dom/client';
import { TOOL_CALL_TAG, TOOL_CALL_RENDERED_CLASS } from '../constants';
import { BusyObserver } from '../observers/busy-observer';
import { showSkeleton, removeSkeleton, type SkeletonEntry } from '../rendering/skeleton';
import { renderToolCalls } from '../rendering/tool-call-renderer';

/** After aria-busy=false, wait this long for content to stabilize */
const POST_STREAM_STABILITY_MS = 500;

export class ModelResponseHandler {
  private skeletons = new Map<HTMLElement, SkeletonEntry>();
  private stabilityTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  private reactRoots: ReactDOM.Root[] = [];
  private busyObserver: BusyObserver;
  private rendered = new WeakSet<HTMLElement>();

  constructor() {
    this.busyObserver = new BusyObserver();
  }

  start(): void {
    this.busyObserver.start((modelResp) => this.onStreamingComplete(modelResp));
  }

  stop(): void {
    this.busyObserver.stop();
    this.cleanupStabilityTimers();
    this.cleanupSkeletons();
    this.cleanupReactRoots();
  }

  /**
   * Attempt to process a model-response. Returns true if handled.
   */
  tryProcess(el: HTMLElement): boolean {
    const markdownEl = el.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return false;

    const isBusy = markdownEl.getAttribute('aria-busy') === 'true';
    const allText = markdownEl.textContent || '';
    const hasToolCall = allText.includes(`<${TOOL_CALL_TAG}>`);

    if (isBusy) {
      this.busyObserver.trackStreaming(el);
      if (hasToolCall && !this.skeletons.has(el)) {
        showSkeleton(el, markdownEl, this.skeletons);
      }
      return true;
    }

    if (!hasToolCall) {
      this.rendered.add(el);
      return true;
    }

    // Already rendered and content intact?
    if (this.rendered.has(el) && !this.hasLostRendering(el)) {
      return true;
    }

    this.scheduleStableRender(el);
    return true;
  }

  /**
   * Detect if rendering was lost (Angular rebuilt the element).
   */
  hasLostRendering(el: HTMLElement): boolean {
    const markdownEl = el.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return false;
    return markdownEl.textContent?.includes(`<${TOOL_CALL_TAG}>`) ?? false;
  }

  // ─── Streaming Complete ──────────────────────────────────────────────

  private onStreamingComplete(modelResp: HTMLElement): void {
    const markdownEl = modelResp.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return;

    const currentContent = markdownEl.textContent || '';
    const skeleton = this.skeletons.get(modelResp);

    if (skeleton) {
      skeleton.lastContent = currentContent;
      if (skeleton.stabilityTimer) clearTimeout(skeleton.stabilityTimer);
      skeleton.stabilityTimer = setTimeout(() => {
        this.checkStabilityAndRender(modelResp);
      }, POST_STREAM_STABILITY_MS);
    } else {
      this.scheduleStableRender(modelResp);
    }
  }

  private checkStabilityAndRender(modelResp: HTMLElement): void {
    const markdownEl = modelResp.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return;

    const skeleton = this.skeletons.get(modelResp);
    if (!skeleton) {
      this.scheduleStableRender(modelResp);
      return;
    }

    const currentContent = markdownEl.textContent || '';
    if (currentContent !== skeleton.lastContent) {
      skeleton.lastContent = currentContent;
      skeleton.stabilityTimer = setTimeout(() => {
        this.checkStabilityAndRender(modelResp);
      }, POST_STREAM_STABILITY_MS);
      return;
    }

    removeSkeleton(modelResp, this.skeletons);
    this.renderStable(modelResp, markdownEl, currentContent);
  }

  private scheduleStableRender(el: HTMLElement): void {
    const existingTimer = this.stabilityTimers.get(el);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.stabilityTimers.delete(el);
      const markdownEl = el.querySelector('.markdown') as HTMLElement;
      if (!markdownEl) return;
      const text = markdownEl.textContent || '';
      if (!text.includes(`<${TOOL_CALL_TAG}>`)) return;
      this.renderStable(el, markdownEl, text);
    }, POST_STREAM_STABILITY_MS);
    this.stabilityTimers.set(el, timer);
  }

  // ─── Stable Render ───────────────────────────────────────────────────

  private renderStable(modelResp: HTMLElement, markdownEl: HTMLElement, allText: string): void {
    if (!allText.includes(`<${TOOL_CALL_TAG}>`)) return;

    // Already rendered and intact?
    if (this.rendered.has(modelResp) && !this.hasLostRendering(modelResp)) return;

    // Clear previous class if re-rendering
    modelResp.classList.remove(TOOL_CALL_RENDERED_CLASS);

    console.log('[ModelResponseHandler] renderStable');
    this.rendered.add(modelResp);

    const roots = renderToolCalls(modelResp, markdownEl, allText);
    this.reactRoots.push(...roots);
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  private cleanupStabilityTimers(): void {
    for (const [, timer] of this.stabilityTimers) clearTimeout(timer);
    this.stabilityTimers.clear();
  }

  private cleanupSkeletons(): void {
    for (const [, entry] of this.skeletons) {
      for (const el of entry.hiddenElements) {
        el.style.visibility = '';
      }
      entry.overlayEl.remove();
      if (entry.stabilityTimer) clearTimeout(entry.stabilityTimer);
    }
    this.skeletons.clear();
  }

  private cleanupReactRoots(): void {
    this.reactRoots.forEach((root) => {
      try { root.unmount(); } catch { /* already unmounted */ }
    });
    this.reactRoots = [];
  }
}
