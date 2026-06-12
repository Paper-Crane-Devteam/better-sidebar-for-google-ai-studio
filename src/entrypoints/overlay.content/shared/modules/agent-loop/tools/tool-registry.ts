/**
 * Tool Registry.
 * Routes parsed tool calls to their respective executor functions.
 */

import type { ParsedToolCall } from '../types';
import { executeSql } from './execute-sql';
import { syncMessages } from './sync-messages';
import { exportConversations } from './export-tool';
import { completeTask } from './complete-task';

/**
 * Execute a parsed tool call and return the result string.
 */
export async function executeToolCall(toolCall: ParsedToolCall): Promise<string> {
  switch (toolCall.name) {
    case 'execute_sql':
      return executeSql({ query: toolCall.params.query });

    case 'sync_conversation_messages':
      return syncMessages({ conversation_ids: toolCall.params.conversation_ids });

    case 'export':
      return exportConversations({
        ids: toolCall.params.ids,
        format: toolCall.params.format,
      });

    case 'complete_task':
      return completeTask({ summary: toolCall.params.summary });

    default:
      return `ERROR: Unknown tool "${toolCall.name}". Available tools: execute_sql, sync_conversation_messages, export, complete_task.`;
  }
}
