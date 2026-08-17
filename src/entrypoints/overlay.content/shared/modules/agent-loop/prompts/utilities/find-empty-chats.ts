/**
 * Legacy `BuiltInPrompt` wrapper for the "sync missing messages" skill.
 *
 * @deprecated The definition lives in `skills/builtin-skills.ts` — this only exists
 * for the old built-in prompt registry. Derived from the skill rather than copied,
 * because the copy is what let the two descriptions drift apart in the first place.
 */

import type { BuiltInPrompt } from '../../types';
import { BUILTIN_SKILLS } from '../../skills/builtin-skills';

const skill = BUILTIN_SKILLS.find((s) => s.id === 'builtin-find-empty-chats')!;

export const findEmptyChatsPrompt: BuiltInPrompt = {
  id: skill.id,
  title: skill.title,
  description: skill.description,
  icon: skill.icon,
  getPromptContent: () => skill.promptContent,
};
