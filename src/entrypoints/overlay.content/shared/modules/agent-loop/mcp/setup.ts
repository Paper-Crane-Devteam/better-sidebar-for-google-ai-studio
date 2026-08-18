/**
 * MCP Setup — Registers all built-in MCP servers on module load.
 *
 * Import this file early in the agent-loop initialization path
 * to ensure the registry is populated before any prompt assembly.
 */

import { mcpRegistry } from './registry';
import { BUILTIN_MCP } from './builtin-mcp';

/**
 * Initialize the MCP registry with builtin server(s).
 */
export function initMCPRegistry(): void {
  // Register builtin
  mcpRegistry.registerServer({ ...BUILTIN_MCP });

  syncMCPEnabledState();
}

/**
 * Sync MCP server enabled states.
 *
 * Builtin servers (Better Sidebar) carry the Agent's core tools and can never
 * be disabled, so they are always forced on. Custom servers, once supported,
 * will read their state from the config store here.
 */
export function syncMCPEnabledState(): void {
  for (const server of mcpRegistry.getServers()) {
    if (server.type === 'builtin') {
      mcpRegistry.setServerEnabled(server.id, true);
    }
  }
}
