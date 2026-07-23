/**
 * complete_task MCP Tool Provider.
 */

import type { ToolDefinition } from '../types';
import { completeTask } from '../../tools/complete-task';

export const taskProvider: ToolDefinition = {
  schema: {
    name: 'complete_task',
    description:
      'Signal that the entire user request has been fully accomplished. Calling this ends the agent loop.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'A concise summary of what was accomplished (1-3 sentences)',
        },
      },
      required: ['summary'],
    },
  },
  execute: async (params) => completeTask({ summary: params.summary }),
};
