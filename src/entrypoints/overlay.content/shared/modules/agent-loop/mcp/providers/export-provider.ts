/**
 * export MCP Tool Provider.
 */

import type { ToolDefinition } from '../types';
import { exportConversations } from '../../tools/export-tool';

export const exportProvider: ToolDefinition = {
  schema: {
    name: 'export',
    description: 'Export conversations to downloadable files (coming soon).',
    parameters: {
      type: 'object',
      properties: {
        ids: {
          type: 'string',
          description: 'JSON array of conversation IDs to export',
        },
        format: {
          type: 'string',
          description: 'Export format: "markdown", "plaintext", or "json"',
        },
      },
      required: ['ids', 'format'],
    },
  },
  execute: async (params) => exportConversations({ ids: params.ids, format: params.format }),
};
