/**
 * MCP Registry — manages all MCP Servers and their tools.
 *
 * Provides lookup, execution, and schema generation for enabled tools.
 * Tool availability is controlled at the MCP Server level (enable/disable entire server).
 */

import type { MCPServer, ToolDefinition, ToolSchema } from './types';

class MCPRegistry {
  private servers: MCPServer[] = [];

  /** Register a MCP server */
  registerServer(server: MCPServer): void {
    // Replace if same id already registered (for hot-reload)
    const idx = this.servers.findIndex((s) => s.id === server.id);
    if (idx >= 0) {
      this.servers[idx] = server;
    } else {
      this.servers.push(server);
    }
  }

  /** Get all registered servers */
  getServers(): MCPServer[] {
    return this.servers;
  }

  /** Get only enabled servers */
  getEnabledServers(): MCPServer[] {
    return this.servers.filter((s) => s.enabled);
  }

  /** Get all tools from enabled servers */
  getEnabledTools(): ToolDefinition[] {
    return this.getEnabledServers().flatMap((s) => s.tools);
  }

  /** Get all tool schemas from enabled servers */
  getEnabledToolSchemas(): ToolSchema[] {
    return this.getEnabledTools().map((t) => t.schema);
  }

  /** Check if a specific tool is available (its server is enabled) */
  isToolEnabled(toolName: string): boolean {
    return this.getEnabledServers().some((s) => s.tools.some((t) => t.schema.name === toolName));
  }

  /** Find a tool definition by name across all enabled servers */
  findTool(toolName: string): ToolDefinition | undefined {
    for (const server of this.getEnabledServers()) {
      const tool = server.tools.find((t) => t.schema.name === toolName);
      if (tool) return tool;
    }
    return undefined;
  }

  /** Execute a tool by name. Caller must check isToolEnabled first. */
  async execute(toolName: string, params: Record<string, string>): Promise<string> {
    const tool = this.findTool(toolName);
    if (!tool) {
      return `ERROR: Unknown tool "${toolName}". Available tools: ${this.getEnabledToolSchemas().map((s) => s.name).join(', ')}`;
    }
    return tool.execute(params);
  }

  /** Update a server's enabled status */
  setServerEnabled(serverId: string, enabled: boolean): void {
    const server = this.servers.find((s) => s.id === serverId);
    if (server) {
      server.enabled = enabled;
    }
  }

  /** Get all tool names (from all servers, regardless of enabled state) */
  getAllToolNames(): string[] {
    return this.servers.flatMap((s) => s.tools.map((t) => t.schema.name));
  }
}

/** Singleton instance */
export const mcpRegistry = new MCPRegistry();
