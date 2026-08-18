/**
 * Agent entries — what the `>` popup and the Agent tab launcher offer.
 *
 * There used to be two triggers: `>` picked a skill, `!` activated the agent
 * without preselecting one. They produced nearly the same message, needed two
 * editor-integration instances, and only one of them could own the shared
 * send-button handler. Now there is a single list whose first item is the
 * "let the AI decide" entry.
 */

import type { Skill } from './skills/types';
import { getSkillsForPopup, getSkillById } from './skills/skill-registry';
import i18n from '@/locale/i18n';

/** Sentinel id for "run the agent, let it pick a skill itself" */
export const AGENT_AUTO_ID = '__agent_auto__';

export interface AgentEntry {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Text stored on the capsule; stripped from the editor before assembling */
  capsuleContent: string;
  /** The skill to preload, or undefined for the auto entry */
  skill?: Skill;
}

function getAutoEntry(): AgentEntry {
  return {
    id: AGENT_AUTO_ID,
    title: i18n.t('agent.entry.autoTitle', { defaultValue: 'Better Sidebar Agent' }),
    description: i18n.t('agent.entry.autoDescription', { defaultValue: 'Describe a task and let the agent pick the right tools' }),
    icon: 'Bot',
    capsuleContent: 'Better Sidebar Agent',
  };
}

function toEntry(skill: Skill): AgentEntry {
  return {
    id: skill.id,
    title: skill.title,
    description: skill.description,
    icon: skill.icon,
    capsuleContent: skill.promptContent,
    skill,
  };
}

/** All entries: auto first, then enabled skills. */
export function getAgentEntries(): AgentEntry[] {
  return [getAutoEntry(), ...getSkillsForPopup().map(toEntry)];
}

/** Resolve an entry by id (works for both the auto sentinel and skill ids). */
export function getAgentEntryById(id: string): AgentEntry | undefined {
  if (id === AGENT_AUTO_ID) return getAutoEntry();
  const skill = getSkillById(id);
  return skill ? toEntry(skill) : undefined;
}

/** Match entries against a query (multi-word AND over title + description).
 *
 * The auto entry ("Better Sidebar Agent") is always kept at the top as a group
 * header/anchor so the tree structure stays visible even when filtering.
 */
export function searchAgentEntries(query: string): AgentEntry[] {
  const entries = getAgentEntries();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  if (words.length === 0) return entries.slice(0, 9); // auto + up to 8 skills

  const matched = entries.filter((e) => {
    const haystack = `${e.title} ${e.description}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });

  // Always keep auto entry at position 0 if there are any matches
  const hasAuto = matched.some((e) => e.id === AGENT_AUTO_ID);
  if (!hasAuto && matched.length > 0) {
    matched.unshift(getAutoEntry());
  }

  return matched.slice(0, 9);
}
