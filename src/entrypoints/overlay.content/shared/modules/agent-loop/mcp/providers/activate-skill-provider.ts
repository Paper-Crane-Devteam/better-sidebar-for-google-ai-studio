/**
 * activate_skill Meta-Tool Provider.
 *
 * Schema-only — execution is handled by the engine directly (not via MCP execute).
 * This provider exists so the schema is included in the prompt generation.
 */

import type { ToolDefinition } from '../types';

export const activateSkillProvider: ToolDefinition = {
  schema: {
    name: 'activate_skill',
    description:
      'Activate a specialized skill to get detailed instructions for a specific task type. Call this when the user task matches a known skill.',
    parameters: {
      type: 'object',
      properties: {
        skill_id: {
          type: 'string',
          description: 'The ID of the skill to activate',
        },
      },
      required: ['skill_id'],
    },
  },
  // This is never called via mcpRegistry.execute() — engine intercepts it.
  // Providing a fallback that returns an error if somehow reached.
  execute: async () =>
    'ERROR: activate_skill should be handled by the engine, not executed directly.',
};
