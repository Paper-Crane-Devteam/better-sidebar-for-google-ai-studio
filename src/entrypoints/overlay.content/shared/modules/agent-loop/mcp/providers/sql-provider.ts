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
      },
      required: ['query'],
    },
  },
  execute: async (params) => executeSql({ query: params.query }),
};
