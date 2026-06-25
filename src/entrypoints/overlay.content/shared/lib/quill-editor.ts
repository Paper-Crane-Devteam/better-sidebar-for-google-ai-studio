/**
 * QuillEditorHelper — Centralized utilities for interacting with Gemini's
 * Quill-based contenteditable editor.
 *
 * Quill maintains its own internal Delta model. Direct DOM manipulation
 * (innerHTML, appendChild, replaceChild) does NOT sync to Quill's model.
 * This helper provides Quill-safe methods that work around this limitation.
 *
 * Key insight: `document.execCommand('insertText')` is the only reliable way
 * to insert text that Quill will record in its Delta. After Quill processes
 * the insertion, we can safely manipulate the DOM in the next animation frame
 * to add formatting (like wrapping in <strong>).
 */

// ─── Editor Selector ─────────────────────────────────────────────────────────

const EDITOR_SELECTOR = 'rich-textarea .ql-editor[contenteditable="true"]';
const EDITOR_SELECTOR_FALLBACK = 'div.ql-editor[contenteditable="true"]';

// ─── Capsule Constants ───────────────────────────────────────────────────────

export const CAPSULE_CLASS = 'bs-prompt-capsule';
export const CAPSULE_ATTR_CONTENT = 'data-prompt-content';
export const CAPSULE_ATTR_ID = 'data-prompt-id';
export const RESULT_CAPSULE_CLASS = 'bs-agent-result-capsule';
export const RESULT_CAPSULE_ATTR_CONTENT = 'data-result-content';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CapsuleAttrs {
  /** CSS class for the capsule element */
  className: string;
  /** Map of data-* attributes to set on the <strong> */
  dataAttrs: Record<string, string>;
  /** Whether to set contentEditable="false" on the capsule */
  nonEditable?: boolean;
}

// ─── Core Methods ────────────────────────────────────────────────────────────

/**
 * Get the Quill editor DOM element.
 */
export function getEditor(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(EDITOR_SELECTOR) ||
    document.querySelector<HTMLElement>(EDITOR_SELECTOR_FALLBACK)
  );
}

/**
 * Get the current cursor position as a character offset from the start of the editor.
 */
export function getCursorPosition(editor: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;

  const range = sel.getRangeAt(0);
  const preRange = document.createRange();
  preRange.selectNodeContents(editor);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

/**
 * Place the cursor at the end of the editor content.
 */
export function moveCursorToEnd(editor: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Clear the editor and set focus.
 */
export function clearEditor(editor: HTMLElement): void {
  editor.innerHTML = '';
  editor.focus();
}

/**
 * Replace the entire editor content with multi-line text.
 * Uses innerHTML approach (paragraphs per line) + input event dispatch.
 * Suitable for large content that doesn't need capsule formatting.
 */
export function replaceAllContent(editor: HTMLElement, text: string): void {
  editor.innerHTML = '';
  const lines = text.split('\n');
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line || '\u200B';
    editor.appendChild(p);
  }
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Insert text at the current cursor position via execCommand.
 * This is Quill-safe — Quill records the text in its Delta model.
 */
export function insertTextAtCursor(text: string): void {
  document.execCommand('insertText', false, text);
}

/**
 * Insert text at the end of the editor via execCommand (Quill-safe).
 */
export function insertTextAtEnd(editor: HTMLElement, text: string): void {
  editor.focus();
  moveCursorToEnd(editor);
  document.execCommand('insertText', false, text);
}

/**
 * Insert a capsule into the editor, replacing text from triggerPos to cursorPos.
 * Uses execCommand('insertText') for Quill compatibility, then wraps in <strong>
 * on the next animation frame.
 *
 * @param editor - The Quill editor element
 * @param triggerPos - Character offset where the trigger started
 * @param cursorPos - Current cursor character offset
 * @param displayText - Text to display inside the capsule
 * @param attrs - Capsule attributes (class, data-*)
 * @returns Promise that resolves once the capsule DOM is created
 */
export function insertCapsuleAtRange(
  editor: HTMLElement,
  triggerPos: number,
  cursorPos: number,
  displayText: string,
  attrs: CapsuleAttrs,
): Promise<HTMLElement | null> {
  // Walk text nodes to select the trigger+query range
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nodeLen = node.textContent?.length || 0;

    if (!startNode && offset + nodeLen > triggerPos) {
      startNode = node;
      startOffset = triggerPos - offset;
    }
    if (!endNode && offset + nodeLen >= cursorPos) {
      endNode = node;
      endOffset = cursorPos - offset;
      break;
    }
    offset += nodeLen;
  }

  if (!startNode || !endNode) return Promise.resolve(null);

  // Select and replace via execCommand (Quill-safe)
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);

  document.execCommand('insertText', false, displayText + '\u00A0');

  // After Quill processes, wrap in <strong>
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const capsule = wrapTextInCapsule(editor, displayText, attrs);
      resolve(capsule);
    });
  });
}

