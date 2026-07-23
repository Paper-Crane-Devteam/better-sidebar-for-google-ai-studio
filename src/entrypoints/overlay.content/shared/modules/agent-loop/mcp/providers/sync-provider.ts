/**
 * sync_conversation_messages MCP Tool Provider.
 */

import type { ToolDefinition } from '../types';
import { syncMessages } from '../../tools/sync-messages';

export const syncProvider: ToolDefinition = {
  schema: {
    name: 'sync_conversation_messages',
    description:
      'Sync message history for specified conversations from the web page (coming soon).',
    parameters: {
      type: 'object',
      properties: {
        conversation_ids: {
          type: 'string',
          description: 'JSON array of conversation external_ids to sync',
        },
      },
      required: ['conversation_ids'],
    },
  },
  execute: async (params) => syncMessages({ conversation_ids: params.conversation_ids }),
};
