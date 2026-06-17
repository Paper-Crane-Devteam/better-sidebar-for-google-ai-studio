/**
 * ConversationRenderer — DOM observer for agent loop messages.
 *
 * Strategy: For each detected agent element, create a Shadow DOM wrapper
 * next to the original (hidden) DOM. Inside the shadow we have full Tailwind.
 *
 * Key insight from Gemini DOM structure:
 * - model-response > .response-content > structured-content-container >
 *   message-content > .markdown > p elements
 * - Tool calls appear as escaped text in <p> elements:
 *   &lt;bs_agent_tool&gt;...&lt;/bs_agent_tool&gt;
 * - The .markdown div has aria-busy="true" while streaming, "false" when done.
 *
 * Streaming Tool Call Rendering (borrowed from MCP-SuperAssistant):
 * - Detects `<bs_agent_tool>` opening tag DURING streaming (aria-busy="true")
 * - Immediately mounts a loading widget without waiting for stream to complete
 * - Attaches a per-element MutationObserver to track incremental content
 * - Transitions widget to "complete" state once closing tag is detected
 * - Uses debounced updates to prevent render jitter
 */

import mainStyles from '@/index.scss?inline';
import { applyShadowStyles } from '@/shared/lib/utils';
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
import { RENDERER_CSS } from './renderer-styles';

// ─── Streaming Widget CSS ────────────────────────────────────────────────────

/**
 * Additional CSS for the streaming tool call widget.
 * The spinner animation and smooth transitions for the loading state.
 */
const STREAMING_WIDGET_CSS = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }
  .bs-streaming-widget {
    transition: border-color 0.3s ease, background-color 0.3s ease;
  }
