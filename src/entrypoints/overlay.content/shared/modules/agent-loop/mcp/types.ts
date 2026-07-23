/**
 * MCP Layer — Type definitions.
 *
 * Defines the standard interfaces for tool schemas, tool definitions,
 * and MCP Server containers.
 */

// ─── Tool Schema (written into prompt for AI) ────────────────────────────────

/** JSON Schema for tool parameters */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, { type: string; description: string }>;
  required: string[];
}

/** Tool schema — the "contract" that AI sees in the prompt */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

// ─── Tool Definition (schema + executor) ─────────────────────────────────────

/** Complete tool definition — schema + execution function */
export interface ToolDefinition {
  schema: ToolSchema;
  execute: (params: Record<string, string>) => Promise<string>;
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

/** MCP Server — a container of related tools */
export interface MCPServer {
  id: string;
  type: 'builtin' | 'custom';
  name: string;
  description: string;
  enabled: boolean;
  tools: ToolDefinition[];
}
