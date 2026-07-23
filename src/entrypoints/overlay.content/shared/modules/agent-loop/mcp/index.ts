/**
 * MCP Layer — Public API.
 */

export type { MCPServer, ToolSchema, ToolDefinition, ToolParameterSchema } from './types';
export { mcpRegistry } from './registry';
export { BUILTIN_MCP } from './builtin-mcp';
export { generateToolSchemaPrompt } from './schema-generator';
