/**
 * useAgentViewState — the single answer to "is the agent view on screen right now".
 *
 * The switcher, the overlay and anything that has to step aside for the overlay
 * (the smart scrollbar) all need the same three facts. They used to each derive
 * them, which is how the toggle ended up visible on conversations the overlay
 * would refuse to render.
 */

import { useMemo } from 'react';
import { useAgentLoopStore } from '../agent-loop-store';
import { useConversationMessages, type DisplayMessageTurn } from './useConversationMessages';
import { useCurrentConversationId } from '@/entrypoints/overlay.content/shared/hooks/useCurrentConversationId';

export interface AgentViewState {
  messages: DisplayMessageTurn[];
  /** The conversation on the page contains agent turns (prompt marker / tool calls / results) */
  hasAgentContent: boolean;
  /** A session is running **and it belongs to this conversation** */
  isRunning: boolean;
  /** The agent view is (or should be) what the user is looking at */
  isActive: boolean;
}

export function useAgentViewState(): AgentViewState {
  const viewMode = useAgentLoopStore((s) => s.viewMode);
  const status = useAgentLoopStore((s) => s.status);
  const sessionConversationId = useAgentLoopStore((s) => s.sessionConversationId);
  const conversationId = useCurrentConversationId();
  const messages = useConversationMessages();

  const hasAgentContent = useMemo(
    () =>
      messages.some(
        (m) =>
          Boolean(m.promptId) ||
          (m.toolCalls && m.toolCalls.length > 0) ||
          m.toolResults.length > 0,
      ),
    [messages],
  );

  /**
   * Scoped to the session's own conversation on purpose.
   *
   * `status` is global: walk away from a running task and it stays non-idle,
   * because the engine is still waiting for a response that will never arrive in
   * the chat you're now looking at. Unscoped, that dragged the toggle — and the
   * forced 'custom' view behind it — onto every other conversation you opened.
   *
   * A session started in a brand new chat has no id until the first message is
   * sent, so null counts as "here".
   */
  const isRunning =
    status !== 'idle' &&
    (sessionConversationId === null || sessionConversationId === conversationId);

  return {
    messages,
    hasAgentContent,
    isRunning,
    isActive: viewMode === 'custom' && (hasAgentContent || isRunning),
  };
}
