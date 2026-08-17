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
import { useI18n } from '@/shared/hooks/useI18n';
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
import { AgentDock } from '@/entrypoints/overlay.content/shared/modules/agent-dock';
import { canUndo, runUndoFlow } from '@/entrypoints/overlay.content/shared/modules/agent-loop/undo';
import { toast } from '@/shared/lib/toast';
import i18n from '@/locale/i18n';
import {
  readConversationIdFromPath,
  useCurrentConversationId,
} from '@/entrypoints/overlay.content/shared/hooks/useCurrentConversationId';
import { useConversationMessages } from '@/entrypoints/overlay.content/shared/modules/agent-loop/renderer/useConversationMessages';
import { endsSession } from '@/entrypoints/overlay.content/shared/modules/agent-loop/renderer/helpers/session-end';
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

/**
 * Whether the engine currently owns the chat input.
 *
 * True exactly while stage ④ has a payload staged there: `sending` (about to click
 * send itself) and `awaiting_send` (waiting for the user to press Enter). Both are
 * states where anything the user adds gets sent as part of the tool results.
 *
 * Other running states — `waiting_ai`, `executing`, `awaiting_approval` — leave the
 * composer empty and free to use.
 */
function isComposerHeldByEngine(): boolean {
  const status = useAgentLoopStore.getState().status;
  return status === 'sending' || status === 'awaiting_send';
}

