/**
 * Built-in Agent definitions.
 * Currently only one: Better Sidebar.
 */

import type { AgentDefinition } from './types';

export const BUILTIN_AGENTS: AgentDefinition[] = [
  {
    id: 'bettersidebar',
    name: 'Better Sidebar',
    description: 'Manage conversations, folders, tags and data with AI',
    icon: 'Bot',
  },
];

/**
 * Get all available agents for the `!` trigger popup.
 */
export function getAvailableAgents(): AgentDefinition[] {
  return BUILTIN_AGENTS;
}

/**
 * Get an agent by ID.
 */
export function getAgentById(id: string): AgentDefinition | undefined {
  return BUILTIN_AGENTS.find((a) => a.id === id);
}
