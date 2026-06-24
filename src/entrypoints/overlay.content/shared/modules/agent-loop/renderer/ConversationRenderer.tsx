/**
 * ConversationRenderer — DOM observer for agent loop messages.
 *
 * Uses React + Shadow DOM to render widgets next to Gemini's model-response elements.
 * Widgets are appended as children of model-response (not inside .markdown)
 * to survive Angular's internal re-renders of markdown content.
 *
 * Two rendering paths:
 * 1. Static: Page load or conversation switch — scan existing elements
 * 2. Streaming: Real-time detection via MutationObserver during AI generation
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import mainStyles from '@/index.scss?inline';
import { applyShadowStyles } from '@/shared/lib/utils';
import { ShadowRootProvider } from '@/shared/components/ShadowRootContext';
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
import { StreamingToolWidget } from './components/StreamingToolWidget';
import { PromptWidget } from './components/PromptWidget';
import type { ParsedToolCall } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const CHAT_CONTAINER_SELECTOR = 'infinite-scroller.chat-history, .conversation-container, chat-window';
const SHADOW_HOST_CLASS = 'bs-agent-shadow-host';
const STREAMING_HOST_CLASS = 'bs-agent-streaming-host';

/** Debounce for stability check before rendering (Angular re-render protection) */
const STABILITY_DELAY_MS = 1200;

/** Render debounce during streaming */
const STREAM_RENDER_DEBOUNCE_MS = 100;

// ─── Streaming State ─────────────────────────────────────────────────────────

interface StreamingBlock {
  modelResponse: HTMLElement;
  markdownEl: HTMLElement;
  shadowHost: HTMLElement;
  reactRoot: ReactDOM.Root;
  observer: MutationObserver;
  lastContentLength: number;
  isComplete: boolean;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

// ─── Renderer Class ──────────────────────────────────────────────────────────

export class ConversationRenderer {
  private observer: MutationObserver | null = null;
  private container: HTMLElement | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private pendingResponses = new Set<HTMLElement>();
  private streamingBlocks = new Map<HTMLElement, StreamingBlock>();
  private stabilityTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  private reactRoots: ReactDOM.Root[] = [];

