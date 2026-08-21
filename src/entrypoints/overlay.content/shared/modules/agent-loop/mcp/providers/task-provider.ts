/**
 * complete_task MCP Tool Provider.
 */

import type { ToolDefinition } from '../types';
import { completeTask } from '../../tools/complete-task';

export const taskProvider: ToolDefinition = {
  schema: {
    name: 'complete_task',
    description:
      'End the agent loop. Call this when the request is fulfilled, and also when you have concluded it ' +
      'cannot be fulfilled — use the status parameter to say which. Never end a session by simply ' +
      'explaining the outcome in prose. ' +
      'IMPORTANT: put this in a response of its own, never alongside other tool calls. You do not see ' +
      "the results of the tools in the response you are writing, so a completion issued next to them " +
      'reports an outcome you have not actually observed. Issue the work, read the results on your next ' +
      'turn, then call this. A completion sent in a response where anything failed or was refused is ' +
      'discarded and the results are returned to you instead.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'A concise summary of what was accomplished (1-3 sentences)',
        },
        status: {
          type: 'string',
          description:
            'Optional, defaults to "success". "partial" when some of the request was done and something ' +
            'blocked the rest. "infeasible" when the request cannot be carried out at all — explain why ' +
            'in the summary.',
        },
      },
      required: ['summary'],
    },
  },
  execute: async (params) => completeTask({ summary: params.summary, status: params.status }),
};
