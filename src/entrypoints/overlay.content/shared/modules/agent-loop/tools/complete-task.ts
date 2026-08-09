/**
 * complete_task Tool.
 *
 * Explicit end-of-session signal. The engine watches for the sentinel below and
 * stops the loop; the summary drives the card in the Agent tab.
 *
 * `status` exists because "done" and "can't be done" are both terminal but mean
 * opposite things to the user. An AI that concluded the request was impossible had
 * no way to say so, so it wrote a prose explanation — which landed in the
 * no-tool-call path, where the nudge told it to keep using tools. Being told to
 * retry something you've already ruled out is worse than stalling.
 */

import type { TaskOutcome } from '../types';
import { agentEventBus } from '../event-bus';

/** Sentinel result prefix that the engine checks to stop the loop */
export const COMPLETE_TASK_SIGNAL = '__TASK_COMPLETE__';

const VALID_OUTCOMES: TaskOutcome[] = ['success', 'partial', 'infeasible'];

interface CompleteTaskParams {
  summary: string;
  status?: string;
}

export interface CompleteTaskSignal {
  status: TaskOutcome;
  summary: string;
}

export async function completeTask(params: CompleteTaskParams): Promise<string> {
  const summary = params.summary?.trim();

  if (!summary) {
    return 'ERROR: complete_task requires a "summary" parameter describing what was accomplished.';
  }

  const raw = params.status?.trim().toLowerCase() as TaskOutcome | undefined;
  // Unrecognised values read as success — the old callers passed no status at all,
  // and a typo shouldn't turn a finished task into a failed one.
  const status: TaskOutcome = raw && VALID_OUTCOMES.includes(raw) ? raw : 'success';

  console.log(`[AgentLoop] Task completed (${status}):`, summary);

  agentEventBus.emit('debug:log', {
    level: status === 'infeasible' ? 'warn' : 'info',
    message: `Task completed (${status}): ${summary}`,
  });

  return `${COMPLETE_TASK_SIGNAL}:${status}:${summary}`;
}

/**
 * Read a sentinel back, or null when this isn't one.
 *
 * Tolerates the old `__TASK_COMPLETE__:summary` shape, since a summary that
 * happens to start with a word like "partial" would otherwise be misread.
 */
export function parseCompleteTaskSignal(result: string): CompleteTaskSignal | null {
  if (!result.startsWith(`${COMPLETE_TASK_SIGNAL}:`)) return null;

  const rest = result.slice(COMPLETE_TASK_SIGNAL.length + 1);
  const separator = rest.indexOf(':');

  if (separator > 0) {
    const candidate = rest.slice(0, separator) as TaskOutcome;
    if (VALID_OUTCOMES.includes(candidate)) {
      return { status: candidate, summary: rest.slice(separator + 1).trim() };
    }
  }

  return { status: 'success', summary: rest.trim() };
}