`;

// ─── Streaming Tool Call State ───────────────────────────────────────────────

/** Tracks a single streaming tool call block being progressively rendered */
interface StreamingToolBlock {
  /** The model-response element containing this tool call */
  modelResponse: HTMLElement;
  /** The markdown element being streamed into */
  markdownEl: HTMLElement;
  /** The shadow host we mounted for this streaming block */
  shadowHost: HTMLElement;
  /** Root element inside shadow DOM */
  shadowRoot: HTMLElement;
  /** Per-block MutationObserver watching for content growth */
  observer: MutationObserver;
  /** Last known text content length — used for chunk detection */
  lastContentLength: number;
  /** Whether the closing tag has been detected */
  isComplete: boolean;
  /** Debounce timer for rendering updates */
  debounceTimer: ReturnType<typeof setTimeout> | null;
  /** Paragraphs belonging to this tool call (populated once complete) */
  paragraphs: HTMLElement[];
}

/** Render debounce interval during streaming (ms) */
const STREAM_RENDER_DEBOUNCE_MS = 80;

/** Stability interval — how long after last mutation before marking "stalled" */
const STREAM_STALL_TIMEOUT_MS = 3000;

export class ConversationRenderer {
  private observer: MutationObserver | null = null;
  private container: HTMLElement | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  /** Track model-response elements waiting for streaming to complete */
  private pendingResponses = new Set<HTMLElement>();
  /** Active streaming tool call blocks being progressively rendered */
  private streamingBlocks = new Map<HTMLElement, StreamingToolBlock>();

  start(): void {
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.processNode(node as HTMLElement);
          }
        }
        // When attributes change (aria-busy), check pending responses
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-busy') {
          const target = mutation.target as HTMLElement;
          if (target.getAttribute('aria-busy') === 'false') {
            // Find the model-response ancestor
            const modelResp = target.closest('model-response') as HTMLElement | null;
            if (modelResp && this.pendingResponses.has(modelResp)) {
              this.pendingResponses.delete(modelResp);
              this.processModelResponse(modelResp);
            }
            // Also finalize any streaming blocks for this model-response
            if (modelResp) {
              this.finalizeStreamingBlock(modelResp);
            }
          }
        }
        // Detect streaming tool call content during characterData or childList mutations
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = (mutation.target as HTMLElement);
          const modelResp = target?.closest?.('model-response') as HTMLElement | null;
          if (modelResp && !modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) {
            this.checkStreamingToolCall(modelResp);
          }
        }
      }
    });

    this.attachToContainer();

    if (!this.container) {
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
    // Clean up all active streaming blocks
    for (const [, block] of this.streamingBlocks) {
      block.observer?.disconnect();
      if (block.debounceTimer) clearTimeout(block.debounceTimer);
      block.shadowHost?.remove();
    }
    this.streamingBlocks.clear();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /** Scan all existing messages (page load / SPA navigation) */
  scanExisting(): void {
    const container = this.getConversationContainer();
    if (!container) return;
    container.querySelectorAll('user-query').forEach((el) =>
      this.processUserQuery(el as HTMLElement),
    );
    container.querySelectorAll('model-response').forEach((el) =>
      this.processModelResponse(el as HTMLElement),
    );
  }

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
    return document.querySelector(
      'infinite-scroller.chat-history, .conversation-container, chat-window',
    );
  }

  private processNode(el: HTMLElement): void {
    // Direct match
    if (el.matches?.('user-query')) {
      this.processUserQuery(el);
    } else if (el.matches?.('model-response')) {
      this.processModelResponse(el);
    }

    // Check children
    el.querySelectorAll?.('user-query')?.forEach((c) =>
      this.processUserQuery(c as HTMLElement),
    );
    el.querySelectorAll?.('model-response')?.forEach((c) =>
      this.processModelResponse(c as HTMLElement),
    );

    // Also check if this node is INSIDE a model-response (e.g. a <p> was added)
    // This handles the case where streaming adds new paragraphs
    const parentModelResp = el.closest?.('model-response') as HTMLElement | null;
    if (parentModelResp && !parentModelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) {
      this.processModelResponse(parentModelResp);
    }
  }

  // ─── User Query ────────────────────────────────────────────────────

  private processUserQuery(el: HTMLElement): void {
    if (el.classList.contains(PROMPT_RENDERED_CLASS)) return;

    const textLines = el.querySelectorAll('.query-text-line');
    if (textLines.length === 0) return;

    const firstLine = textLines[0]?.textContent?.trim() || '';

    if (firstLine.startsWith(PROMPT_MARKER_PREFIX)) {
      const promptId = extractPromptId(firstLine);
      if (!promptId) return;
      el.classList.add(PROMPT_RENDERED_CLASS);
      el.setAttribute(PROMPT_ID_ATTR, promptId);
      const prompt = getBuiltInPromptById(promptId);
      const title = prompt?.title || promptId;
      this.mountShadowWidget(el, textLines, 'prompt', title);
      return;
    }

    const fullText = Array.from(textLines).map((l) => l.textContent || '').join('\n');
    if (fullText.includes(`<${RESULT_TAG}>`)) {
      el.classList.add(PROMPT_RENDERED_CLASS);
      this.mountShadowWidget(el, textLines, 'result', 'Tool Results');
    }
  }

  // ─── Model Response ────────────────────────────────────────────────

  private processModelResponse(el: HTMLElement): void {
    if (el.classList.contains(TOOL_CALL_RENDERED_CLASS)) return;

    // Find the markdown container — this is where tool call text lives
    const markdownEl = el.querySelector('.markdown');
    if (!markdownEl) return;

    // Check if still streaming (aria-busy="true")
    const isBusy = markdownEl.getAttribute('aria-busy') === 'true';
    if (isBusy) {
      // Queue for aria-busy completion callback
      this.pendingResponses.add(el);
      // BUT — also check if we can start streaming rendering early
      this.checkStreamingToolCall(el);
      return;
    }

    // Check for tool call text in the rendered content
    const allText = markdownEl.textContent || '';
    if (!allText.includes(`<${TOOL_CALL_TAG}>`)) return;

    el.classList.add(TOOL_CALL_RENDERED_CLASS);
    el.setAttribute(TOOL_CALL_ATTR, 'true');

    this.renderToolCallWidgets(markdownEl as HTMLElement);
  }

  // ─── Streaming Tool Call Detection & Rendering ─────────────────────

  /**
   * Check if a model-response that is still streaming contains tool call markers.
   * If the opening tag is detected, immediately mount a loading widget.
   * Inspired by MCP-SuperAssistant's streamObserver approach.
   */
  private checkStreamingToolCall(modelResp: HTMLElement): void {
    // Already tracking this element or already fully rendered
    if (this.streamingBlocks.has(modelResp)) return;
    if (modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) return;

    const markdownEl = modelResp.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return;

    const allText = markdownEl.textContent || '';
    const openTag = `<${TOOL_CALL_TAG}>`;

    // Only proceed if we see the opening tag
    if (!allText.includes(openTag)) return;

    // Mount a streaming widget immediately
    const block = this.mountStreamingWidget(modelResp, markdownEl, allText);
    if (!block) return;

    this.streamingBlocks.set(modelResp, block);

    // Attach a per-element observer to track incremental content
    const streamObserver = new MutationObserver(() => {
      this.handleStreamingMutation(modelResp);
    });

    block.observer = streamObserver;
    streamObserver.observe(markdownEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /**
   * Handle mutation events on a streaming tool call block.
   * Debounced to prevent excessive re-renders during rapid streaming.
   */
  private handleStreamingMutation(modelResp: HTMLElement): void {
    const block = this.streamingBlocks.get(modelResp);
    if (!block || block.isComplete) return;

    // Debounce: clear previous timer and schedule a new check
    if (block.debounceTimer) {
      clearTimeout(block.debounceTimer);
    }

    block.debounceTimer = setTimeout(() => {
      this.updateStreamingWidget(block);
    }, STREAM_RENDER_DEBOUNCE_MS);
  }

  /**
   * Update the streaming widget with new content from the still-streaming DOM.
   */
  private updateStreamingWidget(block: StreamingToolBlock): void {
    const allText = block.markdownEl.textContent || '';
    const closeTag = `</${TOOL_CALL_TAG}>`;
    const openTag = `<${TOOL_CALL_TAG}>`;

    const currentLength = allText.length;

    // No new content — skip
    if (currentLength === block.lastContentLength) return;
    block.lastContentLength = currentLength;

    // Check if the tool call is now complete
    const openIdx = allText.indexOf(openTag);
    const closeIdx = allText.indexOf(closeTag, openIdx);
    const isComplete = closeIdx !== -1;

    // Extract partial content for display
    const contentStart = openIdx + openTag.length;
    const contentEnd = isComplete ? closeIdx : allText.length;
    const partialContent = allText.slice(contentStart, contentEnd).trim();

    // Update the widget UI
    const statusEl = block.shadowRoot.querySelector('.bs-stream-status') as HTMLElement;
    const previewEl = block.shadowRoot.querySelector('.bs-stream-preview') as HTMLElement;
    const toolNameEl = block.shadowRoot.querySelector('.bs-stream-tool-name') as HTMLElement;

    if (previewEl) {
      // Show a truncated preview of what's being streamed
      const preview = partialContent.length > 120
        ? partialContent.slice(0, 120) + '…'
        : partialContent;
      previewEl.textContent = preview;
    }

    // Try to extract tool name from partial content
    if (toolNameEl && partialContent.startsWith('{')) {
      try {
        // Try parsing partial JSON to extract the name field early
        const nameMatch = partialContent.match(/"name"\s*:\s*"([^"]+)"/);
        if (nameMatch) {
          toolNameEl.textContent = nameMatch[1];
        }
      } catch {
        // Partial JSON — will get it later
      }
    }

    if (isComplete) {
      block.isComplete = true;
      // Transition to complete state
      if (statusEl) {
        statusEl.textContent = '✅ 完成';
        statusEl.classList.remove('text-amber-500');
        statusEl.classList.add('text-emerald-500');
      }
      // Clean up the streaming observer — will be finalized by aria-busy or directly
      block.observer.disconnect();

      // If aria-busy is already false, finalize immediately
      const isBusy = block.markdownEl.getAttribute('aria-busy') === 'true';
      if (!isBusy) {
        this.finalizeStreamingBlock(block.modelResponse);
      }
    }
  }

  /**
   * Mount a streaming widget for a tool call that is still being generated.
   * Shows a "loading" state with a spinner and progressively reveals content.
   */
  private mountStreamingWidget(
    modelResp: HTMLElement,
    markdownEl: HTMLElement,
    currentText: string,
  ): StreamingToolBlock | null {
    // Find where the tool call starts in the DOM
    const paragraphs = Array.from(markdownEl.querySelectorAll('p'));
    const openTag = `<${TOOL_CALL_TAG}>`;

    let insertTarget: HTMLElement | null = null;
    for (const p of paragraphs) {
      if ((p.textContent || '').includes(openTag)) {
        insertTarget = p;
        break;
      }
    }

    if (!insertTarget) {
      // Fallback: insert before the markdown element itself
      insertTarget = markdownEl;
    }

    // Create shadow host
    const host = document.createElement('div');
    host.className = 'bs-agent-shadow-host bs-streaming-tool';
    host.setAttribute('data-streaming', 'true');
    const parent = insertTarget.parentElement || markdownEl;
    parent.insertBefore(host, insertTarget);

    const shadow = host.attachShadow({ mode: 'open' });
    applyShadowStyles(shadow, mainStyles + '\n' + RENDERER_CSS + '\n' + STREAMING_WIDGET_CSS);

    const root = document.createElement('div');
    root.className = 'shadow-body';
    shadow.appendChild(root);
    this.syncDarkMode(root);

    // Try to extract tool name early
    let earlyToolName = '…';
    const nameMatch = currentText.match(/"name"\s*:\s*"([^"]+)"/);
    if (nameMatch) {
      earlyToolName = nameMatch[1];
    }

    root.innerHTML = `
      <div class="bs-streaming-widget my-2 overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/5 transition-all duration-300">
        <div class="flex items-center gap-2 px-3 py-2 text-xs">
          <span class="bs-stream-spinner inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500"></span>
          <span class="flex h-5 w-5 items-center justify-center rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">⚙</span>
          <span class="bs-stream-tool-name font-mono font-medium text-amber-700 dark:text-amber-300 text-xs">${escapeHtml(earlyToolName)}</span>
          <span class="bs-stream-status ml-auto text-[11px] text-amber-500">⏳ 流式生成中...</span>
        </div>
        <div class="bs-stream-preview border-t border-amber-500/15 px-3 py-1.5 text-[11px] text-muted-foreground font-mono whitespace-pre-wrap max-h-[80px] overflow-hidden opacity-70"></div>
      </div>
    `;

    return {
      modelResponse: modelResp,
      markdownEl,
      shadowHost: host,
      shadowRoot: root,
      observer: null!, // Will be set by caller
      lastContentLength: currentText.length,
      isComplete: false,
      debounceTimer: null,
      paragraphs: [],
    };
  }

  /**
   * Finalize a streaming block: remove the streaming widget and do the full render.
   * Called when streaming completes (aria-busy="false" or closing tag detected with busy already false).
   */
  private finalizeStreamingBlock(modelResp: HTMLElement): void {
    const block = this.streamingBlocks.get(modelResp);
    if (!block) return;

    // Clean up
    block.observer?.disconnect();
    if (block.debounceTimer) clearTimeout(block.debounceTimer);

    // Remove the streaming widget
    block.shadowHost.remove();
    this.streamingBlocks.delete(modelResp);

    // Now do the full render (same as before — processModelResponse logic)
    if (!modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) {
      const markdownEl = modelResp.querySelector('.markdown') as HTMLElement;
      if (markdownEl) {
        const allText = markdownEl.textContent || '';
        if (allText.includes(`<${TOOL_CALL_TAG}>`)) {
          modelResp.classList.add(TOOL_CALL_RENDERED_CLASS);
          modelResp.setAttribute(TOOL_CALL_ATTR, 'true');
          this.renderToolCallWidgets(markdownEl);
        }
      }
    }
  }

  // ─── Shadow DOM Widget Mount ───────────────────────────────────────

  private mountShadowWidget(
    userQuery: HTMLElement,
    textLines: NodeListOf<Element>,
    type: 'prompt' | 'result',
    title: string,
  ): void {
    const insertTarget = textLines[0]?.parentElement || userQuery;

    // Hide original lines
    textLines.forEach((line) => {
      (line as HTMLElement).style.display = 'none';
    });

    // Create shadow host
    const host = document.createElement('div');
    host.className = 'bs-agent-shadow-host';
    insertTarget.insertBefore(host, insertTarget.firstChild);

    const shadow = host.attachShadow({ mode: 'open' });
    applyShadowStyles(shadow, mainStyles + '\n' + RENDERER_CSS);

    const root = document.createElement('div');
    root.className = 'shadow-body';
    shadow.appendChild(root);
    this.syncDarkMode(root);

    const isPrompt = type === 'prompt';
    const icon = isPrompt ? '⚡' : '📋';
    const colorClass = isPrompt
      ? 'border-primary/30 bg-primary/10 text-primary'
      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';

    root.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
        <span class="inline-flex items-center gap-1.5 rounded-full border ${colorClass} px-3 py-1 text-xs font-medium">
          <span class="text-sm">${icon}</span>
          <span>${escapeHtml(title)}</span>
        </span>
        <button class="bs-toggle-btn inline-flex items-center justify-center rounded-md p-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer" aria-label="Toggle">
          ▶
        </button>
      </div>
      <div class="bs-detail hidden mt-2 max-h-[250px] overflow-y-auto rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono"></div>
    `;

    const toggleBtn = root.querySelector('.bs-toggle-btn')!;
    const detail = root.querySelector('.bs-detail')! as HTMLElement;
    let expanded = false;

    toggleBtn.addEventListener('click', () => {
      expanded = !expanded;
      if (expanded) {
        detail.classList.remove('hidden');
        toggleBtn.textContent = '▼';
        const text = Array.from(textLines).map((l) => l.textContent || '').join('\n');
        detail.textContent = text;
      } else {
        detail.classList.add('hidden');
        toggleBtn.textContent = '▶';
        detail.textContent = '';
      }
    });
  }

  // ─── Tool Call Widgets ─────────────────────────────────────────────

  private renderToolCallWidgets(markdownEl: HTMLElement): void {
    const openTag = `<${TOOL_CALL_TAG}>`;
    const closeTag = `</${TOOL_CALL_TAG}>`;

    // Strategy: Find all text content, locate tool call blocks, and render widgets.
    // Gemini's DOM varies — tool calls may span multiple <p> elements or be in the same one.

    // First pass: collect all paragraphs/block elements that contain tool call text
    const blockElements = Array.from(markdownEl.querySelectorAll('p, pre, div, code'));
    if (blockElements.length === 0) {
      // Fallback: treat markdownEl children directly
      blockElements.push(...Array.from(markdownEl.children) as HTMLElement[]);
    }

    // Build full text and find each tool call region
    const allText = markdownEl.textContent || '';
    const toolCallRegex = new RegExp(
      `<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`,
      'g',
    );

    let match: RegExpExecArray | null;
    const toolCalls: Array<{ fullMatch: string; content: string }> = [];
    while ((match = toolCallRegex.exec(allText)) !== null) {
      toolCalls.push({ fullMatch: match[0], content: match[1].trim() });
    }

    if (toolCalls.length === 0) return;

    // For each tool call, find the paragraphs that contain it and render a widget
    // We work with <p> elements as the visual unit
    const paragraphs = Array.from(markdownEl.querySelectorAll('p'));
    let pIdx = 0;

    for (const tc of toolCalls) {
      // Find paragraphs belonging to this tool call
      const belongingParagraphs: HTMLElement[] = [];
      let found = false;

      for (let i = pIdx; i < paragraphs.length; i++) {
        const pText = paragraphs[i].textContent || '';

        if (!found && pText.includes(openTag.replace(/</g, '<'))) {
          found = true;
        }
        // Also check raw text match (Gemini may render < as literal in textContent)
        if (!found && pText.includes(`<${TOOL_CALL_TAG}>`)) {
          found = true;
        }

        if (found) {
          belongingParagraphs.push(paragraphs[i] as HTMLElement);
          if (pText.includes(closeTag.replace(/</g, '<')) || pText.includes(`</${TOOL_CALL_TAG}>`)) {
            pIdx = i + 1;
            break;
          }
        }
      }

      // If we couldn't find paragraphs via iteration, use all remaining
      if (belongingParagraphs.length === 0) {
        // Fallback: just hide nothing extra, mount before first unused paragraph
        continue;
      }

      const { toolName, description, query } = this.extractToolInfo(tc.fullMatch);
      this.mountToolCallShadow(belongingParagraphs, toolName, description, query);
    }
  }

  private mountToolCallShadow(
    paragraphs: HTMLElement[],
    toolName: string,
    description: string,
    query: string,
  ): void {
    if (paragraphs.length === 0) return;

    const firstP = paragraphs[0];
    const parent = firstP.parentElement;
    if (!parent) return;

    // Create shadow host BEFORE the first paragraph
    const host = document.createElement('div');
    host.className = 'bs-agent-shadow-host';
    parent.insertBefore(host, firstP);

    // Hide original paragraphs
    paragraphs.forEach((p) => {
      p.style.display = 'none';
    });

    const shadow = host.attachShadow({ mode: 'open' });
    applyShadowStyles(shadow, mainStyles + '\n' + RENDERER_CSS);

    const root = document.createElement('div');
    root.className = 'shadow-body';
    shadow.appendChild(root);
    this.syncDarkMode(root);

    const descHtml = description
      ? `<span class="ml-2 max-w-[300px] truncate text-muted-foreground text-[11px]">${escapeHtml(description)}</span>`
      : '';

    const previewText = query
      ? escapeHtml(query.length > 80 ? query.slice(0, 80) + '…' : query)
      : '';

    root.innerHTML = `
      <div class="my-2 overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/5">
        <div class="bs-tool-header flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer select-none hover:bg-emerald-500/10 transition-colors">
          <span class="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">⚙</span>
          <span class="font-mono font-medium text-emerald-700 dark:text-emerald-300 text-xs">${escapeHtml(toolName)}</span>
          ${descHtml}
          ${!description && previewText ? `<span class="ml-2 max-w-[240px] truncate text-muted-foreground font-mono text-[11px]">${previewText}</span>` : ''}
          <button class="bs-run-btn ml-auto inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer border border-emerald-500/30" title="执行此工具调用">
            ▶ 执行
          </button>
          <span class="bs-toggle-icon text-muted-foreground text-[10px] ml-1">▶</span>
        </div>
        <div class="bs-tool-body hidden border-t border-emerald-500/15 px-3 py-2 text-xs text-muted-foreground font-mono whitespace-pre-wrap"></div>
      </div>
    `;

    const header = root.querySelector('.bs-tool-header')!;
    const body = root.querySelector('.bs-tool-body')! as HTMLElement;
    const toggleIcon = root.querySelector('.bs-toggle-icon')!;
    const runBtn = root.querySelector('.bs-run-btn')! as HTMLButtonElement;

    // Toggle expand/collapse (click on header but not on the run button)
    header.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.bs-run-btn')) return;
      const isOpen = !body.classList.contains('hidden');
      if (isOpen) {
        body.classList.add('hidden');
        toggleIcon.textContent = '▶';
      } else {
        body.classList.remove('hidden');
        toggleIcon.textContent = '▼';
        // Populate with original text
        const text = paragraphs.map((p) => p.textContent || '').join('\n');
        body.textContent = text;
      }
    });

    // Execute button — run the tool and fill result into the input editor
    runBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      runBtn.disabled = true;
      runBtn.textContent = '⏳ 执行中...';

      try {
        // Re-parse the full tool call from original paragraphs
        const fullText = paragraphs.map((p) => p.textContent || '').join('\n');
        const parsed = this.parseToolCallFromText(fullText);

        if (!parsed) {
          runBtn.textContent = '❌ 解析失败';
          return;
        }

        const { executeToolCall } = await import('../tools/tool-registry');
        const result = await executeToolCall(parsed);

        // Fill result into input editor
        this.fillResultToEditor(parsed.name, result);

        runBtn.textContent = '✅ 已完成';
        runBtn.classList.remove('bg-emerald-500/15', 'text-emerald-700', 'dark:text-emerald-300', 'hover:bg-emerald-500/25', 'border-emerald-500/30');
        runBtn.classList.add('bg-green-500/15', 'text-green-700', 'border-green-500/30');
      } catch (err) {
        console.error('[ConversationRenderer] Execute error:', err);
        runBtn.textContent = '❌ 失败';
      }
    });
  }

  /** Parse a full tool call block from raw text into a ParsedToolCall */
  private parseToolCallFromText(text: string): import('../types').ParsedToolCall | null {
    // Extract content inside <bs_agent_tool>...</bs_agent_tool>
    const tagRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`);
    const tagContent = text.match(tagRegex);
    const content = tagContent ? tagContent[1].trim() : text.trim();

    // Strategy 1: JSON
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
      } catch {
        // fall through
      }
    }

    // Strategy 2: Unstructured
    const knownTools = ['execute_sql', 'sync_conversation_messages', 'export', 'complete_task'];
    for (const tool of knownTools) {
      if (content.startsWith(tool)) {
        const rest = content.slice(tool.length).trim();
        if (tool === 'execute_sql') {
          const sqlMatch = rest.match(/(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*/i);
          if (sqlMatch) {
            const description = rest.slice(0, sqlMatch.index).trim() || undefined;
            return { name: tool, description, params: { query: sqlMatch[0].trim() } };
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

  /** Fill tool execution result into the platform's input editor as a capsule */
  private fillResultToEditor(toolName: string, result: string): void {
    const wrappedResult = `<bs_agent_result>\n### ${toolName}\n${result}\n</bs_agent_result>`;

    // Find the editor and insert as capsule
    const editor = document.querySelector<HTMLElement>(
      'div.ql-editor[contenteditable="true"], .input-area [contenteditable="true"]',
    );

    if (editor) {
      editor.focus();
      editor.innerHTML = '';

      const p = document.createElement('p');
      const capsule = document.createElement('strong');
      capsule.className = 'bs-agent-result-capsule';
      capsule.setAttribute('data-result-content', wrappedResult);
      capsule.contentEditable = 'false';
      capsule.textContent = `📋 ${toolName}`;

      p.appendChild(capsule);
      p.appendChild(document.createTextNode('\u00A0'));
      editor.appendChild(p);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private extractToolInfo(text: string): { toolName: string; description: string; query: string } {
    // Extract content inside <bs_agent_tool>...</bs_agent_tool>
    const tagRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`);
    const tagContent = text.match(tagRegex);
    const content = tagContent ? tagContent[1].trim() : text.trim();

    // Strategy 1: JSON parse
    if (content.startsWith('{')) {
      try {
        const obj = JSON.parse(content);
        return {
          toolName: obj.name || 'unknown',
          description: obj.description || '',
          query: obj.params?.query || obj.params?.summary || '',
        };
      } catch {
        // fall through
      }
    }

    // Strategy 2: Unstructured (Gemini stripped formatting)
    const knownTools = ['execute_sql', 'sync_conversation_messages', 'export', 'complete_task'];
    for (const tool of knownTools) {
      if (content.startsWith(tool)) {
        const rest = content.slice(tool.length).trim();
        const sqlMatch = rest.match(/(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*/i);
        if (sqlMatch) {
          return {
            toolName: tool,
            description: rest.slice(0, sqlMatch.index).trim(),
            query: sqlMatch[0].trim(),
          };
        }
        return { toolName: tool, description: '', query: rest };
      }
    }

    return { toolName: 'tool_call', description: '', query: '' };
  }

  /** Sync Gemini dark mode to a shadow root container */
  private syncDarkMode(root: HTMLElement): void {
    const applyDark = () => {
      const themeValue = localStorage.getItem('Bard-Color-Theme');
      let isDark = false;
      if (!themeValue) {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        isDark = themeValue === 'Bard-Dark-Theme';
      }
      root.classList.toggle('dark', isDark);
    };

    applyDark();
    window.addEventListener('storage', (e) => {
      if (e.key === 'Bard-Color-Theme') applyDark();
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDark);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
