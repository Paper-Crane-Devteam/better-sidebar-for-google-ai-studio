/**
 * AgentLoopFeature — Gemini entry point for Agent Loop.
 *
 * Revised flow:
 * 1. User types `>` → popup shows built-in prompts
 * 2. User selects a prompt → capsule inserted (like slash command), NOT immediately sent
 * 3. User optionally types additional context after the capsule
 * 4. User presses Enter to send → capsule expanded, prompt marker prepended, message sent
 * 5. Engine starts listening for AI response
 * 6. ConversationRenderer observes DOM to collapse prompts & render tool calls
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSettingsStore } from '@/shared/lib/settings-store';
import {
  GeminiAgentAdapter,
  AgentCommandPopup,
  AgentLoopStatusBar,
  AgentLoopConfirmDialog,
  AgentLoopEngine,
  useAgentTrigger,
  useAgentLoopStore,
  getBasePrompt,
  ConversationRenderer,
  injectRendererStyles,
  buildPromptMarker,
} from '@/entrypoints/overlay.content/shared/modules/agent-loop';
import type { BuiltInPrompt } from '@/entrypoints/overlay.content/shared/modules/agent-loop';

// ─── Agent Capsule Helpers ───────────────────────────────────────────────────

/** Class name for the agent prompt capsule in the editor */
const AGENT_CAPSULE_CLASS = 'bs-agent-capsule';
const AGENT_CAPSULE_ATTR_ID = 'data-bs-prompt-id';

/** Check if the editor has an agent capsule */
function hasAgentCapsule(editor: HTMLElement): boolean {
  return editor.querySelector(`.${AGENT_CAPSULE_CLASS}`) !== null;
}

/** Get the prompt ID from the capsule in the editor */
function getAgentCapsulePromptId(editor: HTMLElement): string | null {
  const capsule = editor.querySelector(`.${AGENT_CAPSULE_CLASS}`);
  return capsule?.getAttribute(AGENT_CAPSULE_ATTR_ID) || null;
}

/**
 * Expand the agent capsule and compose the full message for sending.
 * Returns the composed message text, or null if no capsule found.
 */
function expandAgentCapsule(editor: HTMLElement): { fullMessage: string; promptId: string } | null {
  const capsule = editor.querySelector(`.${AGENT_CAPSULE_CLASS}`) as HTMLElement | null;
  if (!capsule) return null;

  const promptId = capsule.getAttribute(AGENT_CAPSULE_ATTR_ID) || '';
  const promptContent = capsule.getAttribute('data-prompt-content') || '';

  // Get user's additional text (everything after the capsule)
  let userInput = '';
  let node = capsule.nextSibling;
  while (node) {
    userInput += node.textContent || '';
    node = node.nextSibling;
  }
  // Also check sibling paragraphs
  const capsuleParent = capsule.parentElement;
  if (capsuleParent) {
    let sibling = capsuleParent.nextElementSibling;
    while (sibling) {
      userInput += '\n' + (sibling.textContent || '');
      sibling = sibling.nextElementSibling;
    }
  }

  // Compose: marker + base prompt + utility prompt + user input
  const marker = buildPromptMarker(promptId);
  const basePrompt = getBasePrompt();
  let fullMessage = `${marker}\n${basePrompt}\n\n${promptContent}`;

  if (userInput.trim()) {
    fullMessage += `\n\n## User Request\n\n${userInput.trim()}`;
  }

  // Truncate to 30000 chars
  if (fullMessage.length > 30000) {
    fullMessage = fullMessage.substring(0, 30000);
    console.warn('[AgentLoop] Message truncated to 30000 chars');
  }

  return { fullMessage, promptId };
}

/**
 * Insert a capsule into the editor replacing the >query text.
 * Similar to slash command's capsule insertion.
 */
function insertAgentCapsule(
  editor: HTMLElement,
  triggerPos: number,
  cursorPos: number,
  prompt: BuiltInPrompt,
): void {
  const displayText = `>${prompt.title}`;

  // Walk text nodes to select the >query range
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

  // Select the >query text
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);

  // Replace with display text + space
  document.execCommand('insertText', false, displayText + '\u00A0');

  // After Quill processes, wrap in <strong> capsule
  requestAnimationFrame(() => {
    wrapInAgentCapsule(editor, displayText, prompt);
  });
}

