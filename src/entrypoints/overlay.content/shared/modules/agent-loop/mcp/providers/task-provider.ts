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
      'explaining the outcome in prose.',
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
