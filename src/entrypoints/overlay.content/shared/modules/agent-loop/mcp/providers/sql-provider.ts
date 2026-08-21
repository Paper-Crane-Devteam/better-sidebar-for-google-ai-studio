/**
 * execute_sql MCP Tool Provider.
 */

import type { ToolDefinition } from '../types';
import { executeSql } from '../../tools/execute-sql';

export const sqlProvider: ToolDefinition = {
  schema: {
    name: 'execute_sql',
    description:
      'Execute SQL queries against the local conversation database. Supports SELECT, INSERT, UPDATE, DELETE.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The SQL statement to execute',
        },
        change_summary: {
          type: 'string',
          description:
            'REQUIRED for INSERT/UPDATE/DELETE, omit for SELECT. Markdown explaining, in ' +
            "plain language, exactly what this statement will change to the user's data. " +
            'This is what they read when deciding whether to allow it, and they cannot read ' +
            'SQL — so name the actual folders, tags and conversations involved, and say how ' +
            'many. Do not restate the SQL or mention tables and columns. ' +
            'Example: "Creates 4 new tags (Work, Study, Life, Misc), then files 100 ' +
            'currently-untagged conversations under them. Nothing is deleted and no existing ' +
            'tag is changed."',
        },
      },
      required: ['query'],
    },
  },
  // `change_summary` is deliberately not passed on: it exists for the approval UI, and
  // the tool has no use for it. See NON_IDENTITY_PARAMS.
  execute: async (params) => executeSql({ query: params.query }),
};
