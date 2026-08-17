/**
 * Reading "the task ended here" out of the conversation.
 *
 * The end marker used to be drawn from the runtime store's `endReason`, which a
 * reload wipes, the next `start()` clears, and which isn't scoped to a conversation
 * at all — so the divider vanished while the transcript still plainly ended with a
 * `complete_task` call, and followed the user onto other chats that happened to have
 * agent content.
 *
 * The call itself is the record: it sits in the model turn in the DOM. Present means
 * the task ended, absent means it didn't. Nothing else to keep in sync.
 *
 * The status mapping mirrors `engine/stages/execute-tools.ts`: anything that isn't
 * "infeasible" reads as a completion, including a missing or misspelt status, for the
 * same reason `completeTask` defaults that way — a typo shouldn't turn a finished
 * task into a failed one.
 */

import type { DisplayMessageTurn } from '../useConversationMessages';

/** The tool whose presence in a turn means the session ended there */
const COMPLETION_TOOL = 'complete_task';

/** How the task ended, as the AI reported it */
export type SessionOutcome = 'complete' | 'infeasible';

/**
 * Whether this turn closes a task, and how it went. `null` for anything else.
 *
 * Scans from the back: a response is capped at five tool calls and the completion is
 * meant to be the last of them, so the final one is the verdict if the AI ever
 * repeats itself.
 */
export function readSessionEnd(message: DisplayMessageTurn): SessionOutcome | null {
  if (message.role !== 'model') return null;

  for (let i = message.toolCalls.length - 1; i >= 0; i--) {
    const call = message.toolCalls[i].toolCall;
    if (call.name !== COMPLETION_TOOL) continue;
    return (call.params.status ?? '').trim().toLowerCase() === 'infeasible'
      ? 'infeasible'
      : 'complete';
  }

  return null;
}
