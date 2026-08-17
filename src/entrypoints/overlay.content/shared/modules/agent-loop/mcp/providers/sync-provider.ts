/**
 * sync_conversation_messages MCP Tool Provider.
 */

import type { ToolDefinition } from '../types';
import { syncMessages } from '../../tools/sync';

export const syncProvider: ToolDefinition = {
  schema: {
    name: 'sync_conversation_messages',
    description:
      "Record the message history of conversations that have none in the database. There is no API for this: the tab navigates to each conversation and scrolls its history to the top so the extension can capture the messages. TERMINAL — it leaves the current page, so the agent session ends here and you get no further turn. Tell the user what is about to happen (the tab will move through N conversations and come back) BEFORE calling it, and make it the last tool call in your response.",
    parameters: {
      type: 'object',
      properties: {
        conversation_ids: {
          type: 'array',
          description:
            'Array of conversations.external_id values (max 50), written as a real JSON array: ["c_abc123","c_def456"]. Do NOT wrap it in quotes — a quoted array breaks the whole tool call. Gemini only.',
        },
      },
      required: ['conversation_ids'],
    },
  },
  execute: async (params) => syncMessages({ conversation_ids: params.conversation_ids }),
};