  start(): void {
    if (this.observer) return;
    console.log('[Renderer] start() called');

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.processNode(node as HTMLElement);
          }
        }
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-busy') {
          const target = mutation.target as HTMLElement;
          if (target.getAttribute('aria-busy') === 'false') {
            const modelResp = target.closest('model-response') as HTMLElement | null;
            if (modelResp && this.pendingResponses.has(modelResp)) {
              this.pendingResponses.delete(modelResp);
              this.processModelResponse(modelResp);
            }
            if (modelResp) {
              this.finalizeStreamingBlock(modelResp);
            }
          }
        }
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target as HTMLElement;
          const modelResp = target?.closest?.('model-response') as HTMLElement | null;
          if (modelResp && !modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) {
            this.checkStreamingToolCall(modelResp);
          }
        }
      }
    });

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
    this.cleanupStabilityTimers();
    this.cleanupStreamingBlocks();
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
    this.cleanupStabilityTimers();
    this.cleanupStreamingBlocks();

    if (!this.observer) {
      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processNode(node as HTMLElement);
            }
          }
          if (mutation.type === 'attributes' && mutation.attributeName === 'aria-busy') {
            const target = mutation.target as HTMLElement;
            if (target.getAttribute('aria-busy') === 'false') {
              const modelResp = target.closest('model-response') as HTMLElement | null;
              if (modelResp && this.pendingResponses.has(modelResp)) {
                this.pendingResponses.delete(modelResp);
                this.processModelResponse(modelResp);
              }
              if (modelResp) {
                this.finalizeStreamingBlock(modelResp);
              }
            }
          }
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const target = mutation.target as HTMLElement;
            const modelResp = target?.closest?.('model-response') as HTMLElement | null;
            if (modelResp && !modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) {
              this.checkStreamingToolCall(modelResp);
            }
          }
        }
      });
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
    if (!container) {
      console.log('[Renderer] scanExisting() — no container');
      return;
    }
    const userQueries = container.querySelectorAll('user-query');
    const modelResponses = container.querySelectorAll('model-response');
    console.log('[Renderer] scanExisting() — user-query:', userQueries.length, 'model-response:', modelResponses.length);
    userQueries.forEach((el) => this.processUserQuery(el as HTMLElement));
    modelResponses.forEach((el) => this.processModelResponse(el as HTMLElement));
  }

  // ─── Private: Container ────────────────────────────────────────────

  private attachToContainer(): boolean {
    const container = this.getConversationContainer();
    if (container && this.observer) {
      console.log('[Renderer] attachToContainer() success:', container.tagName, container.className?.slice(0, 60));
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
    console.log('[Renderer] attachToContainer() failed');
    return false;
  }

  private getConversationContainer(): HTMLElement | null {
    return document.querySelector(CHAT_CONTAINER_SELECTOR);
  }

  // ─── Private: Node Processing ──────────────────────────────────────

  private processNode(el: HTMLElement): void {
    if (el.matches?.('user-query')) this.processUserQuery(el);
    else if (el.matches?.('model-response')) this.processModelResponse(el);

    el.querySelectorAll?.('user-query')?.forEach((c) => this.processUserQuery(c as HTMLElement));
    el.querySelectorAll?.('model-response')?.forEach((c) => this.processModelResponse(c as HTMLElement));

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
      const rawText = Array.from(textLines).map((l) => l.textContent || '').join('\n');
      this.mountPromptWidget(el, textLines, 'prompt', title, rawText);
      return;
    }

    const fullText = Array.from(textLines).map((l) => l.textContent || '').join('\n');
    if (fullText.includes(`<${RESULT_TAG}>`)) {
      el.classList.add(PROMPT_RENDERED_CLASS);
      this.mountPromptWidget(el, textLines, 'result', 'Tool Results', fullText);
    }
  }

  // ─── Model Response ────────────────────────────────────────────────

  private processModelResponse(el: HTMLElement): void {
    if (el.classList.contains(TOOL_CALL_RENDERED_CLASS)) return;

    const markdownEl = el.querySelector('.markdown');
    if (!markdownEl) return;

    const isBusy = markdownEl.getAttribute('aria-busy') === 'true';
    if (isBusy) {
      this.pendingResponses.add(el);
      this.checkStreamingToolCall(el);
      return;
    }

    const allText = markdownEl.textContent || '';
    if (!allText.includes(`<${TOOL_CALL_TAG}>`)) return;

    // Stability debounce: wait for Angular to stop re-rendering
    const existingTimer = this.stabilityTimers.get(el);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.stabilityTimers.delete(el);
      this.renderModelResponseStable(el);
    }, STABILITY_DELAY_MS);
    this.stabilityTimers.set(el, timer);
  }

  private renderModelResponseStable(el: HTMLElement): void {
    if (el.classList.contains(TOOL_CALL_RENDERED_CLASS)) return;

    const markdownEl = el.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return;

    const allText = markdownEl.textContent || '';
    if (!allText.includes(`<${TOOL_CALL_TAG}>`)) return;

    console.log('[Renderer] renderModelResponseStable — rendering. Text length:', allText.length);
    el.classList.add(TOOL_CALL_RENDERED_CLASS);
    el.setAttribute(TOOL_CALL_ATTR, 'true');

    this.renderToolCallWidgets(el, markdownEl, allText);
  }

  // ─── Tool Call Widget Rendering ────────────────────────────────────

  private renderToolCallWidgets(modelResp: HTMLElement, markdownEl: HTMLElement, allText: string): void {
    const toolCallRegex = new RegExp(
      `<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`,
      'g',
    );

    let match: RegExpExecArray | null;
    const toolCalls: Array<{ fullMatch: string; content: string }> = [];
    while ((match = toolCallRegex.exec(allText)) !== null) {
      toolCalls.push({ fullMatch: match[0], content: match[1].trim() });
    }

    console.log('[Renderer] renderToolCallWidgets — found:', toolCalls.length);
    if (toolCalls.length === 0) return;

    // Hide .markdown content via a CSS class (Angular-safe: we hide from outside)
    markdownEl.style.display = 'none';

    // Mount React widget as a sibling AFTER .markdown's parent structure
    // Append to model-response itself — Angular doesn't replace model-response elements
    const host = document.createElement('div');
    host.className = SHADOW_HOST_CLASS;
    modelResp.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    applyShadowStyles(shadow, mainStyles);

    const rootContainer = document.createElement('div');
    rootContainer.className = 'shadow-body';
    shadow.appendChild(rootContainer);
    this.syncDarkMode(rootContainer);

    const reactRoot = ReactDOM.createRoot(rootContainer);
    this.reactRoots.push(reactRoot);

    const widgets = toolCalls.map((tc, idx) => {
      const { toolName, description, query } = this.extractToolInfo(tc.fullMatch);
      return (
        <ToolCallWidget
          key={idx}
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
        <div className="py-2">{widgets}</div>
      </ShadowRootProvider>,
    );

    // Verify after 1.5s
    setTimeout(() => {
      if (!host.isConnected) {
        console.warn('[Renderer] ⚠️ Shadow host removed — retrying');
        markdownEl.style.display = '';
        modelResp.classList.remove(TOOL_CALL_RENDERED_CLASS);
        modelResp.removeAttribute(TOOL_CALL_ATTR);
        // Retry once more after a longer delay
        setTimeout(() => this.processModelResponse(modelResp), 2000);
      } else {
        console.log('[Renderer] ✅ Shadow host stable');
      }
    }, 1500);
  }

  // ─── Streaming Tool Call ───────────────────────────────────────────

  private checkStreamingToolCall(modelResp: HTMLElement): void {
    if (this.streamingBlocks.has(modelResp)) return;
    if (modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) return;

    const markdownEl = modelResp.querySelector('.markdown') as HTMLElement;
    if (!markdownEl) return;

    const allText = markdownEl.textContent || '';
    if (!allText.includes(`<${TOOL_CALL_TAG}>`)) return;

    const block = this.mountStreamingWidget(modelResp, markdownEl, allText);
    if (!block) return;

    this.streamingBlocks.set(modelResp, block);

    const streamObserver = new MutationObserver(() => {
      this.handleStreamingMutation(modelResp);
    });
    block.observer = streamObserver;
    streamObserver.observe(markdownEl, { childList: true, subtree: true, characterData: true });
  }

  private handleStreamingMutation(modelResp: HTMLElement): void {
    const block = this.streamingBlocks.get(modelResp);
    if (!block || block.isComplete) return;

    if (block.debounceTimer) clearTimeout(block.debounceTimer);
    block.debounceTimer = setTimeout(() => {
      this.updateStreamingWidget(block);
    }, STREAM_RENDER_DEBOUNCE_MS);
  }

  private updateStreamingWidget(block: StreamingBlock): void {
    const allText = block.markdownEl.textContent || '';
    const openTag = `<${TOOL_CALL_TAG}>`;
    const closeTag = `</${TOOL_CALL_TAG}>`;
    const currentLength = allText.length;

    if (currentLength === block.lastContentLength) return;
    block.lastContentLength = currentLength;

    const openIdx = allText.indexOf(openTag);
    const closeIdx = allText.indexOf(closeTag, openIdx);
    const isComplete = closeIdx !== -1;

    const contentStart = openIdx + openTag.length;
    const contentEnd = isComplete ? closeIdx : allText.length;
    const partialContent = allText.slice(contentStart, contentEnd).trim();

    let toolName = '…';
    const nameMatch = partialContent.match(/"name"\s*:\s*"([^"]+)"/);
    if (nameMatch) toolName = nameMatch[1];

    const preview = partialContent.length > 120 ? partialContent.slice(0, 120) + '…' : partialContent;

    // Re-render the streaming widget
    block.reactRoot.render(
      <ShadowRootProvider container={block.shadowHost.shadowRoot!.querySelector('.shadow-body')! as HTMLElement}>
        <StreamingToolWidget toolName={toolName} preview={preview} isComplete={isComplete} />
      </ShadowRootProvider>,
    );

    if (isComplete) {
      block.isComplete = true;
      block.observer.disconnect();
      const isBusy = block.markdownEl.getAttribute('aria-busy') === 'true';
      if (!isBusy) {
        this.finalizeStreamingBlock(block.modelResponse);
      }
    }
  }

  private mountStreamingWidget(modelResp: HTMLElement, markdownEl: HTMLElement, currentText: string): StreamingBlock | null {
    const host = document.createElement('div');
    host.className = STREAMING_HOST_CLASS;
    modelResp.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    applyShadowStyles(shadow, mainStyles);

    const rootContainer = document.createElement('div');
    rootContainer.className = 'shadow-body';
    shadow.appendChild(rootContainer);
    this.syncDarkMode(rootContainer);

    const reactRoot = ReactDOM.createRoot(rootContainer);
    this.reactRoots.push(reactRoot);

    let toolName = '…';
    const nameMatch = currentText.match(/"name"\s*:\s*"([^"]+)"/);
    if (nameMatch) toolName = nameMatch[1];

    reactRoot.render(
      <ShadowRootProvider container={rootContainer}>
        <StreamingToolWidget toolName={toolName} preview="" isComplete={false} />
      </ShadowRootProvider>,
    );

    return {
      modelResponse: modelResp,
      markdownEl,
      shadowHost: host,
      reactRoot,
      observer: null!,
      lastContentLength: currentText.length,
      isComplete: false,
      debounceTimer: null,
    };
  }

  private finalizeStreamingBlock(modelResp: HTMLElement): void {
    const block = this.streamingBlocks.get(modelResp);
    if (!block) return;

    block.observer?.disconnect();
    if (block.debounceTimer) clearTimeout(block.debounceTimer);
    block.reactRoot.unmount();
    block.shadowHost.remove();
    this.streamingBlocks.delete(modelResp);

    if (!modelResp.classList.contains(TOOL_CALL_RENDERED_CLASS)) {
      this.processModelResponse(modelResp);
    }
  }

  // ─── Prompt Widget ─────────────────────────────────────────────────

  private mountPromptWidget(
    userQuery: HTMLElement,
    textLines: NodeListOf<Element>,
    type: 'prompt' | 'result',
    title: string,
    rawText: string,
  ): void {
    // Hide original text lines
    textLines.forEach((line) => {
      (line as HTMLElement).style.display = 'none';
    });

    const insertTarget = textLines[0]?.parentElement || userQuery;

    const host = document.createElement('div');
    host.className = SHADOW_HOST_CLASS;
    insertTarget.insertBefore(host, insertTarget.firstChild);

    const shadow = host.attachShadow({ mode: 'open' });
    applyShadowStyles(shadow, mainStyles);

    const rootContainer = document.createElement('div');
    rootContainer.className = 'shadow-body';
    shadow.appendChild(rootContainer);
    this.syncDarkMode(rootContainer);

    const reactRoot = ReactDOM.createRoot(rootContainer);
    this.reactRoots.push(reactRoot);

    reactRoot.render(
      <ShadowRootProvider container={rootContainer}>
        <PromptWidget type={type} title={title} rawText={rawText} />
      </ShadowRootProvider>,
    );
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
    const wrappedResult = `<bs_agent_result>\n### ${toolName}\n${result}\n</bs_agent_result>`;
    const editor = document.querySelector<HTMLElement>(
      'div.ql-editor[contenteditable="true"], rich-textarea .ql-editor[contenteditable="true"]',
    );

    if (editor) {
      editor.focus();
      editor.innerHTML = '';
      const lines = wrappedResult.split('\n');
      for (const line of lines) {
        const p = document.createElement('p');
        p.textContent = line || '\u200B';
        editor.appendChild(p);
      }
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
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

  private cleanupStabilityTimers(): void {
    for (const [, timer] of this.stabilityTimers) clearTimeout(timer);
    this.stabilityTimers.clear();
  }

  private cleanupStreamingBlocks(): void {
    for (const [, block] of this.streamingBlocks) {
      block.observer?.disconnect();
      if (block.debounceTimer) clearTimeout(block.debounceTimer);
      block.reactRoot.unmount();
      block.shadowHost?.remove();
    }
    this.streamingBlocks.clear();
  }

  private cleanupReactRoots(): void {
    this.reactRoots.forEach((root) => {
      try { root.unmount(); } catch { /* already unmounted */ }
    });
    this.reactRoots = [];
  }
}
