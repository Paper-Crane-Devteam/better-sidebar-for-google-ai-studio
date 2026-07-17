/**
 * ConversationRenderer — Orchestrator for agent loop message rendering.
 *
 * Architecture:
 * 1. DOM interception (appendChild/insertBefore patching) for zero-latency detection
 * 2. Per-element content watchers for elements inserted before content is ready
 * 3. BusyObserver for streaming completion detection
 * 4. Shadow DOM rendering for tool call widgets
 *
 * This file is a thin coordinator — actual logic lives in:
 * - observers/dom-interceptor.ts    — DOM method patching
 * - observers/busy-observer.ts      — aria-busy tracking
 * - observers/element-watcher.ts    — content readiness watchers
 * - handlers/user-query-handler.ts  — user-query rendering
 * - handlers/model-response-handler.ts — model-response + tool call rendering
 */

import { PROMPT_RENDERED_CLASS } from './constants';
import { patchDOMMethods, unpatchDOMMethods } from './observers/dom-interceptor';
import { ElementWatcherManager } from './observers/element-watcher';
import { tryRenderUserQuery, hasLostUserQueryRendering } from './handlers/user-query-handler';
import { ModelResponseHandler } from './handlers/model-response-handler';

const SCROLLER_SELECTOR = 'infinite-scroller.chat-history';

export class ConversationRenderer {
  private started = false;
  private elementWatchers = new ElementWatcherManager();
  private modelHandler = new ModelResponseHandler();
  private renderedUserQueries = new WeakSet<HTMLElement>();

  // ─── Public API ──────────────────────────────────────────────────────

  start(): void {
    if (this.started) return;
    this.started = true;
    console.log('[Renderer] start()');

    patchDOMMethods((el) => this.onElementInserted(el));
    this.modelHandler.start();
    this.scanExisting();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    console.log('[Renderer] stop()');

    unpatchDOMMethods();
    this.modelHandler.stop();
    this.elementWatchers.cleanup();
  }

  reattach(): void {
    console.log('[Renderer] reattach()');
    this.elementWatchers.cleanup();
    this.scanExisting();
  }

  scanExisting(): void {
    const scroller = document.querySelector(SCROLLER_SELECTOR) as HTMLElement | null;
    if (!scroller) return;

    scroller.querySelectorAll('user-query').forEach((el) => {
      this.onElementInserted(el as HTMLElement);
    });
    scroller.querySelectorAll('model-response').forEach((el) => {
      this.onElementInserted(el as HTMLElement);
    });
  }

  // ─── Element Insertion Handler ─────────────────────────────────────

  private onElementInserted(el: HTMLElement): void {
    const tag = el.tagName;
    if (tag === 'USER-QUERY') {
      this.handleUserQuery(el);
    } else if (tag === 'MODEL-RESPONSE') {
      this.handleModelResponse(el);
    }
  }

  // ─── User Query ────────────────────────────────────────────────────

  private handleUserQuery(el: HTMLElement): void {
    // Already rendered and intact — skip
    if (this.renderedUserQueries.has(el) && !hasLostUserQueryRendering(el)) {
      return;
    }

    // Lost rendering? Clear class for re-render
    if (el.classList.contains(PROMPT_RENDERED_CLASS)) {
      if (hasLostUserQueryRendering(el)) {
        el.classList.remove(PROMPT_RENDERED_CLASS);
      } else {
        this.renderedUserQueries.add(el);
        return;
      }
    }

    // Try immediate render
    if (tryRenderUserQuery(el)) {
      this.renderedUserQueries.add(el);
      return;
    }

    // Content not ready — watch for it
    this.elementWatchers.watch(el, () => {
      const success = tryRenderUserQuery(el);
      if (success) this.renderedUserQueries.add(el);
      return success;
    });
  }

  // ─── Model Response ────────────────────────────────────────────────

  private handleModelResponse(el: HTMLElement): void {
    if (this.modelHandler.tryProcess(el)) return;

    // .markdown not ready — watch for it
    this.elementWatchers.watch(el, () => this.modelHandler.tryProcess(el));
  }
}
