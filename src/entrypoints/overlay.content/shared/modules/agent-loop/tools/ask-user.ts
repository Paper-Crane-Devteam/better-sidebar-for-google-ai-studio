/**
 * ask_user Tool — the third legal way for a response to end.
 *
 * Before this existed the protocol only recognised "more tool calls" or
 * `complete_task`, so an AI that proposed a plan and waited for approval fell into
 * the no-tool-call path: nudged twice to "use a tool to continue" — which pushes it
 * to guess instead of ask — and then stopped as a circuit-breaker fault. The user's
 * answer had nowhere to go either, since the tab's note input only rides along with
 * the next batch of tool results, and that round produced none.
 *
 * Like `complete_task` this returns a sentinel the engine recognises rather than a
 * normal result, because the round ends here: nothing gets handed back to the AI
 * until a human answers.
 *
 * Deliberately *not* a permission gate. Write confirmation is a separate axis owned
 * by `execution-policy` and switchable by the user; an approved plan grants no
 * execution rights, so a mismatch between what was asked and what gets executed
 * can't slip through.
 */

import type { AgentQuestion } from '../types';
import { useAgentLoopStore } from '../agent-loop-store';

/** Sentinel result prefix the engine checks to park the loop */
export const ASK_USER_SIGNAL = '__AWAIT_USER__';

/**
 * Questions allowed per session.
 *
 * Asking is free in round budget (a human is in the loop, so there's no runaway
 * risk) which removes the usual brake — hence an explicit cap, otherwise
 * "ask again" becomes a way to stall forever.
 */
export const MAX_ASK_USER_PER_SESSION = 5;

/** Cap on how much question text is kept, so a runaway response can't flood the UI */
const MAX_QUESTION_LENGTH = 4000;
const MAX_OPTIONS = 6;
const MAX_OPTION_LENGTH = 120;

export interface AskUserParams {
  question: string;
  /** JSON array of strings, or a `|` / newline separated list */
  options?: string;
  /** "false" to force a choice from `options` */
  allow_free_text?: string;
}

/**
 * Parse the `options` param.
 *
 * Params arrive as strings, so a list has to be encoded somehow. JSON is what the
 * prompt asks for, but models improvise, so a separated list is accepted too —
 * a mangled list should cost the user a button, not the whole question.
 */
function parseOptions(raw?: string): string[] {
  const text = raw?.trim();
  if (!text) return [];

  const collected: unknown[] = (() => {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON — fall through to the separated-list reading
    }
    return text.split(/\n|\|/);
  })();

  const labels: string[] = [];

  for (const entry of collected) {
    // Objects show up when the model reaches for {label, value} shapes
    const label =
      typeof entry === 'string'
        ? entry
        : typeof entry === 'object' && entry !== null
          ? String(
              (entry as Record<string, unknown>).label ??
                (entry as Record<string, unknown>).value ??
                '',
            )
          : String(entry ?? '');

    const trimmed = label.trim().slice(0, MAX_OPTION_LENGTH);
    if (trimmed && !labels.includes(trimmed)) labels.push(trimmed);
    if (labels.length >= MAX_OPTIONS) break;
  }

  return labels;
}

export async function askUser(params: AskUserParams): Promise<string> {
  const question = params.question?.trim();

  if (!question) {
    return 'ERROR: ask_user requires a "question" parameter describing the decision you need from the user.';
  }

  const asked = useAgentLoopStore.getState().askUserCount;
  if (asked >= MAX_ASK_USER_PER_SESSION) {
    return (
      `ERROR: You have already asked the user ${asked} questions in this task, which is the limit. ` +
      `Do not ask again. Either proceed with the safest reasonable interpretation, ` +
      `or call complete_task with status "infeasible" explaining what you still need.`
    );
  }

  const payload: AgentQuestion = {
    question: question.slice(0, MAX_QUESTION_LENGTH),
    options: parseOptions(params.options),
    // Opt-out rather than opt-in: locking the user into preset buttons is the
    // worse failure, since a question they can't answer stalls the whole task.
    allowFreeText: params.allow_free_text?.trim().toLowerCase() !== 'false',
    source: 'tool',
  };

  console.log('[AgentLoop] ask_user:', payload.question, payload.options);

  return `${ASK_USER_SIGNAL}:${JSON.stringify(payload)}`;
}

/** Read a sentinel back into a question, or null when this isn't one */
export function parseAskUserSignal(result: string): AgentQuestion | null {
  if (!result.startsWith(`${ASK_USER_SIGNAL}:`)) return null;

  const json = result.slice(ASK_USER_SIGNAL.length + 1);

  try {
    const parsed = JSON.parse(json) as Partial<AgentQuestion>;
    if (!parsed.question) return null;

    return {
      question: parsed.question,
      options: Array.isArray(parsed.options) ? parsed.options : [],
      allowFreeText: parsed.allowFreeText !== false,
      source: parsed.source === 'fallback' ? 'fallback' : 'tool',
    };
  } catch {
    // A sentinel we can't read would otherwise park the loop on an empty question
    console.warn('[AgentLoop] Could not parse ask_user payload');
    return null;
  }
}

/**
 * Build a question out of a response that asked in prose instead of calling the
 * tool. Used only after nudging has already failed — handing an unanswerable
 * question to the user still beats dead-ending the task.
 */
export function buildFallbackQuestion(responseText: string): AgentQuestion | null {
  const text = responseText.trim();
  if (!text) return null;

  return {
    question: text.slice(0, MAX_QUESTION_LENGTH),
    options: [],
    allowFreeText: true,
    source: 'fallback',
  };
}
