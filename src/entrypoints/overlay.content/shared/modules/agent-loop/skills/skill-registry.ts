/**
 * Skill Registry — combines builtin + custom skills.
 *
 * Runtime queries merge BUILTIN_SKILLS with the persisted custom skills
 * from the agent config store.
 *
 * For builtin skills, `titleKey` / `descriptionKey` are resolved via i18n so
 * that UI consumers see localized strings. Custom skills use their raw fields.
 */

import type { Skill } from './types';
import { BUILTIN_SKILLS } from './builtin-skills';
import { useAgentConfigStore } from '../agent-config-store';
import i18n from '@/locale/i18n';

/** Resolve i18n keys on a builtin skill (display layer only; promptContent stays English). */
function localize(skill: Skill): Skill {
  if (!skill.titleKey) return skill;
  return {
    ...skill,
    title: i18n.t(skill.titleKey, { defaultValue: skill.title }),
    description: skill.descriptionKey
      ? i18n.t(skill.descriptionKey, { defaultValue: skill.description })
      : skill.description,
  };
}

/**
 * Get all skills (builtin + custom), with enabled state applied.
 * Builtin skills check disabledBuiltinSkills; custom skills use their own enabled field.
 */
export function getAllSkills(): Skill[] {
  const { customSkills, disabledBuiltinSkills } = useAgentConfigStore.getState();

  const builtins = BUILTIN_SKILLS.map((s) => localize({
    ...s,
    enabled: !disabledBuiltinSkills.includes(s.id),
  }));

  return [...builtins, ...customSkills];
}

/**
 * Get only enabled skills (for popup and prompt assembly).
 * Sorted: builtin first, then custom by createdAt desc.
 */
export function getEnabledSkills(): Skill[] {
  return getAllSkills().filter((s) => s.enabled);
}

/**
 * Get skills for the trigger popup.
 * Enabled only, sorted: builtin first, custom by creation date desc.
 */
export function getSkillsForPopup(): Skill[] {
  const enabled = getEnabledSkills();
  const builtins = enabled.filter((s) => s.type === 'builtin');
  const customs = enabled
    .filter((s) => s.type === 'custom')
    .sort((a, b) => b.createdAt - a.createdAt);
  return [...builtins, ...customs];
}

/**
 * Get a skill by ID (from both builtin and custom).
 */
export function getSkillById(id: string): Skill | undefined {
  return getAllSkills().find((s) => s.id === id);
}