/** Find the display text and wrap it in a capsule element */
function wrapInAgentCapsule(editor: HTMLElement, displayText: string, prompt: BuiltInPrompt): void {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent || '';
    const idx = text.indexOf(displayText);
    if (idx === -1) continue;

    const parent = node.parentNode;
    if (!parent) continue;
    if ((parent as HTMLElement).classList?.contains(AGENT_CAPSULE_CLASS)) continue;

    const before = text.slice(0, idx);
    const after = text.slice(idx + displayText.length);

    const strong = document.createElement('strong');
    strong.className = AGENT_CAPSULE_CLASS;
    strong.setAttribute(AGENT_CAPSULE_ATTR_ID, prompt.id);
    strong.setAttribute('data-prompt-content', prompt.getPromptContent());
    strong.contentEditable = 'false';
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

// ─── Component ───────────────────────────────────────────────────────────────

export const AgentLoopFeature: React.FC = () => {
  const slashCommandEnabled = useSettingsStore(
    (s) => s.enhancedFeatures.gemini.slashCommand,
  );

  const adapterRef = useRef(new GeminiAgentAdapter());
  const engineRef = useRef<AgentLoopEngine | null>(null);
  const rendererRef = useRef<ConversationRenderer | null>(null);
  const [popupPosition, setPopupPosition] = useState({ bottom: 0, left: 0 });
  const [isSlashCommandActive, setIsSlashCommandActive] = useState(false);

  const {
    state: triggerState,
    handleInput,
    selectPrevious,
    selectNext,
    setHighlight,
    close,
    getSelectedPrompt,
  } = useAgentTrigger(isSlashCommandActive);

  const loopStatus = useAgentLoopStore((s) => s.status);

  // Refs for stable access in event handlers
  const triggerStateRef = useRef(triggerState);
  triggerStateRef.current = triggerState;
  const handleInputRef = useRef(handleInput);
  handleInputRef.current = handleInput;
  const selectPreviousRef = useRef(selectPrevious);
  selectPreviousRef.current = selectPrevious;
  const selectNextRef = useRef(selectNext);
  selectNextRef.current = selectNext;
  const closeRef = useRef(close);
  closeRef.current = close;
  const getSelectedPromptRef = useRef(getSelectedPrompt);
  getSelectedPromptRef.current = getSelectedPrompt;

  // ─── Initialize renderer ────────────────────────────────────────────

  useEffect(() => {
    injectRendererStyles();
    const renderer = new ConversationRenderer();
    renderer.start();
    rendererRef.current = renderer;
    return () => renderer.stop();
  }, []);

  // ─── Start agent loop (called after message is sent) ────────────────

  const startAgentEngine = useCallback(() => {
    const adapter = adapterRef.current;
    const engine = new AgentLoopEngine(adapter);
    engineRef.current = engine;

    // Small delay to ensure message is sent before engine starts observing
    setTimeout(() => {
      engine.start(20);
    }, 300);
  }, []);

  // ─── Handle capsule insertion (selection from popup) ────────────────

  const handleConfirmSelection = useCallback(
    (index: number) => {
      const match = triggerState.matches[index];
      if (!match) return;

      const adapter = adapterRef.current;
      const editor = adapter.getEditor();
      if (!editor) return;

      const triggerPos = triggerStateRef.current.triggerPosition;
      const cursorPos = adapter.getCursorPosition();

      // Close popup and insert capsule (don't send yet!)
      close();
      insertAgentCapsule(editor, triggerPos, cursorPos, match);

      editor.focus();
    },
    [triggerState.matches, close],
  );

  const handleConfirmSelectionRef = useRef(handleConfirmSelection);
  handleConfirmSelectionRef.current = handleConfirmSelection;

  // ─── Set up input monitoring + send interception ────────────────────

  useEffect(() => {
    if (!slashCommandEnabled) {
      closeRef.current();
      return;
    }

    const adapter = adapterRef.current;
    let currentEditor: HTMLElement | null = null;

    const onInput = () => {
      // Don't interfere if agent loop is running
      if (useAgentLoopStore.getState().status !== 'idle') return;

      const text = adapter.getText();
      const cursorPos = adapter.getCursorPosition();
      handleInputRef.current(text, cursorPos);

      // Update popup position
      const editor = adapter.getEditor();
      if (editor) {
        const rect = editor.getBoundingClientRect();
        setPopupPosition({
          bottom: window.innerHeight - rect.top + 8,
          left: Math.max(rect.left, 16),
        });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // When popup is open, intercept navigation keys
      if (triggerStateRef.current.isOpen) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            e.stopPropagation();
            selectPreviousRef.current();
            return;
          case 'ArrowDown':
            e.preventDefault();
            e.stopPropagation();
            selectNextRef.current();
            return;
          case 'Enter':
          case 'Tab':
            e.preventDefault();
            e.stopPropagation();
            {
              const prompt = getSelectedPromptRef.current();
              if (prompt) {
                const idx = triggerStateRef.current.matches.findIndex(
                  (m) => m.id === prompt.id,
                );
                if (idx >= 0) {
                  handleConfirmSelectionRef.current(idx);
                }
              }
            }
            return;
          case 'Escape':
            e.preventDefault();
            e.stopPropagation();
            closeRef.current();
            return;
        }
      }

      // Intercept Backspace: if cursor is inside agent capsule, delete whole capsule
      if (e.key === 'Backspace' && !triggerStateRef.current.isOpen) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          let node: Node | null = range.startContainer;
          let capsule: HTMLElement | null = null;
          while (node && node !== adapter.getEditor()) {
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              (node as HTMLElement).classList?.contains(AGENT_CAPSULE_CLASS)
            ) {
              capsule = node as HTMLElement;
              break;
            }
            node = node.parentNode;
          }
          if (capsule) {
            e.preventDefault();
            e.stopPropagation();
            const next = capsule.nextSibling;
            if (next?.nodeType === Node.TEXT_NODE && next.textContent?.[0] === '\u00A0') {
              next.textContent = next.textContent.slice(1);
              if (!next.textContent) next.parentNode?.removeChild(next);
            }
            capsule.remove();
            adapter.getEditor()?.dispatchEvent(new Event('input', { bubbles: true }));
            return;
          }
        }
      }

      // Intercept Enter (send) — if there's an agent capsule, expand it first
      if (e.key === 'Enter' && !e.shiftKey && !triggerStateRef.current.isOpen) {
        const editor = adapter.getEditor();
        if (!editor) return;

        // Check for result capsule (tool execution results waiting to be sent)
        const resultCapsule = editor.querySelector('.bs-agent-result-capsule') as HTMLElement | null;
        if (resultCapsule) {
          e.preventDefault();
          e.stopPropagation();

          const resultContent = resultCapsule.getAttribute('data-result-content') || '';
          // Replace editor with the actual result content
          adapter.insertText(resultContent);
          // Send
          adapter.triggerSend();
          return;
        }

        // Check for agent prompt capsule
        if (hasAgentCapsule(editor)) {
          e.preventDefault();
          e.stopPropagation();

          const expanded = expandAgentCapsule(editor);
          if (expanded) {
            adapter.insertText(expanded.fullMessage);
            adapter.triggerSend().then(() => {
              startAgentEngine();
            });
          }
          return;
        }
      }
    };

    const onBlur = () => {
      setTimeout(() => {
        if (triggerStateRef.current.isOpen) {
          closeRef.current();
        }
      }, 300);
    };

    const attachListeners = (editor: HTMLElement) => {
      editor.addEventListener('input', onInput);
      editor.addEventListener('keydown', onKeyDown, true);
      editor.addEventListener('blur', onBlur);
    };

    const detachListeners = (editor: HTMLElement) => {
      editor.removeEventListener('input', onInput);
      editor.removeEventListener('keydown', onKeyDown, true);
      editor.removeEventListener('blur', onBlur);
    };

    // Attach to existing editor
    currentEditor = adapter.getEditor();
    if (currentEditor) {
      attachListeners(currentEditor);
    }

    // Watch for editor appearing/changing (SPA navigation)
    const bodyObserver = new MutationObserver(() => {
      const editor = adapter.getEditor();
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
  }, [slashCommandEnabled, startAgentEngine]);

  // Monitor for slash command popup to track its active state
  useEffect(() => {
    const checkSlashCommand = () => {
      const slashPopup = document.querySelector('[data-slash-command-popup]');
      setIsSlashCommandActive(!!slashPopup);
    };

    const observer = new MutationObserver(checkSlashCommand);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Engine control handlers
  const handleStop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const handleRetry = useCallback(() => {
    engineRef.current?.resume();
  }, []);

  if (!slashCommandEnabled) return null;

  return (
    <>
      {triggerState.isOpen && (
        <AgentCommandPopup
          matches={triggerState.matches}
          selectedIndex={triggerState.selectedIndex}
          onHighlight={setHighlight}
          onConfirm={handleConfirmSelection}
          position={popupPosition}
          query={triggerState.query}
        />
      )}

      {loopStatus !== 'idle' && (
        <AgentLoopStatusBar onStop={handleStop} onRetry={handleRetry} />
      )}

      <AgentLoopConfirmDialog />
    </>
  );
};
