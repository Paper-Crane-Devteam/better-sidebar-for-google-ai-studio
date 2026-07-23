/**
 * MCP Schema Generator.
 *
 * Generates the tool schema text section for injection into the Soul prompt.
 * Lists all tools from all enabled MCP servers, grouped by server.
 */

import { mcpRegistry } from './registry';

/**
 * Generate tool schema prompt section for all enabled MCP servers.
 * Output format is human-readable markdown suitable for prompt injection.
 */
export function generateToolSchemaPrompt(): string {
  const servers = mcpRegistry.getEnabledServers();

  if (servers.length === 0) return 'No tools available.';

  let output = '';

  for (const server of servers) {
    output += `## MCP: ${server.name}\n`;
    output += `${server.description}\n\n`;

    for (const tool of server.tools) {
      const { schema } = tool;
      output += `### ${schema.name}\n`;
      output += `${schema.description}\n`;
      output += `Parameters:\n`;

      for (const [key, val] of Object.entries(schema.parameters.properties)) {
        const isRequired = schema.parameters.required.includes(key);
        output += `  - ${key}: ${val.type}${isRequired ? ' (required)' : ''} — ${val.description}\n`;
      }
      output += '\n';
    }
  }

  return output.trim();
}
