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

import { isControlTool, getToolRisk } from '../../execution-policy';
import { isHandoffTool } from '../../engine/parser/tool-schema';
import type { DisplayMessageTurn } from '../useConversationMessages';

/** The tool whose presence in a turn means the session ended there */
const COMPLETION_TOOL = 'complete_task';

/** How the task ended, as the AI reported it */
export type SessionOutcome = 'complete' | 'partial' | 'infeasible';

export interface SessionEnd {
  outcome: SessionOutcome;
  /**
   * What the AI said it did — its `summary` argument, verbatim.
   *
   * Read from the call because there is nowhere else left to read it from. The engine
   * files the summary into the runtime store's `history`, but the card that renders it
   * only appears for an `infeasible` verdict, and the dock hides itself entirely on a
   * clean finish (`finishedNeedsAttention`) — so on the happy path the AI wrote a
   * paragraph that nothing on screen ever showed. Taken from the DOM it also survives a
   * reload and a conversation reopened next week, which the store never could.
   *
   * Empty string when the call carried no summary (a malformed call the tool itself
   * would have rejected).
   */
  summary: string;
}

/**
 * `params.status` → what we show. Mirrors `completeTask`'s tolerance on purpose: an
 * unrecognised value reads as plain success there, and the two must not disagree about
 * the same call.
 */
function readOutcome(status: string | undefined): SessionOutcome {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'infeasible':
      return 'infeasible';
    case 'partial':
      return 'partial';
    default:
      return 'complete';
  }
}

/**
 * Whether this turn closes a task, how it went, and what it says it did. `null` for
 * anything else.
 *
 * Scans from the back: a response is capped at five tool calls and the completion is
 * meant to be the last of them, so the final one is the verdict if the AI ever
 * repeats itself.
 */
export function readSessionEnd(message: DisplayMessageTurn): SessionEnd | null {
  if (message.role !== 'model') return null;

  for (let i = message.toolCalls.length - 1; i >= 0; i--) {
    const call = message.toolCalls[i].toolCall;
    if (call.name !== COMPLETION_TOOL) continue;
    return {
      outcome: readOutcome(call.params.status),
      summary: (call.params.summary ?? '').trim(),
    };
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

/**
 * How much a finished session actually did, read back out of the transcript.
 *
 * Exists so the end marker can match its weight to the work. "Ask what's in my
 * database" is one SELECT and five seconds, and drawing a full-width divider
 * announcing "Task finished" across it overstates both the event and the word
 * "task" — first-time users read it as the feature having closed on them.
 *
 * Counted from the messages rather than the runtime store for the same reason
 * `deriveToolOutcomes` is: the store knows only the session running in this tab, and
 * these markers have to be right on a conversation reopened days later.
 */
export interface SessionWeight {
  /** Tool calls in the session, `complete_task` and friends excluded */
  steps: number;
  /** Whether anything modified the database */
  hadWrites: boolean;
  /** Whether any call failed or was refused */
  hadFailures: boolean;
}

/**
 * Weigh the session that ends at `endIndex`.
 *
 * Walks backwards to the previous ending, so a conversation holding several sessions
 * weighs each one separately instead of accumulating.
 */
export function weighSession(
  messages: DisplayMessageTurn[],
  endIndex: number,
): SessionWeight {
  const weight: SessionWeight = { steps: 0, hadWrites: false, hadFailures: false };

  for (let i = endIndex; i >= 0; i--) {
    const message = messages[i];
    // Stop at the previous session's end — but not at this one's own turn.
    if (i !== endIndex && endsSession(message)) break;
    if (message.role !== 'model') continue;

    message.toolCalls.forEach((call, index) => {
      // Control tools steer the loop; counting them would make every session look
      // like it did one thing more than it did.
      if (isControlTool(call.toolCall.name)) return;

      weight.steps += 1;
      if (getToolRisk(call.toolCall) === 'write') weight.hadWrites = true;

      // `null` is "no result came back", which is normal for the turn still in flight
      // and permanent for a handoff — neither is a failure.
      const outcome = message.toolOutcomes[index];
      if (outcome && !outcome.success) weight.hadFailures = true;
    });
  }

  return weight;
}

/**
 * Whether this session is too small for a full-width divider.
 *
 * The threshold is "is there anything here worth marking": a couple of queries that
 * all worked and changed nothing needs no ceremony, and — the part that makes this
 * safe — has no undo to offer either, so the compact marker isn't hiding a control.
 *
 * Only a plain success qualifies. "Partly done" and "couldn't be done" are verdicts the
 * user has to notice before they walk away believing the work happened, and a line of
 * small grey text is exactly how you fail to notice something.
 */
export function isLightSession(
  outcome: SessionOutcome,
  weight: SessionWeight,
  undoAvailable: boolean,
): boolean {
  return (
    outcome === 'complete' &&
    !undoAvailable &&
    !weight.hadWrites &&
    !weight.hadFailures &&
    weight.steps <= LIGHT_STEP_LIMIT
  );
}

/** Read-only sessions up to this many steps count as light */
const LIGHT_STEP_LIMIT = 3;