/**
 * Append a capsule at the end of the editor content.
 * Uses execCommand('insertText') + rAF wrap strategy.
 *
 * @param editor - The Quill editor element
 * @param displayText - Text to display inside the capsule
 * @param attrs - Capsule attributes (class, data-*)
 * @returns Promise that resolves once the capsule DOM is created
 */
export function appendCapsule(
  editor: HTMLElement,
  displayText: string,
  attrs: CapsuleAttrs,
): Promise<HTMLElement | null> {
  editor.focus();
  moveCursorToEnd(editor);
  document.execCommand('insertText', false, displayText + '\u00A0');

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const capsule = wrapTextInCapsule(editor, displayText, attrs);
      resolve(capsule);
    });
  });
}

/**
 * Insert multiple capsules into a cleared editor.
 * Uses execCommand('insertText') for all texts at once, then wraps each in rAF.
 *
 * @param editor - The Quill editor element
 * @param capsules - Array of { displayText, attrs }
 * @returns Promise that resolves once all capsule DOMs are created
 */
export function insertMultipleCapsules(
  editor: HTMLElement,
  capsules: Array<{ displayText: string; attrs: CapsuleAttrs }>,
): Promise<Array<HTMLElement | null>> {
  clearEditor(editor);

  // Place cursor
  const sel = window.getSelection();
  if (sel) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Insert all texts separated by nbsp
  const fullText = capsules.map((c) => c.displayText).join('\u00A0') + '\u00A0';
  document.execCommand('insertText', false, fullText);

  // Wrap each in next frame
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const results: Array<HTMLElement | null> = [];
      for (const capsuleData of capsules) {
        const el = wrapTextInCapsule(editor, capsuleData.displayText, capsuleData.attrs);
        results.push(el);
      }
      resolve(results);
    });
  });
}

// ─── Capsule Query Helpers ───────────────────────────────────────────────────

/**
 * Check if the cursor is currently inside a capsule element.
 */
export function findCapsuleAtCursor(editor: HTMLElement, capsuleClass: string): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  let node: Node | null = range.startContainer;
  while (node && node !== editor) {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as HTMLElement).classList?.contains(capsuleClass)
    ) {
      return node as HTMLElement;
    }
    node = node.parentNode;
  }
  return null;
}

/**
 * Remove a capsule element and its trailing nbsp/space.
 */
export function removeCapsule(capsule: HTMLElement): void {
  const next = capsule.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE) {
    const text = next.textContent || '';
    if (text[0] === '\u00A0' || text[0] === ' ') {
      next.textContent = text.slice(1);
      if (!next.textContent) next.parentNode?.removeChild(next);
    }
  }
  capsule.remove();
}

/**
 * Expand all capsules matching a class (optionally filtered by trigger char)
 * by replacing them with their stored content text.
 * Dispatches input event after expansion.
 */
export function expandCapsules(
  editor: HTMLElement,
  capsuleClass: string,
  triggerChar?: string,
): string {
  const selector = triggerChar
    ? `.${capsuleClass}[data-trigger="${triggerChar}"]`
    : `.${capsuleClass}`;
  const capsules = editor.querySelectorAll(selector);
  capsules.forEach((capsule) => {
    const content = capsule.getAttribute(CAPSULE_ATTR_CONTENT) || '';
    const textNode = document.createTextNode(content);
    capsule.parentNode?.replaceChild(textNode, capsule);
  });
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  return editor.textContent || '';
}

/**
 * Check if editor has any capsules matching a class + optional trigger char.
 */
export function hasCapsules(editor: HTMLElement, capsuleClass: string, triggerChar?: string): boolean {
  const selector = triggerChar
    ? `.${capsuleClass}[data-trigger="${triggerChar}"]`
    : `.${capsuleClass}`;
  return editor.querySelector(selector) !== null;
}

