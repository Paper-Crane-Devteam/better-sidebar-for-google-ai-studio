/**
 * Tool Registry.
 * Routes parsed tool calls to MCP registry or handles meta-tools (activate_skill).
 * Replaces the old switch-case pattern with MCP provider delegation.
 */

import type { ParsedToolCall } from '../types';
import { mcpRegistry } from '../mcp/registry';
import { getSkillById, getEnabledSkills } from '../skills/skill-registry';
import { useAgentLoopStore } from '../agent-loop-store';
import { assembleSkillActivation } from '../prompts/prompt-assembler';

/**
 * Execute a parsed tool call and return the result string.
 */
export async function executeToolCall(toolCall: ParsedToolCall): Promise<string> {
  // ── 1. Meta-tool: activate_skill ─────────────────────────────────────
  if (toolCall.name === 'activate_skill') {
    const skillId = toolCall.params.skill_id;
    if (!skillId) {
      return 'ERROR: activate_skill requires a "skill_id" parameter.';
    }

    const skill = getSkillById(skillId);
    if (!skill) {
      const available = getEnabledSkills()
        .map((s) => s.id)
        .join(', ');
      return `ERROR: Skill "${skillId}" not found. Available skills: ${available}`;
    }

    // Record activated skill in store
    useAgentLoopStore.getState().setActiveSkillId(skillId);

    // Return skill prompt content
    return assembleSkillActivation(skill);
  }

  // ── 2. Check if tool's MCP server is enabled ─────────────────────────
  if (!mcpRegistry.isToolEnabled(toolCall.name)) {
    return `CANCELLED: 工具 ${toolCall.name} 不可用（其所属 MCP 已被禁用）`;
  }

  // ── 3. Delegate to MCP registry ──────────────────────────────────────
  return mcpRegistry.execute(toolCall.name, toolCall.params);
}
