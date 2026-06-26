/**
 * Shared types for trigger-based popup (slash command `/` and agent trigger `>`).
 *
 * Both features share the same pattern:
 *   trigger char → search → popup → select → capsule insert → send expand
 */

/**
 * A popup item (generic enough for both user prompts and built-in prompts).
 */
export interface TriggerPopupItem {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  /** The actual content to embed in the capsule (expanded on send) */
  content: string;
  /** Arbitrary extra data the consumer may need */
  meta?: unknown;
}

/**
 * A matched item with optional highlight ranges for the popup UI.
 */
export interface TriggerPopupMatch {
  item: TriggerPopupItem;
  /** Character ranges in the title to highlight */
  matchRanges?: Array<[number, number]>;
}

/**
 * Popup state.
 */
export interface TriggerPopupState {
  isOpen: boolean;
  query: string;
  triggerPosition: number;
  matches: TriggerPopupMatch[];
  selectedIndex: number;
}

/**
 * Configuration for useTriggerPopup.
 */
export interface TriggerPopupConfig {
  /** Character that activates this popup (e.g. '/' or '>') */
  triggerChar: string;
  /** Max results to show (default 8) */
  maxResults?: number;
  /** Search function — called with the text after the trigger char */
  search: (query: string) => TriggerPopupMatch[];
  /** When true, this popup is suppressed (mutual exclusion) */
  suppressed?: boolean;
}

/**
 * Info passed to onCapsuleClick when user clicks a capsule in the editor.
 */
export interface CapsuleClickInfo {
  /** The capsule DOM element that was clicked */
  element: HTMLElement;
  /** The stored prompt content (from data-prompt-content) */
  content: string;
  /** The prompt ID (from data-prompt-id) */
  promptId: string;
  /** Bounding rect for positioning a popover */
  rect: DOMRect;
}

/**
 * Configuration for useEditorIntegration — connects the popup to the DOM editor.
 */
export interface EditorIntegrationConfig {
  /** Get the contenteditable editor element */
  getEditor: () => HTMLElement | null;
  /** Whether the feature is enabled */
  enabled: boolean;
  /** The trigger character this instance owns (used to identify its capsules) */
  triggerChar: string;
  /** Trigger popup handleInput function */
  onInput: (text: string, cursorPos: number) => void;
  /** Get current popup state */
  getPopupState: () => TriggerPopupState;
  /** Keyboard handlers */
  selectPrevious: () => void;
  selectNext: () => void;
  close: () => void;
  /** Called when user confirms selection via Enter/Tab */
  onConfirmSelection: () => void;
  /**
   * Called when user presses Enter and there are capsules in the editor.
   * Called BEFORE capsules are expanded.
   * Return true to fully handle sending yourself (capsules won't be auto-expanded).
   * Return false to let the default behavior run (expand capsules, let platform send).
   */
  onBeforeSend?: (editor: HTMLElement) => boolean;
  /** CSS class for capsules created by this trigger (default: 'bs-prompt-capsule') */
  capsuleClass?: string;
  /** Called when user clicks on a capsule belonging to this trigger */
  onCapsuleClick?: (info: CapsuleClickInfo) => void;
}
