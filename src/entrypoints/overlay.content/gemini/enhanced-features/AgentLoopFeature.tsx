/**
 * AgentLoopFeature — Gemini entry point for Agent Loop.
 *
 * Flow:
 * 1. User types `>` (or clicks a card in the Agent tab launcher)
 * 2. An entry is staged in the editor as a capsule
 * 3. User optionally types additional context after the capsule
 * 4. On send → composeAndSend() builds the full prompt and starts the engine
 * 5. Engine watches the AI response, parses tool calls, loops
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { showCapsuleDetailModal } from '@/entrypoints/overlay.content/shared/lib/capsule-modal';
import {
  AgentCommandPopup,
  AgentLoopEngine,
  useAgentTrigger,
  useAgentLoopStore,
  ConversationOverlay,
  ConversationViewSwitcher,
  injectRendererStyles,
  buildPromptMarker,
  setActiveEngine,
  clearActiveEngine,
  agentEventBus,
} from '@/entrypoints/overlay.content/shared/modules/agent-loop';
import { useCurrentConversationId } from '@/entrypoints/overlay.content/shared/hooks/useCurrentConversationId';
import { useConversationMessages } from '@/entrypoints/overlay.content/shared/modules/agent-loop/renderer/useConversationMessages';
import {
  createAdapterForCurrentPlatform,
  getCurrentPlatformId,
} from '@/entrypoints/overlay.content/shared/modules/agent-loop/adapters/adapter-factory';
import { assembleFinalPrompt } from '@/entrypoints/overlay.content/shared/modules/agent-loop/prompts/prompt-assembler';
import { getEnabledSkills } from '@/entrypoints/overlay.content/shared/modules/agent-loop/skills/skill-registry';
import { initMCPRegistry } from '@/entrypoints/overlay.content/shared/modules/agent-loop/mcp/setup';
import { getAgentEntryById } from '@/entrypoints/overlay.content/shared/modules/agent-loop/agent-entry';
import { buildToolCallFingerprint } from '@/entrypoints/overlay.content/shared/modules/agent-loop/execution-policy';
import type { AgentPlatformAdapter } from '@/entrypoints/overlay.content/shared/modules/agent-loop';
import {
  useEditorIntegration,
  insertCapsule,
  expandAllCapsules,
  CAPSULE_CLASS,
} from '@/entrypoints/overlay.content/shared/features/trigger-popup';
import type { TriggerPopupItem, CapsuleClickInfo } from '@/entrypoints/overlay.content/shared/features/trigger-popup';
import {
  installSendButtonInterceptor,
  appendCapsule,
  insertTextAtEnd,
  triggerSend,
  CAPSULE_ATTR_ID,
  CAPSULE_ATTR_CONTENT,
} from '@/entrypoints/overlay.content/shared/lib/quill-editor';

const MAX_MESSAGE_LENGTH = 30000;

export const AgentLoopFeature: React.FC = () => {
  const slashCommandEnabled = usePegasusStore(
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

  // Conversation the session will be attached to (kept in a ref for callbacks)
  const conversationId = useCurrentConversationId();
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const {
    state: triggerState,
    handleInput,
    selectPrevious,
    selectNext,
    setHighlight,
    close,
    getSelectedEntry,
  } = useAgentTrigger(isSlashCommandActive);

  const handleCapsuleClick = useCallback((info: CapsuleClickInfo) => {
    showCapsuleDetailModal('Prompt Content', info.content);
  }, []);

  const triggerStateRef = useRef(triggerState);
  triggerStateRef.current = triggerState;
  const getSelectedEntryRef = useRef(getSelectedEntry);
  getSelectedEntryRef.current = getSelectedEntry;

  // ─── Initialize renderer styles & editor interceptors ──────────────

  useEffect(() => {
    initMCPRegistry();
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

  const startAgentEngine = useCallback(
    (session?: { title?: string }) => {
      const adapter = getAdapter();
      if (!adapter) {
        console.error('[AgentLoop] No adapter available for current platform');
        return;
      }
      const engine = new AgentLoopEngine(adapter);
      engineRef.current = engine;
      // Publish the instance so the Agent tab can stop / retry / continue it
      setActiveEngine(engine);
      setTimeout(
        () =>
          engine.start(20, {
            conversationId: conversationIdRef.current,
            title: session?.title,
          }),
        300,
      );
    },
    [getAdapter],
  );

  // Release the engine handle when this feature unmounts
  useEffect(() => {
    return () => {
      if (engineRef.current) clearActiveEngine(engineRef.current);
    };
  }, []);

  // ─── Auto-pickup: detect tool calls in latest response while idle ───

  const messages = useConversationMessages();
  const autoPickupFiredRef = useRef(false);

  // Reset the guard when status leaves idle (session started), so a *subsequent*
  // idle period can fire again.
  useEffect(() => {
    const unsub = useAgentLoopStore.subscribe((s) => {
      if (s.status !== 'idle') autoPickupFiredRef.current = false;
    });
    return unsub;
  }, []);

  /**
   * When the engine is idle but the newest AI response contains tool calls with no
   * matching results (i.e. nothing was sent back), the user continued the
   * conversation without re-triggering `>`. The AI is still talking in tool format
   * because it remembers the system prompt from the previous session.
   *
   * Automatically start a new session using the existing response element, skipping
   * the "wait for AI" stage that would never resolve (the answer is already there).
   */
  useEffect(() => {
    if (autoPickupFiredRef.current) return;

    const status = useAgentLoopStore.getState().status;
    if (status !== 'idle') return;

    // Find the last model turn
    const lastModel = [...messages].reverse().find((m) => m.role === 'model');
    if (!lastModel) return;
    if (!lastModel.toolCalls || lastModel.toolCalls.length === 0) return;
    // Still streaming — wait for it to finish
    if (lastModel.isStreaming) return;

    // If any outcome is already known (from the next user message), it's history
    if (lastModel.toolOutcomes.some((o) => o !== null)) return;

    // Also skip if the ledger already knows these calls (current live session)
    const store = useAgentLoopStore.getState();
    const anyKnown = lastModel.toolCalls.some((tc) => {
      const fp = buildToolCallFingerprint(tc.toolCall);
      return store.executedCalls[fp] !== undefined;
    });
    if (anyKnown) return;

    // We need the actual DOM element to pass to the engine
    const adapter = getAdapter();
    if (!adapter) return;
    const responseElement = adapter.getLastAIResponseElement();
    if (!responseElement) return;

    autoPickupFiredRef.current = true;

    console.log('[AgentLoop] Auto-pickup: detected unexecuted tool calls in idle state, starting session');

    const engine = new AgentLoopEngine(adapter);
    engineRef.current = engine;
    setActiveEngine(engine);
    engine.startFromExistingResponse(responseElement, 20, {
      conversationId: conversationIdRef.current,
      title: 'Follow-up task',
    });
  }, [messages, getAdapter]);

  // ─── Capsule insertion (from the `>` popup) ─────────────────────────

  function handleConfirmSelection() {
    const entry = getSelectedEntryRef.current();
    if (!entry) return;

    const adapter = getAdapter();
    const editor = adapter?.getEditor();
    if (!adapter || !editor) return;

    const triggerPos = triggerStateRef.current.triggerPosition;
    const cursorPos = adapter.getCursorPosition();

    const item: TriggerPopupItem = {
      id: entry.id,
      title: entry.title,
      description: entry.description,
      icon: entry.icon,
      content: entry.capsuleContent,
    };

    close();
    insertCapsule(editor, triggerPos, cursorPos, item, '>');
    editor.focus();
  }

  const handleConfirmSelectionRef = useRef(handleConfirmSelection);
  handleConfirmSelectionRef.current = handleConfirmSelection;

  // ─── Compose + send (shared by Enter, send button and launcher) ─────

  const composeAndSend = useCallback(
    (editor: HTMLElement): boolean => {
      const capsule = editor.querySelector(`.${CAPSULE_CLASS}[data-trigger=">"]`);
      if (!capsule) return false;

      const entryId = capsule.getAttribute(CAPSULE_ATTR_ID) || '';
      const capsuleContent = capsule.getAttribute(CAPSULE_ATTR_CONTENT) || '';
      if (!entryId) return false;

      const adapter = getAdapter();
      if (!adapter) return false;

      // Expand all capsules (both / and >) to read the full editor text
      expandAllCapsules(editor);

      // Whatever the user typed around the capsule
      const editorText = editor.textContent || '';
      const userInput = capsuleContent
        ? editorText.replace(capsuleContent, '').trim()
        : editorText.trim();

      // The auto entry has no preselected skill — the AI calls activate_skill itself
      const entry = getAgentEntryById(entryId);
      const basePrompt = assembleFinalPrompt({
        selectedSkill: entry?.skill,
        allSkills: getEnabledSkills(),
        platform: getCurrentPlatformId(),
      });

      let fullMessage = `${buildPromptMarker(entryId)}\n${basePrompt}`;
      if (userInput) {
        fullMessage += `\n\n## User Request\n\n${userInput}`;
      }
      if (fullMessage.length > MAX_MESSAGE_LENGTH) {
        fullMessage = fullMessage.substring(0, MAX_MESSAGE_LENGTH);
        console.warn(`[AgentLoop] Message truncated to ${MAX_MESSAGE_LENGTH} chars`);
      }

      const title = userInput || entry?.title || 'Agent task';

      adapter.insertText(fullMessage);
      // User pressed Enter / clicked send, so no artificial pause. Only start the
      // engine if the message actually went out — otherwise it would sit waiting
      // for a response to a prompt that was never delivered.
      adapter.triggerSend({ humanDelay: false }).then((sent) => {
        if (sent) startAgentEngine({ title });
        else console.warn('[AgentLoop] Initial prompt was not sent, engine not started');
      });

      return true; // We handled sending
    },
    [getAdapter, startAgentEngine],
  );

  // ─── Editor integration (`>`) ───────────────────────────────────────

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
    onBeforeSend: composeAndSend,
  });

  const suppressInputRef = useRef(suppressInput);
  suppressInputRef.current = suppressInput;

  // ─── Launcher bridge (Agent tab → editor) ───────────────────────────

  useEffect(() => {
    return agentEventBus.on('launcher:run-entry', async ({ entryId, userInput, autoSend }) => {
      const adapter = getAdapter();
      const editor = adapter?.getEditor();
      if (!editor) {
        agentEventBus.emit('launcher:failed', { reason: 'no-editor' });
        return;
      }

      const entry = getAgentEntryById(entryId);
      if (!entry) {
        agentEventBus.emit('launcher:failed', { reason: 'unknown-entry' });
        return;
      }

      // Inserting ">Title" would otherwise re-open the trigger popup
      suppressInputRef.current();

      await appendCapsule(editor, `>${entry.title}`, {
        className: CAPSULE_CLASS,
        dataAttrs: {
          [CAPSULE_ATTR_ID]: entry.id,
          [CAPSULE_ATTR_CONTENT]: entry.capsuleContent,
          'data-trigger': '>',
        },
      });

      if (userInput?.trim()) {
        insertTextAtEnd(editor, userInput.trim());
      }

      agentEventBus.emit('launcher:staged', { entryId, autoSend });

      if (autoSend) {
        // Route through the real send button so the interceptor composes the message
        await triggerSend({ humanDelay: false });
      } else {
        editor.focus();
      }
    });
  }, [getAdapter]);

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

      {/* Agent entry popup (>) — auto entry first, then skills */}
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
    </>
  );
};
