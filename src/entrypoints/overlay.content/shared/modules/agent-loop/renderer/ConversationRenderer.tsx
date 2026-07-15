/**
 * ConversationRenderer — DOM observer for agent loop messages.
 *
 * Rendering strategy for tool calls (方案2+方案1 组合):
 *
 * Streaming phase:
 *   - Detect <bs_agent_tool> in streaming response
 *   - Set the containing element to visibility:hidden (preserves layout)
 *   - Show a skeleton overlay (absolute positioned at same location)
 *
 * Stable phase:
 *   - aria-busy transitions to false + 500ms content stability check
 *   - Remove skeleton overlay
 *   - attachShadow on the original element, render widget inside
 *   - Angular won't delete the element (it's part of its own tree)
 *     and shadow DOM prevents Angular's content writes from showing
 */

import ReactDOM from 'react-dom/client';
import mainStyles from '@/index.scss?inline';
import { applyShadowStyles } from '@/shared/lib/utils';
import { createClickableCapsule } from '@/entrypoints/overlay.content/shared/lib/capsule-modal';
import { ShadowRootProvider } from '@/shared/components/ShadowRootContext';
import {
  getEditor as quillGetEditor,
  appendCapsule,
  buildPromptCapsuleText,
  buildResultCapsuleText,
  CAPSULE_CLASS,
  CAPSULE_ATTR_CONTENT,
  RESULT_CAPSULE_CLASS,
  RESULT_CAPSULE_ATTR_CONTENT,
} from '@/entrypoints/overlay.content/shared/lib/quill-editor';
import {
  PROMPT_MARKER_PREFIX,
  PROMPT_RENDERED_CLASS,
  TOOL_CALL_RENDERED_CLASS,
  TOOL_CALL_TAG,
  PROMPT_ID_ATTR,
  TOOL_CALL_ATTR,
  RESULT_TAG,
  extractPromptId,
} from './constants';
import { getBuiltInPromptById } from '../prompts/built-in-registry';
import { ToolCallWidget } from './components/ToolCallWidget';
import type { ParsedToolCall } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const CHAT_CONTAINER_SELECTOR = 'infinite-scroller.chat-history, .conversation-container, chat-window';
const SKELETON_OVERLAY_CLASS = 'bs-agent-skeleton-overlay';
const SKELETON_MARKER_ATTR = 'data-bs-skeleton';

/** After aria-busy=false, wait this long for content to stabilize */
const POST_STREAM_STABILITY_MS = 500;

/** For static renders (page load), debounce before rendering */
const STATIC_STABILITY_MS = 800;

// ─── Skeleton State ──────────────────────────────────────────────────────────

interface SkeletonEntry {
  modelResponse: HTMLElement;
  hiddenElements: HTMLElement[];
  overlayEl: HTMLElement;
  /** Content snapshot for stability check */
  lastContent: string;
  stabilityTimer: ReturnType<typeof setTimeout> | null;
}

// ─── Renderer Class ──────────────────────────────────────────────────────────

export class ConversationRenderer {
  private observer: MutationObserver | null = null;
  private container: HTMLElement | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private pendingResponses = new Set<HTMLElement>();
  private skeletons = new Map<HTMLElement, SkeletonEntry>();
  private stabilityTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  private reactRoots: ReactDOM.Root[] = [];

