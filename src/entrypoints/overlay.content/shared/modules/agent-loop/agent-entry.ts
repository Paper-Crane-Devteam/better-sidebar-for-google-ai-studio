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

/** Where an entry marker was found in plain composer text */
export interface AgentEntryMatch {
  entry: AgentEntry;
  /** Index of the `>` */
  start: number;
  /** Index just past the title */
  end: number;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find a `>Entry title` marker in plain text.
 *
 * This is how the marker works on composers that cannot hold a capsule — AI Studio's
 * `<textarea>`. The marker is **self-describing**: the entry is recovered from the text
 * itself rather than from state held alongside it. That matters more than it sounds:
 *
 * - It survives the feature component remounting. React state would not, and losing it
 *   is the worst possible failure — the marker is still sitting in the composer, so the
 *   next send posts the raw `>Title` line as an ordinary message and the skill looks
 *   broken.
 * - It makes typing the marker by hand work, which users do once they've seen it.
 *
 * Longest title first, so `>Export chats` is not claimed by a hypothetical `>Export`.
 */
export function matchAgentEntryInText(text: string): AgentEntryMatch | null {
  const entries = [...getAgentEntries()].sort((a, b) => b.title.length - a.title.length);

  for (const entry of entries) {
    // `(^|\s)` mirrors the popup's own rule for what counts as a trigger
    // (`useTriggerPopup`: position 0, or preceded by whitespace), so a marker the popup
    // was willing to create is always a marker this can find again.
    const pattern = new RegExp(`(^|\\s)>${escapeRegExp(entry.title)}`);
    const match = pattern.exec(text);
    if (!match) continue;

    const start = match.index + match[1].length;
    return { entry, start, end: start + entry.title.length + 1 };
  }

  return null;
}
