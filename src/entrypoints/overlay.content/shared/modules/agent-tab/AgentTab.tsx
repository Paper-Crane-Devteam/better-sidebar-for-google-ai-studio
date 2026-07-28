/**
 * AgentTab — Root component for the Agent sidebar tab.
 *
 * Two states:
 * 1. Active / just-finished session for the current conversation → status panel
 * 2. Otherwise → empty state
 *
 * The loop store is a global singleton, so a finished session used to keep
 * showing in every other conversation. Sessions are now scoped to the
 * conversation they started in and cleared on navigation once idle.
 */

import React, { useEffect } from 'react';
import { useAgentLoopStore } from '../agent-loop/agent-loop-store';
import { useCurrentConversationId } from '../../hooks/useCurrentConversationId';
import { AgentStatusPanel } from './components/AgentStatusPanel';
import { AgentLauncher } from './components/AgentLauncher';

export const AgentTab: React.FC = () => {
  const status = useAgentLoopStore((s) => s.status);
  const history = useAgentLoopStore((s) => s.history);
  const currentResults = useAgentLoopStore((s) => s.currentResults);
  const endReason = useAgentLoopStore((s) => s.endReason);
  const sessionConversationId = useAgentLoopStore((s) => s.sessionConversationId);
  const conversationId = useCurrentConversationId();

  const isIdle = status === 'idle';
  // `endReason` counts as data: a session that ended without running any tool
  // still needs to show its summary instead of silently snapping back to the
  // launcher, which reads as "nothing happened".
  const hasData = history.length > 0 || currentResults.length > 0 || endReason !== null;

  // A session started before the conversation had an id (brand new chat) stays
  // attached to whatever conversation is open when it finishes.
  const belongsToCurrent =
    sessionConversationId === null || sessionConversationId === conversationId;

  // Sessions started in a new chat get their conversation id after the first
  // send. Adopt it even once the session has finished, otherwise an unbound
  // session would keep showing up in every other conversation.
  useEffect(() => {
    const hasSessionData = !isIdle || hasData;
    if (hasSessionData && sessionConversationId === null && conversationId) {
      useAgentLoopStore.getState().attachSessionConversation(conversationId);
    }
  }, [isIdle, hasData, sessionConversationId, conversationId]);

  // Drop a finished session when the user navigates away from its conversation
  useEffect(() => {
    if (isIdle && hasData && !belongsToCurrent) {
      useAgentLoopStore.getState().reset();
    }
  }, [isIdle, hasData, belongsToCurrent]);

  const hasSession = (!isIdle || hasData) && belongsToCurrent;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-transparent to-primary/[0.02]">
      {hasSession ? <AgentStatusPanel /> : <AgentLauncher />}
    </div>
  );
};
