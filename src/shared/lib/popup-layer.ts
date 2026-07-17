/**
 * Global popup layer accessor.
 *
 * In a multi-shadow-DOM architecture, popup elements (context menus, dropdowns, toasts)
 * need to render in the highest-z-index shadow DOM to avoid being occluded by overlays
 * (like the SnippetReaderDrawer) that live in a different stacking context.
 *
 * The enhanced-features shadow DOM host is identified by a well-known ID, and its
 * shadow root contains a `.shadow-body` div which serves as the portal container.
 */

const ENHANCED_FEATURES_IDS = [
  'better-sidebar-enhanced-features',        // Gemini
  'better-sidebar-aistudio-enhanced-features', // AI Studio
];

/** Get the enhanced-features shadow DOM container for portaling popups. */
export function getPopupLayerContainer(): HTMLElement | undefined {
  for (const id of ENHANCED_FEATURES_IDS) {
    const host = document.getElementById(id);
    if (host?.shadowRoot) {
      const container = host.shadowRoot.querySelector('.shadow-body') as HTMLElement | null;
      if (container) return container;
    }
  }
  return undefined;
}