export const AgentLoopFeature: React.FC = () => {
  const { t } = useI18n();
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
    showCapsuleDetailModal(t('agent.tool.promptTitle', { defaultValue: 'Prompt content' }), info.content);
  }, [t]);

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

  // ─── Undo prompt when a session ends having changed data ────────────

  /**
   * Third entry point for undo, and the only one that finds the user rather than
   * waiting to be found.
   *
   * The other two live in the conversation and in the dock, both of which assume the
   * user is looking at this tab's chat area. Plenty of the time they are in the
   * sidebar checking what the agent actually did to their folders — this reaches them
   * there. Times out on its own, because an offer nobody took is not a problem.
   */
  useEffect(() => {
    return agentEventBus.on('loop:ended', () => {
      if (!canUndo()) return;
      toast.withAction(
        i18n.t('agent.undo.toastPrompt'),
        'info',
        { label: i18n.t('agent.undo.action'), onClick: () => void runUndoFlow() },
        20000,
      );
    });
  }, []);

  // ─── Result capsule click handler (shows content in modal) ──────────

  useEffect(() => {
    const handleResultCapsuleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.bs-agent-result-capsule');
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      const content = target.getAttribute('data-result-content') || '';
      showCapsuleDetailModal(t('agent.tool.resultsTitle', { defaultValue: 'Tool results' }), content);
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

  /**
   * Which response we last picked up, as `conversation:turn:toolcalls`.
   *
   * Keyed rather than a bare "already fired" boolean, and that is the whole point: the
   * overlay is never torn down any more (conversations are switched through Gemini's
   * router, not a page load), so a boolean latch set once — on a response we then
   * declined to run, or on one in some other conversation — stayed set for the life of
   * the tab and quietly disabled pickup for every response after it. The user's next
   * message got an answer full of tool calls that nothing ever executed.
   *
   * A key re-arms by itself for a genuinely different response, while still refusing to
   * fire twice on the same one.
   */
  const pickedUpKeyRef = useRef<string | null>(null);

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

    /**
     * A turn that ended its session is not unfinished business.
     *
     * Neither `complete_task` nor a handoff tool ever gets its result sent back, so
     * their outcomes stay null forever and this check used to read the last turn of
     * every finished task as "tool calls nobody ran". For `complete_task` that spun up
     * a session which re-parsed the completion and ended again — the stray summary
     * card. For a handoff it is worse: re-running it books the tab for the entire sync
     * road trip a second time, which is what greeted the user on getting back from the
     * first one.
     */
    if (endsSession(lastModel)) return;

    /**
     * Bind to the conversation the response is actually in, read from the URL now.
     *
     * `conversationIdRef` follows a 500ms poll (`useUrl`), and this effect is driven by
     * the DOM — so on a router navigation the two disagree for a moment. Binding a
     * session to the previous conversation's id hides the dock outright
     * (`belongsToCurrent`), leaving the engine parked on an approval with no way on
     * screen to answer it.
     */
    const liveConversationId = readConversationIdFromPath() ?? conversationIdRef.current;

    const pickupKey = [
      liveConversationId ?? 'unbound',
      lastModel.id,
      ...lastModel.toolCalls.map((tc) => buildToolCallFingerprint(tc.toolCall)),
    ].join('|');
    if (pickedUpKeyRef.current === pickupKey) return;

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

    pickedUpKeyRef.current = pickupKey;

    console.log('[AgentLoop] Auto-pickup: detected unexecuted tool calls in idle state, starting session');

    const engine = new AgentLoopEngine(adapter);
    engineRef.current = engine;
    setActiveEngine(engine);
    engine.startFromExistingResponse(responseElement, 20, {
      conversationId: liveConversationId,
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
      // No agent capsule — not our send (a `/` prompt capsule ends up here too).
      if (!capsule) return false;

      /**
       * From here on we own this send, whatever happens.
       *
       * Returning false would hand it back to the fallback path, which expands the
       * capsule in place and lets Gemini send it — i.e. it posts the raw skill
       * instructions as an ordinary chat message, with no Soul prompt, no tool
       * schemas and no `[#bs-agent:...#]` marker. That looks to the user exactly
       * like a broken skill: the AI gets a task description it has no tools for, and
       * the conversation never switches to the agent view.
       *
       * So every failure below blocks the send and says why, leaving the capsule
       * where it is so the user can retry.
       */
      const abort = (reason: string, message: string): boolean => {
        console.warn(`[AgentLoop] Not sending: ${reason}`);
        toast.warning(message);
        return true;
      };

      /**
       * A session is already running — do not take over this send.
       *
       * Taking over means `insertText` overwrites whatever is in the composer (which
       * may be the running engine's staged tool results) and `startAgentEngine`
       * builds a second engine. `setActiveEngine` then replaces the handle the UI
       * uses to stop the first one, and `store.start()` wipes its state, so the
       * original keeps looping with nothing able to reach it.
       */
      if (useAgentLoopStore.getState().status !== 'idle') {
        return abort('a task is already running', i18n.t('agent.send.sessionBusy'));
      }

      const entryId = capsule.getAttribute(CAPSULE_ATTR_ID) || '';
      const capsuleContent = capsule.getAttribute(CAPSULE_ATTR_CONTENT) || '';
      if (!entryId) {
        return abort('capsule carries no entry id', i18n.t('agent.send.staleCapsule'));
      }

      const adapter = getAdapter();
      if (!adapter) {
        return abort('no platform adapter', i18n.t('agent.send.noEditor'));
      }

      // The auto entry has no preselected skill — the AI calls activate_skill itself
      const entry = getAgentEntryById(entryId);
      if (!entry) {
        return abort(`unknown entry "${entryId}"`, i18n.t('agent.send.staleCapsule'));
      }

      /**
       * Assembled before the editor is touched. It used to run after
       * `expandAllCapsules`, so anything throwing in here left the expanded skill
       * text sitting in the composer while the exception escaped the click handler —
       * and since nothing had called `preventDefault`, Gemini sent it.
       */
      let basePrompt: string;
      try {
        basePrompt = assembleFinalPrompt({
          selectedSkill: entry.skill,
          allSkills: getEnabledSkills(),
          platform: getCurrentPlatformId(),
        });
      } catch (err) {
        console.error('[AgentLoop] Prompt assembly failed', err);
        return abort('prompt assembly failed', i18n.t('agent.send.assembleFailed'));
      }

      // Expand all capsules (both / and >) to read the full editor text
      expandAllCapsules(editor);

      // Whatever the user typed around the capsule
      const editorText = editor.textContent || '';
      const userInput = capsuleContent
        ? editorText.replace(capsuleContent, '').trim()
        : editorText.trim();

      let fullMessage = `${buildPromptMarker(entryId)}\n${basePrompt}`;
      if (userInput) {
        fullMessage += `\n\n## User Request\n\n${userInput}`;
      }
      if (fullMessage.length > MAX_MESSAGE_LENGTH) {
        fullMessage = fullMessage.substring(0, MAX_MESSAGE_LENGTH);
        console.warn(`[AgentLoop] Message truncated to ${MAX_MESSAGE_LENGTH} chars`);
      }

      const title = userInput || entry.title || 'Agent task';

      adapter.insertText(fullMessage);

      /**
       * Confirm the payload actually landed before clicking send.
       *
       * The composer still holds the expanded skill instructions at this point, so a
       * staging failure doesn't leave us with an empty box to send — it leaves us
       * with the wrong message ready to go.
       */
      if (!(editor.textContent || '').includes(buildPromptMarker(entryId))) {
        console.error('[AgentLoop] Prompt did not land in the composer', {
          expectedLength: fullMessage.length,
          actualLength: (editor.textContent || '').length,
        });
        return abort('prompt did not land in the composer', i18n.t('agent.send.stagingFailed'));
      }

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
      // Suppressed only while the engine's tool results are sitting in the composer.
      // Inserting a capsule there would ride along with the payload on the next send,
      // and the send interceptor would hijack it into a second session.
      //
      // Every other running state leaves the composer alone (waiting on the AI,
      // executing, waiting for approval), so `>` stays available — picking up a new
      // skill mid-conversation is a reasonable thing to want.
      if (isComposerHeldByEngine()) return;
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

      /**
       * Nothing can be launched while a session is live: `composeAndSend` refuses to
       * start a second engine, so staging the capsule would only set the user up to
       * press send and get a warning. Two reasons, because the fix differs — staged
       * tool results need sending, a paused task needs finishing or stopping.
       */
      if (useAgentLoopStore.getState().status !== 'idle') {
        agentEventBus.emit('launcher:failed', {
          reason: isComposerHeldByEngine() ? 'composer-busy' : 'session-busy',
        });
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

      {/* Everything the running loop needs from the user, docked to the composer.
          Hidden while the `>` popup is up — both anchor to the same corner. */}
      <AgentDock hidden={triggerState.isOpen} />

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
