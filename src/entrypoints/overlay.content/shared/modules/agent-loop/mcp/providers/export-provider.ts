/**
 * export MCP Tool Provider.
 */

import type { ToolDefinition } from '../types';
import { exportConversations } from '../../tools/export-tool';

export const exportProvider: ToolDefinition = {
  schema: {
    name: 'export',
    description:
      'Download conversations as files, the same way the sidebar Export command does. Handles ' +
      'several conversations and several formats in one call. Use it whenever the user asks to ' +
      'export, download, or save conversations — do not paste the content into chat instead.',
    parameters: {
      type: 'object',
      properties: {
        ids: {
          type: 'string',
          description:
            'JSON array of conversation IDs, e.g. ["abc","def"]. These are the "id" column of ' +
            'the conversations table, not external_id and not the title.',
        },
        format: {
          type: 'string',
          description:
            'Optional. "markdown", "text" or "json"; pass several as a JSON array or a ' +
            'comma-separated list to download one file per format. Leave it out when the user ' +
            'did not say which format they want — the extension then asks them directly with its ' +
            'format picker, so never ask about the format in prose.',
        },
        separate_files: {
          type: 'string',
          description:
            'Optional, "true" to give each conversation its own file inside a zip. The default ' +
            'merges several conversations into one file.',
        },
        batch_name: {
          type: 'string',
          description:
            'Optional base filename when exporting several conversations, e.g. the folder or ' +
            'topic name. Ignored for a single conversation, which is named after its title.',
        },
      },
      required: ['ids'],
    },
  },
  execute: async (params) =>
    exportConversations({
      ids: params.ids,
      format: params.format,
      separate_files: params.separate_files,
      batch_name: params.batch_name,
    }),
};