  start(): void {
    if (this.observer) return;
    console.log('[Renderer] start() called');
    this.observer = this.createObserver();
    this.attachToContainer();

    if (!this.container) {
      console.log('[Renderer] Container not found on start, polling...');
      this.pollInterval = setInterval(() => {
        if (this.attachToContainer()) {
          clearInterval(this.pollInterval!);
          this.pollInterval = null;
        }
      }, 1000);
      setTimeout(() => {
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }
      }, 60000);
    }
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.container = null;
    this.pendingResponses.clear();
    this.cleanupSkeletons();
    this.cleanupStabilityTimers();
    this.cleanupReactRoots();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  reattach(): void {
    console.log('[Renderer] reattach() called');
    this.observer?.disconnect();
    this.container = null;
    this.pendingResponses.clear();
    this.cleanupSkeletons();
    this.cleanupStabilityTimers();

    if (!this.observer) {
      this.observer = this.createObserver();
    }

    if (!this.attachToContainer()) {
      this.pollInterval = setInterval(() => {
        if (this.attachToContainer()) {
          clearInterval(this.pollInterval!);
          this.pollInterval = null;
        }
      }, 500);
      setTimeout(() => {
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }
      }, 30000);
    }
  }

  scanExisting(): void {
    const container = this.getConversationContainer();
    if (!container) return;
    const userQueries = container.querySelectorAll('user-query');
    const modelResponses = container.querySelectorAll('model-response');
    userQueries.forEach((el) => this.processUserQuery(el as HTMLElement));
    modelResponses.forEach((el) => this.processModelResponse(el as HTMLElement));
  }

  // ─── Observer Factory ──────────────────────────────────────────────

  private createObserver(): MutationObserver {
    return new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // New nodes added
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.processNode(node as HTMLElement);
          }
        }
        // aria-busy changed
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-busy') {
          const target = mutation.target as HTMLElement;
          if (target.getAttribute('aria-busy') === 'false') {
            const modelResp = target.closest('model-response') as HTMLElement | null;
            if (modelResp && this.pendingResponses.has(modelResp)) {
              this.pendingResponses.delete(modelResp);
              this.onStreamingComplete(modelResp);
            }
          }
        }
        // Content mutations during streaming — check for tool tags
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target as HTMLElement;
          const modelResp = target?.closest?.('model-response') as HTMLElement | null;
          if (modelResp && !modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) {
            this.checkForToolCall(modelResp);
          }
        }
      }
    });
  }

  // ─── Container ─────────────────────────────────────────────────────

  private attachToContainer(): boolean {
    const container = this.getConversationContainer();
    if (container && this.observer) {
      this.container = container;
      this.observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-busy'],
      });
      this.scanExisting();
      return true;
    }
    return false;
  }

  private getConversationContainer(): HTMLElement | null {
    return document.querySelector(CHAT_CONTAINER_SELECTOR);
  }

  // ─── Node Processing ───────────────────────────────────────────────

  private processNode(el: HTMLElement): void {
    if (el.matches?.('user-query')) this.processUserQuery(el);
    else if (el.matches?.('model-response')) this.processModelResponse(el);

    el.querySelectorAll?.('user-query')?.forEach((c) => this.processUserQuery(c as HTMLElement));
    el.querySelectorAll?.('model-response')?.forEach((c) => this.processModelResponse(c as HTMLElement));

    const parentModelResp = el.closest?.('model-response') as HTMLElement | null;
    if (parentModelResp && !parentModelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) {
      this.checkForToolCall(parentModelResp);
    }
  }

  // ─── User Query (unchanged) ────────────────────────────────────────

  private processUserQuery(el: HTMLElement): void {
    if (el.classList.contains(PROMPT_RENDERED_CLASS)) return;

    const textLines = el.querySelectorAll('.query-text-line');
    if (textLines.length === 0) return;

    const firstLine = textLines[0]?.textContent?.trim() || '';
    const fullText = Array.from(textLines).map((l) => l.textContent || '').join('\n');

    const hasPromptMarker = firstLine.startsWith(PROMPT_MARKER_PREFIX);
    const hasResult = fullText.includes(`<${RESULT_TAG}>`);

    if (!hasPromptMarker && !hasResult) return;

    el.classList.add(PROMPT_RENDERED_CLASS);

    if (hasPromptMarker) {
      this.renderPromptUserQuery(el, textLines, fullText);
    } else {
      this.renderResultUserQuery(el, textLines, fullText);
    }
  }

  private renderPromptUserQuery(
    el: HTMLElement,
    textLines: NodeListOf<Element>,
    fullText: string,
  ): void {
    const firstLine = textLines[0]?.textContent?.trim() || '';
    const promptId = extractPromptId(firstLine);
    if (!promptId) return;

    el.setAttribute(PROMPT_ID_ATTR, promptId);
    const prompt = getBuiltInPromptById(promptId);
    const title = prompt?.title || promptId;

    const userRequestSeparator = '## User Request';
    const separatorIdx = fullText.indexOf(userRequestSeparator);

    let capsuleContent: string;
    let userText: string | null = null;

    if (separatorIdx !== -1) {
      capsuleContent = fullText.slice(0, separatorIdx).trim();
      userText = fullText.slice(separatorIdx + userRequestSeparator.length).trim();
    } else {
      capsuleContent = fullText;
    }

    textLines.forEach((line) => {
      (line as HTMLElement).style.display = 'none';
    });

    const insertTarget = textLines[0]?.parentElement || el;

    const displayText = buildPromptCapsuleText(title);
    const capsuleEl = createClickableCapsule(displayText, {
      className: CAPSULE_CLASS,
      dataAttrs: { [CAPSULE_ATTR_CONTENT]: capsuleContent } as Record<string, string>,
      nonEditable: true,
    }, capsuleContent);

    const wrapper = document.createElement('div');
    wrapper.appendChild(capsuleEl);

    if (userText) {
      const userTextEl = document.createElement('div');
      userTextEl.className = 'query-text-line';
      userTextEl.textContent = userText;
      wrapper.appendChild(userTextEl);
    }

    insertTarget.insertBefore(wrapper, insertTarget.firstChild);
  }

  private renderResultUserQuery(
    el: HTMLElement,
    textLines: NodeListOf<Element>,
    fullText: string,
  ): void {
    textLines.forEach((line) => {
      (line as HTMLElement).style.display = 'none';
    });

    const insertTarget = textLines[0]?.parentElement || el;
    const wrapper = document.createElement('div');

    const resultRegex = new RegExp(
      `<${RESULT_TAG}>([\\s\\S]*?)<\\/${RESULT_TAG}>`,
      'g',
    );

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = resultRegex.exec(fullText)) !== null) {
      const beforeText = fullText.slice(lastIndex, match.index).trim();
      if (beforeText) {
        const textEl = document.createElement('div');
        textEl.className = 'query-text-line';
        textEl.textContent = beforeText;
        wrapper.appendChild(textEl);
      }

      const resultContent = match[1].trim();
      const headingMatch = resultContent.match(/^### (.+)/m);
      const label = headingMatch ? headingMatch[1].trim() : 'Tool Result';

      const displayText = buildResultCapsuleText(label);
      const capsuleEl = createClickableCapsule(displayText, {
        className: RESULT_CAPSULE_CLASS,
        dataAttrs: { [RESULT_CAPSULE_ATTR_CONTENT]: resultContent } as Record<string, string>,
        nonEditable: true,
      }, resultContent);
      wrapper.appendChild(capsuleEl);

      lastIndex = match.index + match[0].length;
    }

    const afterText = fullText.slice(lastIndex).trim();
    if (afterText) {
      const textEl = document.createElement('div');
      textEl.className = 'query-text-line';
      textEl.textContent = afterText;
      wrapper.appendChild(textEl);
    }

    insertTarget.insertBefore(wrapper, insertTarget.firstChild);
  }

  // ─── Model Response: Entry Point ───────────────────────────────────

  private processModelResponse(el: HTMLElement): void {
    if (el.classList.contains(TOOL_CALL_RENDERED_CLASS)) return;

    const markdownEl = el.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return;

    const isBusy = markdownEl.getAttribute('aria-busy') === 'true';
    if (isBusy) {
      this.pendingResponses.add(el);
      this.checkForToolCall(el);
      return;
    }

    const allText = markdownEl.textContent || '';
    if (!allText.includes(`<${TOOL_CALL_TAG}>`)) return;

    // Static path: debounce then render
    this.scheduleStableRender(el);
  }

  // ─── Streaming Detection: Show Skeleton ────────────────────────────

  /**
   * Check if a model-response contains a tool call tag.
   * If streaming (aria-busy=true) and tool call found → show skeleton.
   */
  private checkForToolCall(modelResp: HTMLElement): void {
    if (modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) return;
    if (this.skeletons.has(modelResp)) return; // Already showing skeleton

    const markdownEl = modelResp.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return;

    const isBusy = markdownEl.getAttribute('aria-busy') === 'true';
    if (!isBusy) return; // Static content goes through processModelResponse

    const allText = markdownEl.textContent || '';
    if (!allText.includes(`<${TOOL_CALL_TAG}>`)) return;

    this.showSkeleton(modelResp, markdownEl);
  }

  /**
   * Show skeleton overlay:
   * 1. Find elements containing the tool call tag
   * 2. Set visibility:hidden on them (preserves layout space)
   * 3. Create an absolute-positioned skeleton overlay at the model-response level
   */
  private showSkeleton(modelResp: HTMLElement, markdownEl: HTMLElement): void {
    const openTag = `<${TOOL_CALL_TAG}>`;
    const hiddenElements: HTMLElement[] = [];

    // Find and hide elements containing tool tags
    for (const child of markdownEl.children) {
      const el = child as HTMLElement;
      if (el.textContent?.includes(openTag)) {
        el.style.visibility = 'hidden';
        el.setAttribute(SKELETON_MARKER_ATTR, 'true');
        hiddenElements.push(el);
      }
    }

    if (hiddenElements.length === 0) return;

    // Create skeleton overlay — positioned relative to model-response
    const overlay = document.createElement('div');
    overlay.className = SKELETON_OVERLAY_CLASS;
    overlay.style.cssText = `
      position: relative;
      margin: 8px 0;
      border-radius: 8px;
      overflow: hidden;
      height: 48px;
      background: linear-gradient(90deg, 
        var(--skeleton-bg, rgba(128,128,128,0.08)) 25%, 
        var(--skeleton-shine, rgba(128,128,128,0.15)) 50%, 
        var(--skeleton-bg, rgba(128,128,128,0.08)) 75%
      );
      background-size: 200% 100%;
      animation: bs-skeleton-shimmer 1.5s ease-in-out infinite;
      border: 1px solid rgba(128,128,128,0.1);
    `;

    // Inject keyframes if not already
    if (!document.getElementById('bs-skeleton-keyframes')) {
      const style = document.createElement('style');
      style.id = 'bs-skeleton-keyframes';
      style.textContent = `
        @keyframes bs-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `;
      document.head.appendChild(style);
    }

    // Insert overlay after the last hidden element (inside .markdown, but as a non-text sibling)
    const lastHidden = hiddenElements[hiddenElements.length - 1];
    lastHidden.insertAdjacentElement('afterend', overlay);

    const entry: SkeletonEntry = {
      modelResponse: modelResp,
      hiddenElements,
      overlayEl: overlay,
      lastContent: markdownEl.textContent || '',
      stabilityTimer: null,
    };
    this.skeletons.set(modelResp, entry);
  }

  // ─── Streaming Complete: Transition to Stable ──────────────────────

  /**
   * Called when aria-busy transitions to false.
   * Start stability check — wait POST_STREAM_STABILITY_MS,
   * verify content hasn't changed, then render stable widget.
   */
  private onStreamingComplete(modelResp: HTMLElement): void {
    if (modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) return;

    const markdownEl = modelResp.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return;

    const currentContent = markdownEl.textContent || '';

    const skeleton = this.skeletons.get(modelResp);
    if (skeleton) {
      skeleton.lastContent = currentContent;
      // Start stability timer
      if (skeleton.stabilityTimer) clearTimeout(skeleton.stabilityTimer);
      skeleton.stabilityTimer = setTimeout(() => {
        this.checkStabilityAndRender(modelResp);
      }, POST_STREAM_STABILITY_MS);
    } else {
      // No skeleton was shown (maybe tool call appeared right at the end)
      this.scheduleStableRender(modelResp);
    }
  }

  /**
   * After POST_STREAM_STABILITY_MS, check if content is still the same.
   * If yes → render. If changed → wait again.
   */
  private checkStabilityAndRender(modelResp: HTMLElement): void {
    if (modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) return;

    const markdownEl = modelResp.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return;

    const skeleton = this.skeletons.get(modelResp);
    if (!skeleton) {
      this.scheduleStableRender(modelResp);
      return;
    }

    const currentContent = markdownEl.textContent || '';
    if (currentContent !== skeleton.lastContent) {
      // Content still changing — reset timer
      skeleton.lastContent = currentContent;
      skeleton.stabilityTimer = setTimeout(() => {
        this.checkStabilityAndRender(modelResp);
      }, POST_STREAM_STABILITY_MS);
      return;
    }

    // Content stable — render!
    this.removeSkeleton(modelResp);
    this.renderStable(modelResp, markdownEl, currentContent);
  }

  /**
   * For static pages (not streaming), simple debounce then render.
   */
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
    }, STATIC_STABILITY_MS);
    this.stabilityTimers.set(el, timer);
  }

  // ─── Stable Render: Shadow DOM on Original Element ─────────────────

  /**
   * Final render — uses attachShadow on the original <p> element.
   * The element stays in Angular's tree (won't be removed),
   * but shadow DOM takes over its visual rendering.
   */
  private renderStable(modelResp: HTMLElement, markdownEl: HTMLElement, allText: string): void {
    if (modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) return;
    if (!allText.includes(`<${TOOL_CALL_TAG}>`)) return;

    console.log('[Renderer] renderStable — rendering');
    modelResp.classList.add(TOOL_CALL_RENDERED_CLASS);
    modelResp.setAttribute(TOOL_CALL_ATTR, 'true');

    const openTag = `<${TOOL_CALL_TAG}>`;
    let widgetIdx = 0;

    for (const child of Array.from(markdownEl.children)) {
      const candidate = child as HTMLElement;
      const text = candidate.textContent || '';
      if (!text.includes(openTag)) continue;

      // Extract tool calls from this element
      const localRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`, 'g');
      let localMatch: RegExpExecArray | null;
      const localToolCalls: Array<{ fullMatch: string; content: string }> = [];
      while ((localMatch = localRegex.exec(text)) !== null) {
        localToolCalls.push({ fullMatch: localMatch[0], content: localMatch[1].trim() });
      }

      if (localToolCalls.length === 0) continue;

      // Try to attach shadow DOM to the element
      try {
        // Clear original content (shadow takes over rendering)
        candidate.textContent = '';
        candidate.style.visibility = 'visible';
        candidate.removeAttribute(SKELETON_MARKER_ATTR);

        // Style the host element
        candidate.style.display = 'block';
        candidate.style.padding = '0';
        candidate.style.margin = '8px 0';

        const shadow = candidate.attachShadow({ mode: 'open' });
        applyShadowStyles(shadow, mainStyles);

        const rootContainer = document.createElement('div');
        rootContainer.className = 'shadow-body';
        shadow.appendChild(rootContainer);
        this.syncDarkMode(rootContainer);

        const reactRoot = ReactDOM.createRoot(rootContainer);
        this.reactRoots.push(reactRoot);

        const widgets = localToolCalls.map((tc, i) => {
          const { toolName, description, query } = this.extractToolInfo(tc.fullMatch);
          return (
            <ToolCallWidget
              key={`${widgetIdx}-${i}`}
              toolName={toolName}
              description={description}
              query={query}
              rawText={tc.fullMatch}
              parseToolCall={this.parseToolCallFromText.bind(this)}
              executeToolCall={this.executeToolCallFn.bind(this)}
              fillResultToEditor={this.fillResultToEditor.bind(this)}
            />
          );
        });

        reactRoot.render(
          <ShadowRootProvider container={rootContainer}>
            <div className="py-1">{widgets}</div>
          </ShadowRootProvider>,
        );

        widgetIdx++;
      } catch (e) {
        // attachShadow can fail if element already has shadow or is invalid host
        console.warn('[Renderer] attachShadow failed, falling back to insertAdjacentElement', e);
        this.renderFallback(modelResp, candidate, localToolCalls, widgetIdx);
        widgetIdx++;
      }
    }
  }

  /**
   * Fallback: if attachShadow fails, use the old approach (insert sibling).
   */
  private renderFallback(
    modelResp: HTMLElement,
    candidate: HTMLElement,
    localToolCalls: Array<{ fullMatch: string; content: string }>,
    widgetIdx: number,
  ): void {
    candidate.style.display = 'none';

    const host = document.createElement('div');
    host.className = 'bs-agent-shadow-host';
    candidate.insertAdjacentElement('afterend', host);

    const shadow = host.attachShadow({ mode: 'open' });
    applyShadowStyles(shadow, mainStyles);

    const rootContainer = document.createElement('div');
    rootContainer.className = 'shadow-body';
    shadow.appendChild(rootContainer);
    this.syncDarkMode(rootContainer);

    const reactRoot = ReactDOM.createRoot(rootContainer);
    this.reactRoots.push(reactRoot);

    const widgets = localToolCalls.map((tc, i) => {
      const { toolName, description, query } = this.extractToolInfo(tc.fullMatch);
      return (
        <ToolCallWidget
          key={`${widgetIdx}-${i}`}
          toolName={toolName}
          description={description}
          query={query}
          rawText={tc.fullMatch}
          parseToolCall={this.parseToolCallFromText.bind(this)}
          executeToolCall={this.executeToolCallFn.bind(this)}
          fillResultToEditor={this.fillResultToEditor.bind(this)}
        />
      );
    });

    reactRoot.render(
      <ShadowRootProvider container={rootContainer}>
        <div className="py-1">{widgets}</div>
      </ShadowRootProvider>,
    );
  }

  // ─── Skeleton Cleanup ──────────────────────────────────────────────

  private removeSkeleton(modelResp: HTMLElement): void {
    const skeleton = this.skeletons.get(modelResp);
    if (!skeleton) return;

    // Restore hidden elements visibility (renderStable will handle them)
    for (const el of skeleton.hiddenElements) {
      el.style.visibility = '';
      el.removeAttribute(SKELETON_MARKER_ATTR);
    }

    // Remove overlay
    skeleton.overlayEl.remove();

    if (skeleton.stabilityTimer) clearTimeout(skeleton.stabilityTimer);
    this.skeletons.delete(modelResp);
  }

  // ─── Tool Execution Helpers ────────────────────────────────────────

  private parseToolCallFromText(text: string): ParsedToolCall | null {
    const tagRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`);
    const tagContent = text.match(tagRegex);
    const content = tagContent ? tagContent[1].trim() : text.trim();

    if (content.startsWith('{')) {
      try {
        const obj = JSON.parse(content);
        if (typeof obj.name !== 'string') return null;
        return {
          name: obj.name.trim(),
          description: typeof obj.description === 'string' ? obj.description.trim() : undefined,
          params: typeof obj.params === 'object' && obj.params !== null
            ? Object.fromEntries(Object.entries(obj.params).map(([k, v]) => [k, String(v)]))
            : {},
        };
      } catch { /* fall through */ }
    }

    const knownTools = ['execute_sql', 'sync_conversation_messages', 'export', 'complete_task'];
    for (const tool of knownTools) {
      if (content.startsWith(tool)) {
        const rest = content.slice(tool.length).trim();
        if (tool === 'execute_sql') {
          const sqlMatch = rest.match(/(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*/i);
          if (sqlMatch) {
            return { name: tool, description: rest.slice(0, sqlMatch.index).trim() || undefined, params: { query: sqlMatch[0].trim() } };
          }
        }
        if (tool === 'complete_task') {
          return { name: tool, description: undefined, params: { summary: rest } };
        }
        return { name: tool, description: undefined, params: {} };
      }
    }
    return null;
  }

  private async executeToolCallFn(parsed: ParsedToolCall): Promise<string> {
    const { executeToolCall } = await import('../tools/tool-registry');
    return executeToolCall(parsed);
  }

  private fillResultToEditor(toolName: string, result: string): void {
    const editor = quillGetEditor();
    if (!editor) return;

    const content = `### ${toolName}\n${result}`;
    const displayText = buildResultCapsuleText(toolName);

    appendCapsule(editor, displayText, {
      className: RESULT_CAPSULE_CLASS,
      dataAttrs: { [RESULT_CAPSULE_ATTR_CONTENT]: content },
      nonEditable: true,
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private extractToolInfo(text: string): { toolName: string; description: string; query: string } {
    const tagRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`);
    const tagContent = text.match(tagRegex);
    const content = tagContent ? tagContent[1].trim() : text.trim();

    if (content.startsWith('{')) {
      try {
        const obj = JSON.parse(content);
        return {
          toolName: obj.name || 'unknown',
          description: obj.description || '',
          query: obj.params?.query || obj.params?.summary || '',
        };
      } catch { /* fall through */ }
    }

    const knownTools = ['execute_sql', 'sync_conversation_messages', 'export', 'complete_task'];
    for (const tool of knownTools) {
      if (content.startsWith(tool)) {
        const rest = content.slice(tool.length).trim();
        const sqlMatch = rest.match(/(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*/i);
        if (sqlMatch) {
          return { toolName: tool, description: rest.slice(0, sqlMatch.index).trim(), query: sqlMatch[0].trim() };
        }
        return { toolName: tool, description: '', query: rest };
      }
    }
    return { toolName: 'tool_call', description: '', query: '' };
  }

  private syncDarkMode(root: HTMLElement): void {
    const applyDark = () => {
      const themeValue = localStorage.getItem('Bard-Color-Theme');
      const isDark = themeValue
        ? themeValue === 'Bard-Dark-Theme'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', isDark);
    };
    applyDark();
    window.addEventListener('storage', (e) => {
      if (e.key === 'Bard-Color-Theme') applyDark();
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDark);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────

  private cleanupSkeletons(): void {
    for (const [, entry] of this.skeletons) {
      for (const el of entry.hiddenElements) {
        el.style.visibility = '';
        el.removeAttribute(SKELETON_MARKER_ATTR);
      }
      entry.overlayEl.remove();
      if (entry.stabilityTimer) clearTimeout(entry.stabilityTimer);
    }
    this.skeletons.clear();
  }

  private cleanupStabilityTimers(): void {
    for (const [, timer] of this.stabilityTimers) clearTimeout(timer);
    this.stabilityTimers.clear();
  }

  private cleanupReactRoots(): void {
    this.reactRoots.forEach((root) => {
      try { root.unmount(); } catch { /* already unmounted */ }
    });
    this.reactRoots = [];
  }
}
