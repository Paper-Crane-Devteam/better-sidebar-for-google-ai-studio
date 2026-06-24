/**
 * useEditorIntegration — Shared editor DOM integration for trigger popups.
 *
 * Handles:
 * - Attaching input/keydown/blur listeners to contenteditable editor
 * - MutationObserver for SPA navigation (editor re-creation)
 * - Keyboard navigation (↑↓ Enter Tab Escape)
 * - Capsule insertion (replacing trigger+query text with <strong>)
 * - Backspace: delete entire capsule at once
 * - Enter/Send: expand capsules before submission
 * - Popup positioning
 *
 * Both SlashCommandFeature and AgentLoopFeature use this instead of
 * duplicating ~200 lines of nearly identical DOM plumbing.
 */

import { useEffect, useRef, useState } from 'react';
import type { EditorIntegrationConfig, TriggerPopupItem, CapsuleClickInfo } from './types';

const CAPSULE_CLASS = 'bs-prompt-capsule';
const CAPSULE_ATTR_CONTENT = 'data-prompt-content';
const CAPSULE_ATTR_ID = 'data-prompt-id';

export interface PopupPosition {
  bottom: number;
  left: number;
}

export function useEditorIntegration(config: EditorIntegrationConfig) {
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({ bottom: 0, left: 0 });

  // Store config in refs for stable access inside event handlers
  const configRef = useRef(config);
  configRef.current = config;

  // Expose suppressInput so consumers can suppress input after mouse-click capsule insertion
  const suppressInputRef = useRef<() => void>(() => {});

  useEffect(() => {
    const cfg = configRef.current;
    if (!cfg.enabled) {
      cfg.close();
      return;
    }

    let currentEditor: HTMLElement | null = null;
    // After confirming a selection, suppress input events briefly
    // (capsule insertion via execCommand + rAF DOM manipulation triggers multiple input events)
    let suppressUntil = 0;

    suppressInputRef.current = () => { suppressUntil = Date.now() + 100; };

    const onInput = () => {
      if (Date.now() < suppressUntil) return;

      const editor = configRef.current.getEditor();
      if (!editor) return;

      const triggerChar = configRef.current.triggerChar;
      const capsuleClass = configRef.current.capsuleClass || CAPSULE_CLASS;

      // Get text and cursor position, but exclude text inside capsules belonging
      // to this trigger — prevents the trigger char inside a capsule from re-opening the popup.
      const { text, cursorPos } = getTextExcludingCapsules(editor, capsuleClass, triggerChar);

      configRef.current.onInput(text, cursorPos);

      // Update popup position
      const rect = editor.getBoundingClientRect();
      setPopupPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: Math.max(rect.left, 16),
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const state = configRef.current.getPopupState();
      const capsuleClass = configRef.current.capsuleClass || CAPSULE_CLASS;

      // ─── Popup open: intercept navigation ───────────────────
      if (state.isOpen) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            e.stopPropagation();
            configRef.current.selectPrevious();
            return;
          case 'ArrowDown':
            e.preventDefault();
            e.stopPropagation();
            configRef.current.selectNext();
            return;
          case 'Enter':
          case 'Tab':
            e.preventDefault();
            e.stopPropagation();
            suppressUntil = Date.now() + 100;
            configRef.current.onConfirmSelection();
            configRef.current.close();
            return;
          case 'Escape':
            e.preventDefault();
            e.stopPropagation();
            configRef.current.close();
            return;
        }
      }

      // ─── Backspace: delete entire capsule if cursor is inside one ─────
      if (e.key === 'Backspace' && !state.isOpen) {
        const capsule = findCapsuleAtCursor(configRef.current.getEditor(), capsuleClass);
        if (capsule) {
          e.preventDefault();
          e.stopPropagation();
          removeCapsule(capsule);
          configRef.current.getEditor()?.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
      }

      // ─── Enter (send): expand capsules before submission ──────────
      if (e.key === 'Enter' && !e.shiftKey && !state.isOpen) {
        const editor = configRef.current.getEditor();
        if (!editor) return;

        // First: expand any result capsules (bs-agent-result-capsule)
        const resultCapsules = editor.querySelectorAll('.bs-agent-result-capsule');
        if (resultCapsules.length > 0) {
          e.preventDefault();
          e.stopPropagation();

          // Collect all capsule contents and merge into a single <bs_agent_result> block
          const sections: string[] = [];
          resultCapsules.forEach((capsule) => {
            const content = capsule.getAttribute('data-result-content') || '';
            sections.push(content);
          });

          // Build merged result text
          const mergedContent = sections.join('\n\n---\n\n');
          const wrappedResult = `<bs_agent_result>\n${mergedContent}\n</bs_agent_result>`;

          // Quill maintains its own internal Delta model. Direct DOM manipulation
          // (replaceChild/removeChild) does NOT sync back to Quill's model, so when
          // the send button is clicked, Quill sends its stale model content (the
          // capsule display text) instead of the replaced DOM text.
          //
          // Fix: completely rewrite the editor content via innerHTML + paragraph
          // structure that Quill recognizes, then dispatch input to sync Quill.
          editor.innerHTML = '';
          const lines = wrappedResult.split('\n');
          for (const line of lines) {
            const p = document.createElement('p');
            p.textContent = line || '\u200B';
            editor.appendChild(p);
          }
          editor.dispatchEvent(new Event('input', { bubbles: true }));

          // After Quill processes the new content, click the send button
          setTimeout(() => {
            const sendBtn = document.querySelector<HTMLButtonElement>(
              'button.send-button, button[aria-label="Send message"], button[data-testid="send-button"]',
            );
            sendBtn?.click();
          }, 150);
          return;
        }

        const triggerChar = configRef.current.triggerChar;
        if (hasOwnCapsules(editor, capsuleClass, triggerChar)) {
          // Let consumer handle sending if they want to
          if (configRef.current.onBeforeSend) {
            const handled = configRef.current.onBeforeSend(editor);
            if (handled) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }
          // Default: expand only our own capsules in-place, let platform handle the send
          expandOwnCapsules(editor, capsuleClass, triggerChar);
        }
      }
    };

    const onBlur = () => {
      setTimeout(() => {
        if (configRef.current.getPopupState().isOpen) {
          configRef.current.close();
        }
      }, 300);
    };

    const onClick = (e: MouseEvent) => {
      const capsuleClass = configRef.current.capsuleClass || CAPSULE_CLASS;
      const triggerChar = configRef.current.triggerChar;
      const target = (e.target as HTMLElement).closest(`.${capsuleClass}[data-trigger="${triggerChar}"]`);
      if (!target) return;

      const onCapsuleClick = configRef.current.onCapsuleClick;
      if (!onCapsuleClick) return;

      e.preventDefault();
      e.stopPropagation();

      const info: CapsuleClickInfo = {
        element: target as HTMLElement,
        content: target.getAttribute(CAPSULE_ATTR_CONTENT) || '',
        promptId: target.getAttribute(CAPSULE_ATTR_ID) || '',
        rect: target.getBoundingClientRect(),
      };
      onCapsuleClick(info);
    };

    const attachListeners = (editor: HTMLElement) => {
      editor.addEventListener('input', onInput);
      editor.addEventListener('keydown', onKeyDown, true);
      editor.addEventListener('blur', onBlur);
      editor.addEventListener('click', onClick);
    };

    const detachListeners = (editor: HTMLElement) => {
      editor.removeEventListener('input', onInput);
      editor.removeEventListener('keydown', onKeyDown, true);
      editor.removeEventListener('blur', onBlur);
      editor.removeEventListener('click', onClick);
    };

    // Attach to existing editor
    currentEditor = configRef.current.getEditor();
    if (currentEditor) {
      attachListeners(currentEditor);
    }

    // Watch for editor appearing/changing (SPA navigation)
    const bodyObserver = new MutationObserver(() => {
      const editor = configRef.current.getEditor();
      if (editor && editor !== currentEditor) {
        if (currentEditor) detachListeners(currentEditor);
        currentEditor = editor;
        attachListeners(editor);
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (currentEditor) detachListeners(currentEditor);
      bodyObserver.disconnect();
    };
  }, [config.enabled]); // Only re-run if enabled changes

  return {
    popupPosition,
    /** Call before inserting a capsule via mouse click to suppress the subsequent input events */
    suppressInput: () => suppressInputRef.current(),
  };
}

// ─── Capsule DOM helpers (shared between both features) ──────────────────────

/**
 * Insert a capsule into the editor, replacing text from triggerPos to cursorPos.
 * Uses execCommand('insertText') for Quill compatibility, then wraps in <strong>.
 */
export function insertCapsule(
  editor: HTMLElement,
  triggerPos: number,
  cursorPos: number,
  item: TriggerPopupItem,
  triggerChar: string,
): void {
  const displayText = `${triggerChar}${item.title}`;

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

  if (!startNode || !endNode) return;

  // Select and replace via execCommand (Quill-safe)
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);

  document.execCommand('insertText', false, displayText + '\u00A0');

  // After Quill processes, wrap in <strong>
  requestAnimationFrame(() => {
    wrapTextInCapsule(editor, displayText, item.id, item.content, triggerChar);
  });
}

