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
 * - We must wait for streaming to complete before processing.
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

export class ConversationRenderer {
  private observer: MutationObserver | null = null;
  private container: HTMLElement | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  /** Track model-response elements waiting for streaming to complete */
  private pendingResponses = new Set<HTMLElement>();

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
      // Queue for later — will be processed when aria-busy changes to false
      this.pendingResponses.add(el);
      return;
    }

    // Check for tool call text in the rendered content
    const allText = markdownEl.textContent || '';
    if (!allText.includes(`<${TOOL_CALL_TAG}>`)) return;

    el.classList.add(TOOL_CALL_RENDERED_CLASS);
    el.setAttribute(TOOL_CALL_ATTR, 'true');

    this.renderToolCallWidgets(markdownEl as HTMLElement);
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

    // Find ALL <p> elements that contain tool call text.
    // In Gemini's DOM, each tool call is typically in a single <p>.
    const paragraphs = Array.from(markdownEl.querySelectorAll('p'));
    let i = 0;

    while (i < paragraphs.length) {
      const p = paragraphs[i] as HTMLElement;
      const text = p.textContent || '';

      if (!text.includes(openTag)) {
        i++;
        continue;
      }

      // Collect paragraphs for this tool call block
      const blockParagraphs: HTMLElement[] = [p];

      // If close tag is NOT in same paragraph, collect until we find it
      if (!text.includes(closeTag)) {
        let j = i + 1;
        while (j < paragraphs.length) {
          blockParagraphs.push(paragraphs[j] as HTMLElement);
          if ((paragraphs[j].textContent || '').includes(closeTag)) break;
          j++;
        }
      }

      const fullText = blockParagraphs.map((el) => el.textContent || '').join('\n');
      const { toolName, query } = this.extractToolInfo(fullText);

      this.mountToolCallShadow(blockParagraphs, toolName, query);
      i += blockParagraphs.length;
    }
  }

  private mountToolCallShadow(
    paragraphs: HTMLElement[],
    toolName: string,
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

    const previewText = query
      ? escapeHtml(query.length > 80 ? query.slice(0, 80) + '…' : query)
      : '';

    root.innerHTML = `
      <div class="my-2 overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/5">
        <div class="bs-tool-header flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer select-none hover:bg-emerald-500/10 transition-colors">
          <span class="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">⚙</span>
          <span class="font-mono font-medium text-emerald-700 dark:text-emerald-300 text-xs">${escapeHtml(toolName)}</span>
          ${previewText ? `<span class="ml-2 max-w-[240px] truncate text-muted-foreground font-mono text-[11px]">${previewText}</span>` : ''}
          <span class="bs-toggle-icon ml-auto text-muted-foreground text-[10px]">▶</span>
        </div>
        <div class="bs-tool-body hidden border-t border-emerald-500/15 px-3 py-2 text-xs text-muted-foreground font-mono whitespace-pre-wrap"></div>
      </div>
    `;

    const header = root.querySelector('.bs-tool-header')!;
    const body = root.querySelector('.bs-tool-body')! as HTMLElement;
    const toggleIcon = root.querySelector('.bs-toggle-icon')!;

    header.addEventListener('click', () => {
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
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private extractToolInfo(text: string): { toolName: string; query: string } {
    // Structured: <name>...</name> <params><query>...</query></params>
    const nameMatch = text.match(/<name>([\s\S]*?)<\/name>/);
    const queryMatch = text.match(/<query>([\s\S]*?)<\/query>/);

    if (nameMatch) {
      return {
        toolName: nameMatch[1].trim(),
        query: queryMatch?.[1]?.trim() || '',
      };
    }

    // Unstructured: <bs_agent_tool>execute_sqlSELECT...;</bs_agent_tool>
    const tagRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`);
    const tagContent = text.match(tagRegex);
    if (tagContent) {
      const content = tagContent[1].trim();
      const knownTools = ['execute_sql', 'sync_conversation_messages', 'export'];
      for (const tool of knownTools) {
        if (content.startsWith(tool)) {
          return { toolName: tool, query: content.slice(tool.length).trim() };
        }
      }
      return { toolName: 'unknown', query: content };
    }

    return { toolName: 'tool_call', query: '' };
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
