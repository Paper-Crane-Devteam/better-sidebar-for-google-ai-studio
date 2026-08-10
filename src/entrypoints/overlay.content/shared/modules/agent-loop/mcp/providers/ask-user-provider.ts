/**
 * ask_user MCP Tool Provider.
 *
 * The schema text here is what the AI actually reads — `schema-generator.ts` writes
 * it into the prompt — so the wording carries the protocol rule about ending a
 * response, not just the parameter list.
 */

import type { ToolDefinition } from '../types';
import { askUser } from '../../tools/ask-user';

export const askUserProvider: ToolDefinition = {
  schema: {
    name: 'ask_user',
    description:
      'Ask the user for a decision only they can make — approving a plan, choosing between approaches, ' +
      'or clarifying an ambiguous request. Use this instead of ending a response with a question in prose: ' +
      'prose questions cannot be answered and stall the task. This ends the current response; ' +
      'the answer arrives in the next message as "User Response". ' +
      'Do not use it to request permission for a write operation — the extension handles that itself.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description:
            'The decision you need, phrased so it can be answered directly. Include the concrete plan or ' +
            'the trade-off you want judged, not just "shall I continue?".',
        },
        options: {
          type: 'string',
          description:
            'Optional JSON array of short answer labels, e.g. ["Apply as proposed","Folders only","Let me adjust"]. ' +
            'Omit when the answer is open-ended.',
        },
        allow_free_text: {
          type: 'string',
          description:
            'Optional. "false" to require picking one of the options. Defaults to "true".',
        },
      },
      required: ['question'],
    },
  },
  execute: async (params) =>
    askUser({
      question: params.question,
      options: params.options,
      allow_free_text: params.allow_free_text,
    }),
};
