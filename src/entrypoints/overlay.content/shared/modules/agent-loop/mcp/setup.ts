/**
 * MCP Setup — Registers all built-in MCP servers on module load.
 *
 * Import this file early in the agent-loop initialization path
 * to ensure the registry is populated before any prompt assembly.
 */

import { mcpRegistry } from './registry';
import { BUILTIN_MCP } from './builtin-mcp';
import { WORKSPACE_MCP, WORKSPACE_MCP_ID } from './workspace-mcp';
import { DOCUMENT_MCP, DOCUMENT_MCP_ID } from './document-mcp';
import { useAgentConfigStore } from '../agent-config-store';

/**
 * Servers the agent cannot run without.
 *
 * `builtin-bettersidebar` holds `complete_task` and `activate_skill` — the loop has
 * no way to end or to specialise without them, so it is not offered as a toggle.
 * Everything else is the user's choice.
 */
const REQUIRED_SERVER_IDS: readonly string[] = [BUILTIN_MCP.id];

/**
 * Initialize the MCP registry with builtin server(s).
 */
export function initMCPRegistry(): void {
  mcpRegistry.registerServer({ ...BUILTIN_MCP });
  mcpRegistry.registerServer({ ...WORKSPACE_MCP });
  // Documents depend on the workspace to hold the file, but they are a separate toggle:
  // the file tools are useful without Office parsing, and the schemas cost prompt space
  // for every user who never drops a .docx in.
  mcpRegistry.registerServer({ ...DOCUMENT_MCP });

  syncMCPEnabledState();
}

/**
 * Sync MCP server enabled states from the config store.
 *
 * Required servers are forced on regardless of what is persisted. Optional ones —
 * currently the workspace — read `disabledMcpServers`, so seven file-tool schemas
 * stay out of the prompt for users who don't want them.
 *
 * ⚠️ Must be called after any change to `disabledMcpServers`: the registry holds its
 * own `enabled` flag, and the store alone does not reach it.
 */
export function syncMCPEnabledState(): void {
  const { disabledMcpServers } = useAgentConfigStore.getState();

  for (const server of mcpRegistry.getServers()) {
    const required = REQUIRED_SERVER_IDS.includes(server.id);
    mcpRegistry.setServerEnabled(
      server.id,
      required || !disabledMcpServers.includes(server.id),
    );
  }
}

/** Whether the workspace file tools are currently available to the agent. */
export function isWorkspaceEnabled(): boolean {
  return !useAgentConfigStore.getState().disabledMcpServers.includes(WORKSPACE_MCP_ID);
}

/** Turn the workspace server on or off, and push the change into the registry. */
export function setWorkspaceEnabled(enabled: boolean): void {
  const { disabledMcpServers, toggleMcpServer } = useAgentConfigStore.getState();
  const currentlyDisabled = disabledMcpServers.includes(WORKSPACE_MCP_ID);
  if (currentlyDisabled === !enabled) return; // already in the requested state
  toggleMcpServer(WORKSPACE_MCP_ID);
  syncMCPEnabledState();
}

/** Whether the document tools are currently available to the agent. */
export function isDocumentsEnabled(): boolean {
  return !useAgentConfigStore.getState().disabledMcpServers.includes(DOCUMENT_MCP_ID);
}

/** Turn the documents server on or off, and push the change into the registry. */
export function setDocumentsEnabled(enabled: boolean): void {
  const { disabledMcpServers, toggleMcpServer } = useAgentConfigStore.getState();
  const currentlyDisabled = disabledMcpServers.includes(DOCUMENT_MCP_ID);
  if (currentlyDisabled === !enabled) return;
  toggleMcpServer(DOCUMENT_MCP_ID);
  syncMCPEnabledState();
}
