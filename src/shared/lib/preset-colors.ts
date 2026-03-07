/**
 * Shared preset colors for folder icons and tag badges.
 * Each color is chosen to be visually appealing in both light and dark themes.
 */
export interface ColorPreset {
  value: string;
  labelKey: string; // i18n key
}

export const COLOR_PRESETS: ColorPreset[] = [
  { value: '#6366F1', labelKey: 'presetColor.indigo' }, // Indigo
  { value: '#8B5CF6', labelKey: 'presetColor.violet' }, // Violet
  { value: '#EC4899', labelKey: 'presetColor.pink' }, // Pink
  { value: '#EF4444', labelKey: 'presetColor.red' }, // Red
  { value: '#F97316', labelKey: 'presetColor.orange' }, // Orange
  { value: '#EAB308', labelKey: 'presetColor.yellow' }, // Yellow
  { value: '#22C55E', labelKey: 'presetColor.green' }, // Green
  { value: '#14B8A6', labelKey: 'presetColor.teal' }, // Teal
  { value: '#06B6D4', labelKey: 'presetColor.cyan' }, // Cyan
  { value: '#3B82F6', labelKey: 'presetColor.blue' }, // Blue
  { value: '#A78BFA', labelKey: 'presetColor.lavender' }, // Lavender
  { value: '#F472B6', labelKey: 'presetColor.rose' }, // Rose
];

/**
 * @deprecated Use COLOR_PRESETS and ColorPreset from preset-colors.ts instead.
 * This re-export is kept for backward compatibility with existing folder-colors imports.
 */
export type FolderColorPreset = ColorPreset;
export const FOLDER_COLOR_PRESETS = COLOR_PRESETS;
