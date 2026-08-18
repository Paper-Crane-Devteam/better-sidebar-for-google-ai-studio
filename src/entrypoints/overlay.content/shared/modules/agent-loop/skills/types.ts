/**
 * Skill Layer — Type definitions.
 */

/** Skill definition — builtin and custom share the same shape */
export interface Skill {
  id: string;
  type: 'builtin' | 'custom';
  title: string;
  description: string;
  /**
   * i18n key for the title (builtin skills only).
   * When present, UI resolves via `t(titleKey)` instead of using `title` directly.
   * `title` remains the English fallback used in the prompt and search.
   */
  titleKey?: string;
  /** i18n key for the description (builtin skills only). */
  descriptionKey?: string;
  icon: string;
  promptContent: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
