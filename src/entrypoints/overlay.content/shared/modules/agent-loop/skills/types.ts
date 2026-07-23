/**
 * Skill Layer — Type definitions.
 */

/** Skill definition — builtin and custom share the same shape */
export interface Skill {
  id: string;
  type: 'builtin' | 'custom';
  title: string;
  description: string;
  icon: string;
  promptContent: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
