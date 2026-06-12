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
      const { toolName, description, query } = this.extractToolInfo(fullText);

      this.mountToolCallShadow(blockParagraphs, toolName, description, query);
      i += blockParagraphs.length;
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

  /** Fill tool execution result into the platform's input editor */
  private fillResultToEditor(toolName: string, result: string): void {
    const wrappedResult = `<bs_agent_result>\n### ${toolName}\n${result}\n</bs_agent_result>`;

    // Find the editor and insert text
    const editor = document.querySelector<HTMLElement>(
      'div.ql-editor[contenteditable="true"], .input-area [contenteditable="true"]',
    );

    if (editor) {
      editor.focus();
      // Clear and set content
      const p = document.createElement('p');
      p.textContent = wrappedResult;
      editor.innerHTML = '';
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
