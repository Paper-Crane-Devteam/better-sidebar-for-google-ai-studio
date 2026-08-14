/**
 * AgentDock — everything the running loop needs from the user, parked on the chat
 * composer's top-right corner.
 *
 * This used to live in the Agent tab, two clicks and a screen-width away from the
 * input box the answer had to be typed into. Worse, it was reachable only when the
 * sidebar happened to be open *and* on the Agent tab — with it closed, an approval
 * request had nowhere to appear at all and the engine sat parked forever.
 *
 * Rules it follows:
 *
 * - **Nothing on screen when nothing is running.** No session, no dock.
 * - **A single line while it works.** Not a progress report — the chat already shows
 *   what each step did, and nobody watches a step counter. The line exists for Stop.
 * - **Unfolds by itself when a decision is due**, and folds back when it's answered.
 *   The user can fold it away, but a *new* decision opens it again: silently keeping
 *   it shut would park the engine behind a collapsed chevron.
 *
 * Approval also renders on the tool call's own card in the chat, which stays the
 * primary place — the SQL is right there. Same pending object, same resolve, whoever
 * answers first wins. This is the copy that's always reachable.
 */

import React, { useEffect, useState } from 'react';
import { useAgentLoopStore } from '../agent-loop/agent-loop-store';
import { useUndoAvailable, useUndoWasUndone } from '../agent-loop/undo';
import { useCurrentConversationId } from '../../hooks/useCurrentConversationId';
import { useComposerAnchor } from './useComposerAnchor';
import { AgentDockPill } from './components/AgentDockPill';
import { AgentApproval } from './components/AgentApproval';
import { AgentContinuePrompt } from './components/AgentContinuePrompt';
import { AgentCheckIn } from './components/AgentCheckIn';
import { AgentInterruptNotice } from './components/AgentInterruptNotice';
import { AgentSessionSummary } from './components/AgentSessionSummary';
import { AgentPolicyControls } from './components/AgentPolicyControls';
import { AgentInstructionInput } from './components/AgentInstructionInput';

/** Never wider than this, however wide the composer is */
const MAX_WIDTH_PX = 420;

interface AgentDockProps {
  /**
   * Hide without unmounting. The `>` entry popup anchors to the same corner of the
   * composer, and two floating panels fighting over one spot is worse than briefly
   * losing sight of the dock — which is safe to hide, because typing `>` only happens
   * while idle.
   */
  hidden?: boolean;
}

