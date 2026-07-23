/**
 * Built-in MCP Server definition — "Better Sidebar".
 *
 * Contains all core tools: activate_skill, execute_sql,
 * sync_conversation_messages, export, complete_task.
 */

import type { MCPServer } from './types';
import { activateSkillProvider } from './providers/activate-skill-provider';
import { sqlProvider } from './providers/sql-provider';
import { syncProvider } from './providers/sync-provider';
import { exportProvider } from './providers/export-provider';
import { taskProvider } from './providers/task-provider';

export const BUILTIN_MCP: MCPServer = {
  id: 'builtin-bettersidebar',
  type: 'builtin',
  name: 'Better Sidebar',
  description: 'Core tools for managing conversations, data, and tasks',
  enabled: true,
  tools: [activateSkillProvider, sqlProvider, syncProvider, exportProvider, taskProvider],
};
