/**
 * AgentLoopFeature — Gemini entry point for Agent Loop.
 *
 * Flow:
 * 1. User types `>` → popup shows built-in prompts
 * 2. User selects a prompt → capsule inserted (shared <strong> pattern)
 * 3. User optionally types additional context after the capsule
 * 4. User presses Enter → onBeforeSend extracts prompt info, composes full message, sends, starts engine
 * 5. Engine listens for AI response, parses tool calls, loops
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { useCurrentConversationId } from '@/entrypoints/overlay.content/shared/hooks/useCurrentConversationId';
import { showCapsuleDetailModal } from '@/entrypoints/overlay.content/shared/lib/capsule-modal';
import {
  AgentCommandPopup,
  AgentLoopControlPanel,
  AgentLoopEngine,
  useAgentTrigger,
  useAgentLoopStore,
  getBasePrompt,
  ConversationOverlay,
  ConversationViewSwitcher,
  injectRendererStyles,
  buildPromptMarker,
} from '@/entrypoints/overlay.content/shared/modules/agent-loop';
import {
  createAdapterForCurrentPlatform,
  getCurrentPlatformId,
} from '@/entrypoints/overlay.content/shared/modules/agent-loop/adapters/adapter-factory';
import type { AgentPlatformAdapter } from '@/entrypoints/overlay.content/shared/modules/agent-loop';
import {
  useEditorIntegration,
  insertCapsule,
  expandAllCapsules,
  CAPSULE_CLASS,
} from '@/entrypoints/overlay.content/shared/features/trigger-popup';
import type { TriggerPopupItem, CapsuleClickInfo } from '@/entrypoints/overlay.content/shared/features/trigger-popup';
import { installSendButtonInterceptor } from '@/entrypoints/overlay.content/shared/lib/quill-editor';

export const AgentLoopFeature: React.FC = () => {
  const slashCommandEnabled = useSettingsStore(
    (s) => s.enhancedFeatures.gemini.slashCommand,
  );

  const adapterRef = useRef<AgentPlatformAdapter | null>(null);
  const getAdapter = useCallback((): AgentPlatformAdapter | null => {
    if (!adapterRef.current) {
      adapterRef.current = createAdapterForCurrentPlatform();
    }
    return adapterRef.current;
  }, []);

  const engineRef = useRef<AgentLoopEngine | null>(null);
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


  const handleCapsuleClick = useCallback((info: CapsuleClickInfo) => {
    showCapsuleDetailModal('Prompt Content', info.content);
  }, []);

  const triggerStateRef = useRef(triggerState);
  triggerStateRef.current = triggerState;
  const getSelectedPromptRef = useRef(getSelectedPrompt);
  getSelectedPromptRef.current = getSelectedPrompt;

  // ─── Initialize renderer styles & editor interceptors ──────────────

  useEffect(() => {
    injectRendererStyles();
    installSendButtonInterceptor();
  }, []);

  // ─── Result capsule click handler (shows content in modal) ──────────

  useEffect(() => {
    const handleResultCapsuleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.bs-agent-result-capsule');
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      const content = target.getAttribute('data-result-content') || '';
      showCapsuleDetailModal('Tool Results', content);
    };

    document.addEventListener('click', handleResultCapsuleClick);
    return () => document.removeEventListener('click', handleResultCapsuleClick);
  }, []);

  // ─── Start agent loop engine ────────────────────────────────────────

  const startAgentEngine = useCallback(() => {
    const adapter = getAdapter();
    if (!adapter) {
      console.error('[AgentLoop] No adapter available for current platform');
      return;
    }
    const engine = new AgentLoopEngine(adapter);
    engineRef.current = engine;
    setTimeout(() => engine.start(20), 300);
  }, [getAdapter]);

  const handleStop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const handleRetry = useCallback(() => {
    engineRef.current?.resume();
  }, []);

  // ─── Capsule insertion ──────────────────────────────────────────────

  function handleConfirmSelection() {
    const prompt = getSelectedPromptRef.current();
    if (!prompt) return;

    const adapter = getAdapter();
    const editor = adapter?.getEditor();
    if (!adapter || !editor) return;

    const triggerPos = triggerStateRef.current.triggerPosition;
    const cursorPos = adapter.getCursorPosition();

    const item: TriggerPopupItem = {
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      icon: prompt.icon,
      content: prompt.getPromptContent(),
    };

    close();
    insertCapsule(editor, triggerPos, cursorPos, item, '>');
    editor.focus();
  }

  const handleConfirmSelectionRef = useRef(handleConfirmSelection);
  handleConfirmSelectionRef.current = handleConfirmSelection;

  // ─── Editor integration ─────────────────────────────────────────────

  const { popupPosition, suppressInput } = useEditorIntegration({
    getEditor: () => getAdapter()?.getEditor() || null,
    enabled: slashCommandEnabled,
    triggerChar: '>',
    onInput: (text, cursorPos) => {
      if (useAgentLoopStore.getState().status !== 'idle') return;
      handleInput(text, cursorPos);
    },
    getPopupState: () => triggerStateRef.current as any,
    selectPrevious,
    selectNext,
    close,
    onConfirmSelection: () => handleConfirmSelectionRef.current(),
    onCapsuleClick: handleCapsuleClick,
    onBeforeSend: (editor) => {
      // Extract prompt info from capsule BEFORE expansion (only agent capsules with data-trigger=">")
      const capsule = editor.querySelector(`.${CAPSULE_CLASS}[data-trigger=">"]`);
      if (!capsule) return false;

      const promptId = capsule.getAttribute('data-prompt-id') || '';
      const promptContent = capsule.getAttribute('data-prompt-content') || '';

      if (!promptId || !promptContent) return false;

      const adapter = getAdapter();
      if (!adapter) return false;

      // Expand all capsules (both / and >) to get the full editor text
      expandAllCapsules(editor);

      // Collect user's additional input (everything that's not the prompt content)
      const editorText = editor.textContent || '';
      const userInput = editorText.replace(promptContent, '').trim();

      // Compose full message
      const marker = buildPromptMarker(promptId);
      const platform = getCurrentPlatformId();
      const basePrompt = getBasePrompt({ platform });

      let fullMessage = `${marker}\n${basePrompt}\n\n${promptContent}`;
      if (userInput) {
        fullMessage += `\n\n## User Request\n\n${userInput}`;
      }
      if (fullMessage.length > 30000) {
        fullMessage = fullMessage.substring(0, 30000);
        console.warn('[AgentLoop] Message truncated to 30000 chars');
      }

      // Send via adapter and start engine
      adapter.insertText(fullMessage);
      adapter.triggerSend().then(() => startAgentEngine());

      return true; // We handled sending
    },
  });

  // ─── Monitor slash command popup for mutual exclusion ───────────────

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const slashPopup = document.querySelector('[data-slash-command-popup]');
      setIsSlashCommandActive(!!slashPopup);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!slashCommandEnabled) return null;

  return (
    <>
      <ConversationViewSwitcher />
      <ConversationOverlay />

      {triggerState.isOpen && (
        <AgentCommandPopup
          matches={triggerState.matches}
          selectedIndex={triggerState.selectedIndex}
          onHighlight={setHighlight}
          onConfirm={(index) => {
            const matches = triggerStateRef.current.matches;
            if (matches[index]) {
              suppressInput();
              setHighlight(index);
              handleConfirmSelectionRef.current();
            }
          }}
          position={popupPosition}
          query={triggerState.query}
        />
      )}



      <AgentLoopControlPanel onStop={handleStop} onRetry={handleRetry} />
    </>
  );
};
