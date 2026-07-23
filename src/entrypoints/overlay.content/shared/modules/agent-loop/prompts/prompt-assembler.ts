/**
 * Prompt Assembler — composes the final prompt from Soul + Skills + MCP schemas.
 *
 * Two main entry points:
 * 1. assembleFinalPrompt() — called when user triggers agent (> popup select)
 * 2. assembleSkillActivation() — called when AI invokes activate_skill tool
 */

import type { Skill } from '../skills/types';
import type { PlatformId } from '../adapters/adapter-factory';
import { getSoulPrompt } from './soul';
import { generateToolSchemaPrompt } from '../mcp/schema-generator';

// ─── Skills Summary Generation ───────────────────────────────────────────────

/**
 * Generate skills summary for the Soul prompt.
 * Lists all enabled skills so AI can call activate_skill.
 */
function generateSkillsSummary(skills: Skill[]): string {
  if (skills.length === 0) return 'No skills available.';

  let output = '### Available Skills\n\n';
  for (const skill of skills) {
    output += `- **${skill.id}**: ${skill.title} — ${skill.description}\n`;
  }
  output += '\nTo activate a skill, call:\n';
  output += '```\n<bs_agent_tool>\n{"name": "activate_skill", "description": "Activating skill", "params": {"skill_id": "SKILL_ID"}}\n</bs_agent_tool>\n```\n';
  return output;
}

// ─── Main Assembly ───────────────────────────────────────────────────────────

export interface AssembleOptions {
  /** User explicitly chose a skill from popup (null = free-form / AI will choose) */
  selectedSkill?: Skill;
  /** All enabled skills (for generating summary) */
  allSkills: Skill[];
  /** Current platform */
  platform: PlatformId | null;
}

/**
 * Assemble the final prompt to inject into the editor capsule.
 *
 * If a skill is pre-selected: Soul + tool schemas + skill prompt content
 * If no skill selected (free-form): Soul + skills summary + tool schemas
 */
export function assembleFinalPrompt(options: AssembleOptions): string {
  const { selectedSkill, allSkills, platform } = options;

  // If user selected a specific skill, no need for AI to choose
  const skillsSummary = selectedSkill
    ? `### Active Skill: ${selectedSkill.title}\n\n(Skill instructions follow after the tools section.)`
    : generateSkillsSummary(allSkills);

  const toolSchemas = generateToolSchemaPrompt();

  let prompt = getSoulPrompt({
    platform,
    skillsSummary,
    toolSchemas,
  });

  // Append selected skill's prompt content
  if (selectedSkill) {
    prompt += `\n\n## Active Skill Instructions\n\n${selectedSkill.promptContent}`;
  }

  return prompt;
}

// ─── Skill Activation Response ───────────────────────────────────────────────

/**
 * Assemble the response when AI calls activate_skill.
 * Returns skill prompt content so AI gets specialized instructions.
 */
export function assembleSkillActivation(skill: Skill): string {
  return `## Skill Activated: ${skill.title}

${skill.promptContent}

You now have specialized instructions for this task. Proceed with execution using the available tools.`;
}
