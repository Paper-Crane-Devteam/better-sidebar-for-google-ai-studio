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

const AUTO_ENTRY: AgentEntry = {
  id: AGENT_AUTO_ID,
  title: 'Better Sidebar Agent',
  description: 'Describe a task and let the agent pick the right tools',
  icon: 'Bot',
  capsuleContent: 'Better Sidebar Agent',
};

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
  return [AUTO_ENTRY, ...getSkillsForPopup().map(toEntry)];
}

/** Resolve an entry by id (works for both the auto sentinel and skill ids). */
export function getAgentEntryById(id: string): AgentEntry | undefined {
  if (id === AGENT_AUTO_ID) return AUTO_ENTRY;
  const skill = getSkillById(id);
  return skill ? toEntry(skill) : undefined;
}

/** Match entries against a query (multi-word AND over title + description). */
export function searchAgentEntries(query: string): AgentEntry[] {
  const entries = getAgentEntries();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries.slice(0, 8);

  return entries
    .filter((e) => {
      const haystack = `${e.title} ${e.description}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .slice(0, 8);
}
