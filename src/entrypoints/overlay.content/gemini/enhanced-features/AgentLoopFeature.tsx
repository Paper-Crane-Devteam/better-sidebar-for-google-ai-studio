/**
 * AgentLoopFeature — Gemini entry point for Agent Loop.
 *
 * Thin wrapper that:
 * 1. Creates a GeminiAgentAdapter
 * 2. Monitors the editor for `>` prefix input
 * 3. Shows AgentCommandPopup on trigger
 * 4. On selection: composes full message (base + utility + user input), sends, starts engine
 * 5. Renders status bar and confirm dialog
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
} from '@/entrypoints/overlay.content/shared/modules/agent-loop';
import type { BuiltInPrompt } from '@/entrypoints/overlay.content/shared/modules/agent-loop';

/**
 * Gemini Agent Loop Feature Component.
 */
export const AgentLoopFeature: React.FC = () => {
  // Feature toggle — reuse slashCommand setting for now (or add agentLoop setting)
  const slashCommandEnabled = useSettingsStore(
    (s) => s.enhancedFeatures.gemini.slashCommand,
  );

  const adapterRef = useRef(new GeminiAgentAdapter());
  const engineRef = useRef<AgentLoopEngine | null>(null);
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

  /**
   * Compose the full message and start the agent loop.
   */
  const startAgentLoop = useCallback(
    (prompt: BuiltInPrompt, userInput: string) => {
      const adapter = adapterRef.current;

      // Compose: base prompt + utility prompt + user input
      const basePrompt = getBasePrompt();
      const utilityPrompt = prompt.getPromptContent();

      let fullMessage = basePrompt + '\n\n' + utilityPrompt;
      if (userInput.trim()) {
        fullMessage += '\n\n## User Request\n\n' + userInput.trim();
      }

      // Truncate to 30000 chars if needed
      if (fullMessage.length > 30000) {
        fullMessage = fullMessage.substring(0, 30000);
        console.warn('[AgentLoop] Message truncated to 30000 chars');
      }

      // Insert into editor and send
      adapter.insertText(fullMessage);

      // Create engine and start loop
      const engine = new AgentLoopEngine(adapter);
      engineRef.current = engine;

      // Send first, then start engine to listen for response
      adapter.triggerSend().then(() => {
        // Small delay to ensure message is sent before engine starts observing
        setTimeout(() => {
          engine.start(20);
        }, 300);
      });
    },
    [],
  );

  const startAgentLoopRef = useRef(startAgentLoop);
  startAgentLoopRef.current = startAgentLoop;

  /** Handle selecting a prompt from the popup */
  const handleConfirmSelection = useCallback(
    (index: number) => {
      const match = triggerState.matches[index];
      if (!match) return;

      const adapter = adapterRef.current;
      const text = adapter.getText();

      // Extract user input (text after the > trigger + prompt selection)
      // The text after `>query` where query matched the prompt
      // For now, just use empty — user types their request after selecting
      // Actually, let's just replace the `>query` with nothing and start immediately
      // OR: we could keep the user's typed text after the prompt name as their request

      // Get text after the `>` trigger position
      const triggerPos = triggerStateRef.current.triggerPosition;
      const beforeTrigger = text.substring(0, triggerPos);
      const afterQuery = ''; // User's additional input would be here in future UX iterations

      // Clear editor and start agent loop with the selected prompt
      close();
      startAgentLoopRef.current(match, afterQuery);
    },
    [triggerState.matches, close],
  );

  // Set up input monitoring
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
            const prompt = getSelectedPromptRef.current();
            if (prompt) {
              const index = triggerStateRef.current.matches.findIndex(
                (m) => m.id === prompt.id,
              );
              if (index >= 0) {
                handleConfirmSelection(index);
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
  }, [slashCommandEnabled, handleConfirmSelection]);

  // Monitor for slash command popup to track its active state
  useEffect(() => {
    // Check if slash command popup exists in DOM (crude but works)
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
      {/* Agent command popup (> trigger) */}
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

      {/* Status bar (shown during loop execution) */}
      {loopStatus !== 'idle' && (
        <AgentLoopStatusBar onStop={handleStop} onRetry={handleRetry} />
      )}

      {/* Confirmation dialog (shown for write operations) */}
      <AgentLoopConfirmDialog />
    </>
  );
};