/** Find displayText in the editor and wrap it in a <strong> capsule */
function wrapTextInCapsule(
  editor: HTMLElement,
  displayText: string,
  promptId: string,
  promptContent: string,
  triggerChar: string,
): void {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent || '';
    const idx = text.indexOf(displayText);
    if (idx === -1) continue;

    const parent = node.parentNode;
    if (!parent) continue;
    if ((parent as HTMLElement).classList?.contains(CAPSULE_CLASS)) continue;

    const before = text.slice(0, idx);
    const after = text.slice(idx + displayText.length);

    const strong = document.createElement('strong');
    strong.className = CAPSULE_CLASS;
    strong.setAttribute(CAPSULE_ATTR_ID, promptId);
    strong.setAttribute(CAPSULE_ATTR_CONTENT, promptContent);
    strong.setAttribute('data-trigger', triggerChar);
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
    return;
  }
}

/** Check if cursor is currently inside a capsule element */
function findCapsuleAtCursor(editor: HTMLElement | null, capsuleClass: string): HTMLElement | null {
  if (!editor) return null;
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

/** Remove a capsule element and its trailing nbsp */
function removeCapsule(capsule: HTMLElement): void {
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

/** Check if editor has any capsules */
function hasCapsules(editor: HTMLElement, capsuleClass: string): boolean {
  return editor.querySelector(`.${capsuleClass}`) !== null;
}

/** Check if editor has capsules belonging to a specific trigger character */
function hasOwnCapsules(editor: HTMLElement, capsuleClass: string, triggerChar: string): boolean {
  return editor.querySelector(`.${capsuleClass}[data-trigger="${triggerChar}"]`) !== null;
}

/** Expand only capsules belonging to a specific trigger character */
function expandOwnCapsules(editor: HTMLElement, capsuleClass: string, triggerChar: string): void {
  const capsules = editor.querySelectorAll(`.${capsuleClass}[data-trigger="${triggerChar}"]`);
  capsules.forEach((capsule) => {
    const content = capsule.getAttribute(CAPSULE_ATTR_CONTENT) || '';
    const textNode = document.createTextNode(content);
    capsule.parentNode?.replaceChild(textNode, capsule);
  });
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Expand all capsules in the editor — replace <strong> with their stored text content.
 * Returns the full expanded text content of the editor.
 */
export function expandAllCapsules(editor: HTMLElement, capsuleClass: string = CAPSULE_CLASS): string {
  const capsules = editor.querySelectorAll(`.${capsuleClass}`);
  capsules.forEach((capsule) => {
    const content = capsule.getAttribute(CAPSULE_ATTR_CONTENT) || '';
    const textNode = document.createTextNode(content);
    capsule.parentNode?.replaceChild(textNode, capsule);
  });
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  return editor.textContent || '';
}

/** Get cursor offset in editor (plain text character count before cursor) */
function getCursorPosition(editor: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;

  const range = sel.getRangeAt(0);
  const preRange = document.createRange();
  preRange.selectNodeContents(editor);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

/**
 * Get editor text and cursor position with capsule text belonging to a specific
 * trigger character replaced by a placeholder that won't contain the trigger char.
 * This prevents the trigger char inside `>Title` capsules from re-opening the popup.
 */
function getTextExcludingCapsules(
  editor: HTMLElement,
  capsuleClass: string,
  triggerChar: string,
): { text: string; cursorPos: number } {
  const sel = window.getSelection();
  const hasSel = sel && sel.rangeCount > 0;
  const cursorRange = hasSel ? sel!.getRangeAt(0) : null;

  let text = '';
  let cursorPos = 0;
  let cursorFound = false;

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.textContent || '';
      // Check if cursor is in this text node
      if (!cursorFound && cursorRange && cursorRange.startContainer === node) {
        cursorPos = text.length + cursorRange.startOffset;
        cursorFound = true;
      }
      text += nodeText;
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      // If this is a capsule belonging to our trigger, replace with neutral placeholder
      if (
        el.classList.contains(capsuleClass) &&
        el.getAttribute('data-trigger') === triggerChar
      ) {
        const placeholder = '\u200B'.repeat(el.textContent?.length || 1); // zero-width spaces
        // Check if cursor is inside this capsule
        if (!cursorFound && cursorRange && el.contains(cursorRange.startContainer)) {
          cursorPos = text.length + placeholder.length;
          cursorFound = true;
        }
        text += placeholder;
        return;
      }

      const tag = el.tagName.toLowerCase();
      if (tag === 'br') {
        text += '\n';
        return;
      }

      for (const child of el.childNodes) {
        walk(child);
      }

      if ((tag === 'p' || tag === 'div') && el.nextSibling) {
        text += '\n';
      }
    }
  };

  for (const child of editor.childNodes) {
    walk(child);
  }

  // Fallback: if cursor not found in walk, use plain method
  if (!cursorFound) {
    cursorPos = getCursorPosition(editor);
  }

  return { text, cursorPos };
}

/** Get the prompt ID from the first capsule in the editor */
export function getCapsulePromptId(editor: HTMLElement, capsuleClass: string = CAPSULE_CLASS): string | null {
  const capsule = editor.querySelector(`.${capsuleClass}`);
  return capsule?.getAttribute(CAPSULE_ATTR_ID) || null;
}

/** Get the prompt content from the first capsule in the editor */
export function getCapsuleContent(editor: HTMLElement, capsuleClass: string = CAPSULE_CLASS): string | null {
  const capsule = editor.querySelector(`.${capsuleClass}`);
  return capsule?.getAttribute(CAPSULE_ATTR_CONTENT) || null;
}

export { CAPSULE_CLASS, CAPSULE_ATTR_CONTENT, CAPSULE_ATTR_ID };