// ─── Send Button ─────────────────────────────────────────────────────────────

const SEND_BUTTON_SELECTOR = '.text-input-field .send-button-container>gem-icon-button>button';

/**
 * Click the send button. Waits 150ms for Quill to process input changes first.
 */
export async function triggerSend(): Promise<void> {
  await new Promise((r) => setTimeout(r, 150));

  const sendBtn = document.querySelector<HTMLButtonElement>(SEND_BUTTON_SELECTOR);

  if (sendBtn && !sendBtn.disabled) {
    sendBtn.click();
    return;
  }

  // Fallback selectors
  const fallbackBtn = document.querySelector(
    'button.send-button, button[aria-label="Send message"], button[data-at-shortcutkeys]',
  ) as HTMLButtonElement | null;

  if (fallbackBtn && !fallbackBtn.disabled) {
    fallbackBtn.click();
    return;
  }

  // Fallback: try finding by mat-icon content
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.querySelector('mat-icon')?.textContent?.trim() === 'send') {
      (btn as HTMLButtonElement).click();
      return;
    }
  }
  console.warn('[QuillEditor] Could not find send button');
}

// ─── Send Button Interceptor ─────────────────────────────────────────────────

let sendInterceptorInstalled = false;

/**
 * Install a click interceptor on the send button that expands all capsules
 * before Gemini processes the send. This handles the case where the user
 * clicks the send button instead of pressing Enter.
 *
 * Uses capture phase to fire before Gemini's own handler.
 * Must be called once during initialization.
 */
export function installSendButtonInterceptor(): void {
  if (sendInterceptorInstalled) return;
  sendInterceptorInstalled = true;

  // Use event delegation on document to catch clicks on the send button
  // even if it gets re-created by Angular.
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const sendBtn = target.closest(SEND_BUTTON_SELECTOR);
    if (!sendBtn) return;

    const editor = getEditor();
    if (!editor) return;

    // Check for prompt capsules (bs-prompt-capsule) — expand them in place
    const promptCapsules = editor.querySelectorAll(`.${CAPSULE_CLASS}`);
    if (promptCapsules.length > 0) {
      expandCapsules(editor, CAPSULE_CLASS);
    }

    // Check for result capsules (bs-agent-result-capsule) — merge and expand
    const resultCapsules = editor.querySelectorAll(`.${RESULT_CAPSULE_CLASS}`);
    if (resultCapsules.length > 0) {
      e.preventDefault();
      e.stopPropagation();

      const sections: string[] = [];
      resultCapsules.forEach((capsule) => {
        const content = capsule.getAttribute(RESULT_CAPSULE_ATTR_CONTENT) || '';
        sections.push(content);
      });

      const mergedContent = sections.join('\n\n---\n\n');
      const wrappedResult = `<bs_agent_result>\n${mergedContent}\n</bs_agent_result>`;

      replaceAllContent(editor, wrappedResult);
      triggerSend();
    }
  }, true); // capture phase — fires before Gemini's handler
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Find displayText in the editor's text nodes and wrap it in a <strong> element.
 * Returns the created <strong> element or null if not found.
 */
function wrapTextInCapsule(
  editor: HTMLElement,
  displayText: string,
  attrs: CapsuleAttrs,
): HTMLElement | null {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent || '';
    const idx = text.indexOf(displayText);
    if (idx === -1) continue;

    const parent = node.parentNode;
    if (!parent) continue;
    // Already wrapped in a capsule
    if ((parent as HTMLElement).classList?.contains(attrs.className)) continue;

    const before = text.slice(0, idx);
    const after = text.slice(idx + displayText.length);

    const strong = document.createElement('strong');
    strong.className = attrs.className;
    for (const [key, value] of Object.entries(attrs.dataAttrs)) {
      strong.setAttribute(key, value);
    }
    if (attrs.nonEditable) {
      strong.contentEditable = 'false';
    }
    strong.textContent = displayText;

    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(strong);
    if (after) frag.appendChild(document.createTextNode(after));

    parent.replaceChild(frag, node);

    // Place cursor after capsule
    const sel = window.getSelection();
    if (sel) {
      const afterNode = strong.nextSibling;
      if (afterNode) {
        const r = document.createRange();
        r.setStartAfter(afterNode);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
    return strong;
  }
  return null;
}
