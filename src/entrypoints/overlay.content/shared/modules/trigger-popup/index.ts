/**
 * trigger-popup — Shared module for character-triggered input popup.
 *
 * Used by:
 *   - Slash command (`/`) — user prompt library
 *   - Agent trigger (`>`) — built-in agent prompts
 *
 * Provides:
 *   - useTriggerPopup: state management (detection, search, navigation)
 *   - useEditorIntegration: DOM event plumbing (listeners, capsule insert/delete/expand)
 *   - insertCapsule: DOM helper to insert a capsule at a position
 */

export { useTriggerPopup } from './useTriggerPopup';
export {
  useEditorIntegration,
  insertCapsule,
  expandAllCapsules,
  getCapsulePromptId,
  getCapsuleContent,
  CAPSULE_CLASS,
  CAPSULE_ATTR_CONTENT,
  CAPSULE_ATTR_ID,
} from './useEditorIntegration';
export type { PopupPosition } from './useEditorIntegration';
export type {
  TriggerPopupItem,
  TriggerPopupMatch,
  TriggerPopupState,
  TriggerPopupConfig,
  EditorIntegrationConfig,
} from './types';
