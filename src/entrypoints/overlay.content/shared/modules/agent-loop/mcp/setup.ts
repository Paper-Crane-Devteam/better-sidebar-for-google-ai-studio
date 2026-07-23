/**
 * MCP Setup — Registers all built-in MCP servers on module load.
 *
 * Import this file early in the agent-loop initialization path
 * to ensure the registry is populated before any prompt assembly.
 */

import { mcpRegistry } from './registry';
import { BUILTIN_MCP } from './builtin-mcp';
import { useAgentConfigStore } from '../agent-config-store';

/**
 * Initialize the MCP registry with builtin server(s).
 * Applies user's disabled state from the config store.
 */
export function initMCPRegistry(): void {
  // Register builtin
  mcpRegistry.registerServer({ ...BUILTIN_MCP });

  // Apply user's disabled state
  syncMCPEnabledState();
}

/**
 * Sync MCP server enabled states from the agent config store.
 * Call this on store change to keep registry in sync.
 */
export function syncMCPEnabledState(): void {
  const { disabledBuiltinMCPs } = useAgentConfigStore.getState();

  for (const server of mcpRegistry.getServers()) {
    if (server.type === 'builtin') {
      mcpRegistry.setServerEnabled(server.id, !disabledBuiltinMCPs.includes(server.id));
    }
  }
}
