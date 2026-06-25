/**
 * Built-in Prompt Registry.
 * All built-in prompts for Agent Loop are registered here.
 * These are invisible to users in the regular prompt library.
 */

import type { BuiltInPrompt } from '../types';
import { autoClassifyPrompt } from './utilities/auto-classify';
import { findEmptyChatsPrompt } from './utilities/find-empty-chats';
import { exportChatsPrompt } from './utilities/export-chats';

/** The "free-form" base prompt — no utility specialization, user provides their own task */
const freeFormPrompt: BuiltInPrompt = {
  id: 'builtin-freeform',
  title: 'Custom Task',
  description: 'Tell the AI what you want to do with your data',
  icon: 'Sparkles',
  getPromptContent: () => `## Task: Custom

The user will describe what they want to accomplish. Help them by querying and modifying the database as needed. Always start by understanding the current data state with SELECT queries.
`,
};

/** All registered built-in prompts */
const BUILT_IN_PROMPTS: BuiltInPrompt[] = [
  autoClassifyPrompt,
  findEmptyChatsPrompt,
  exportChatsPrompt,
  freeFormPrompt,
];

/**
 * Get all built-in prompts.
 */
export function getBuiltInPrompts(): BuiltInPrompt[] {
  return BUILT_IN_PROMPTS;
}

/**
 * Get a built-in prompt by ID.
 */
export function getBuiltInPromptById(id: string): BuiltInPrompt | undefined {
  return BUILT_IN_PROMPTS.find((p) => p.id === id);
}
