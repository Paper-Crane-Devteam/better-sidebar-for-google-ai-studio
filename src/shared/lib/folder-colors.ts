/**
 * Preset colors for folder icons.
 * Each color is chosen to be visually appealing in both light and dark themes.
 */
export interface FolderColorPreset {
  value: string;
  labelKey: string; // i18n key
}

export const FOLDER_COLOR_PRESETS: FolderColorPreset[] = [
  { value: '#6366F1', labelKey: 'folderColor.indigo' }, // Indigo
  { value: '#8B5CF6', labelKey: 'folderColor.violet' }, // Violet
  { value: '#EC4899', labelKey: 'folderColor.pink' }, // Pink
  { value: '#EF4444', labelKey: 'folderColor.red' }, // Red
  { value: '#F97316', labelKey: 'folderColor.orange' }, // Orange
  { value: '#EAB308', labelKey: 'folderColor.yellow' }, // Yellow
  { value: '#22C55E', labelKey: 'folderColor.green' }, // Green
  { value: '#14B8A6', labelKey: 'folderColor.teal' }, // Teal
  { value: '#06B6D4', labelKey: 'folderColor.cyan' }, // Cyan
  { value: '#3B82F6', labelKey: 'folderColor.blue' }, // Blue
  { value: '#A78BFA', labelKey: 'folderColor.lavender' }, // Lavender
  { value: '#F472B6', labelKey: 'folderColor.rose' }, // Rose
];
