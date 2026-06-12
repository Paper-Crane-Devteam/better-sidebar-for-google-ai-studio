/**
 * complete_task Tool.
 *
 * Explicit task completion signal. When the AI calls this tool,
 * the agent loop engine knows the task is finished and stops.
 *
 * The summary is stored and can be displayed in the UI.
 */

import { agentEventBus } from '../event-bus';

/** Sentinel result string that the engine checks to stop the loop */
export const COMPLETE_TASK_SIGNAL = '__TASK_COMPLETE__';

interface CompleteTaskParams {
  summary: string;
}

export async function completeTask(params: CompleteTaskParams): Promise<string> {
  const summary = params.summary?.trim();

  if (!summary) {
    return 'ERROR: complete_task requires a "summary" parameter describing what was accomplished.';
  }

  console.log('[AgentLoop] Task completed:', summary);

  agentEventBus.emit('debug:log', {
    level: 'info',
    message: `Task completed: ${summary}`,
  });

  // Return the sentinel value — the engine will detect this and stop the loop
  return `${COMPLETE_TASK_SIGNAL}:${summary}`;
}
