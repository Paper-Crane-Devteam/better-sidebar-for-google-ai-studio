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

import { isHandoffTool } from '../../engine/parser/tool-schema';
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

/**
 * Whether this turn was the last one of its session, however it got there.
 *
 * Wider than `readSessionEnd` on purpose, and the distinction matters: that one
 * answers "what did the AI say the verdict was", which only `complete_task` can
 * report. This one answers "is there still a session behind this turn", and a handoff
 * tool ends one just as firmly without reporting anything — it takes the page away
 * (see `HANDOFF_TOOLS`), so its result is never sent back and its outcome stays `null`
 * for good.
 *
 * That permanent `null` is a trap for anything scanning for "tool calls nobody ran":
 * the sync run's own call looks exactly like unfinished business every time the user
 * returns to the conversation, and acting on it re-books the tab for the whole road
 * trip. Hence one predicate, used by every such scan.
 */
export function endsSession(message: DisplayMessageTurn): boolean {
  if (message.role !== 'model') return false;
  if (readSessionEnd(message) !== null) return true;
  return message.toolCalls.some((call) => isHandoffTool(call.toolCall.name));
}