export const AgentDock: React.FC<AgentDockProps> = ({ hidden }) => {
  const status = useAgentLoopStore((s) => s.status);
  const endReason = useAgentLoopStore((s) => s.endReason);
  const pendingApproval = useAgentLoopStore((s) => s.pendingApproval);
  const checkInSteps = useAgentLoopStore((s) => s.checkInSteps);
  const awaitingUserSend = useAgentLoopStore((s) => s.awaitingUserSend);
  const sessionConversationId = useAgentLoopStore((s) => s.sessionConversationId);
  const history = useAgentLoopStore((s) => s.history);
  const undoAvailable = useUndoAvailable();
  const undone = useUndoWasUndone();
  const conversationId = useCurrentConversationId();

  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isRunning = status !== 'idle';
  // A session that ended without running a single tool still has something to say
  // (why it couldn't be done, or that a paywall stopped it), so `endReason` alone is
  // enough to keep the dock up.
  const hasSession = isRunning || endReason !== null;

  // A session started in a brand new chat gets its conversation id only after the
  // first send, so an unbound session belongs to whatever chat is open.
  const belongsToCurrent =
    sessionConversationId === null || sessionConversationId === conversationId;

  const visible = hasSession && belongsToCurrent && !hidden;
  const anchor = useComposerAnchor(visible);

  // Adopt the conversation id once the platform assigns one — including after the
  // session has finished, or an unbound session would follow the user everywhere.
  useEffect(() => {
    if (hasSession && sessionConversationId === null && conversationId) {
      useAgentLoopStore.getState().attachSessionConversation(conversationId);
    }
  }, [hasSession, sessionConversationId, conversationId]);

  // Drop a finished session when the user navigates away from its conversation
  useEffect(() => {
    if (!isRunning && endReason !== null && !belongsToCurrent) {
      useAgentLoopStore.getState().reset();
    }
  }, [isRunning, endReason, belongsToCurrent]);

  /**
   * A clean finish dismisses itself; anything the user has to act on stays.
   *
   * An earlier version auto-reset *every* ended session after a moment, which threw
   * away the two cases that exist to be acted upon: `paywall` (whose card carries the
   * upgrade button) and a run with failed steps. It also cleared `endReason`, and with
   * it the inline completion card in the conversation, which reads that field.
   *
   * `undoAvailable` holds it open too — offering to revert the changes is pointless
   * if the offer disappears on its own a second later. So does `undone`: a completed
   * restore means the transcript above now describes changes that no longer exist,
   * and that mismatch is worth leaving on screen until the user closes it.
   */
  useEffect(() => {
    if (isRunning || endReason === null || !belongsToCurrent) return;

    const failedSteps = history.reduce(
      (sum, h) => sum + h.results.filter((r) => !r.success).length,
      0,
    );
    const needsAttention =
      endReason !== 'complete' || failedSteps > 0 || undoAvailable || undone;
    if (needsAttention) return;

    const timer = setTimeout(() => useAgentLoopStore.getState().reset(), 4000);
    return () => clearTimeout(timer);
  }, [isRunning, endReason, belongsToCurrent, history, undoAvailable]);

  /**
   * Identifies *which* decision is currently pending, so a new one can re-open a dock
   * the user folded away. Comparing a boolean wouldn't do it: approve one write, get
   * asked about the next, and the dock would stay shut on a live question.
   */
  const decisionKey = pendingApproval
    ? `approval:${pendingApproval.fingerprint}`
    : // Only an `awaiting_send` the engine won't handle itself, or the dock would
      // unfold and refold once per round through an unattended run.
      status === 'awaiting_send' && awaitingUserSend
      ? 'send'
      : checkInSteps !== null
        ? `checkin:${checkInSteps}`
        : status === 'paused' || status === 'error'
          ? `interrupt:${status}`
          : endReason !== null && !isRunning
            ? `end:${endReason}`
            : null;

  useEffect(() => {
    if (decisionKey) setCollapsed(false);
  }, [decisionKey]);

  // The dock returns null between sessions but stays mounted, so its own state has to
  // be cleared — otherwise the next task opens with the previous one's drawer showing.
  useEffect(() => {
    if (!hasSession) {
      setCollapsed(false);
      setSettingsOpen(false);
    }
  }, [hasSession]);

  if (!visible || !anchor) return null;

  const expanded = decisionKey !== null ? !collapsed : settingsOpen;

  /**
   * With a decision on screen the chevron folds it away; without one there is nothing
   * to fold, so it opens the only other thing the dock holds — the switches. Wiring it
   * to `collapsed` in both cases made it a dead control for the whole run: nothing
   * pending means nothing appears, however many times you click it.
   */
  const toggleExpanded = () => {
    if (decisionKey !== null) setCollapsed((c) => !c);
    else setSettingsOpen((s) => !s);
  };

  // When the task is finished (idle + has an endReason), the dock only needs to show
  // the session summary — the status pill is noise at that point.
  const isFinished = !isRunning && endReason !== null;

  return (
    <div
      className="fixed z-[9998] overflow-hidden rounded-lg bg-popover shadow-[shadow:var(--shadow-popover)]"
      style={{
        bottom: `${anchor.bottom}px`,
        right: `${anchor.right}px`,
        width: `${Math.min(anchor.width, MAX_WIDTH_PX)}px`,
      }}
    >
      {/* Hide the status pill once the task is done — it only adds noise next to the
          summary card. Still shown while the session is running or paused. */}
      {!isFinished && (
        <AgentDockPill
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
          settingsOpen={settingsOpen}
          onToggleSettings={() => {
            setSettingsOpen((s) => !s);
            setCollapsed(false);
          }}
        />
      )}

      {(expanded || isFinished) && (
        <div className="max-h-[50vh] space-y-2 overflow-y-auto px-3 pb-3">
          <AgentApproval />
          <AgentContinuePrompt />
          <AgentCheckIn />
          <AgentInterruptNotice />
          <AgentSessionSummary />

          {settingsOpen && <AgentPolicyControls />}

          {/* Rides along with the next batch of tool results, so it only makes sense
              while a round is still coming. */}
          {isRunning && <AgentInstructionInput />}
        </div>
      )}
    </div>
  );
};
