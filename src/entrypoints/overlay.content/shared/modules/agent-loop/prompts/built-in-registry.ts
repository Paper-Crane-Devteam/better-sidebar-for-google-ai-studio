/**
 * Built-in Prompt Registry.
 * All built-in prompts for Agent Loop are registered here.
 * These are invisible to users in the regular prompt library.
 */

import type { BuiltInPrompt } from '../types';
import { autoClassifyPrompt } from './utilities/auto-classify';
import { findEmptyChatsPrompt } from './utilities/find-empty-chats';
import { exportChatsPrompt } from './utilities/export-chats';

/** All registered built-in prompts */
const BUILT_IN_PROMPTS: BuiltInPrompt[] = [
  autoClassifyPrompt,
  findEmptyChatsPrompt,
  exportChatsPrompt,
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
