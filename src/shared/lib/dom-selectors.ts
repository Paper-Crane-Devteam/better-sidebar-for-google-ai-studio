/**
 * Centralized DOM selectors and click helpers for interacting with
 * native UI elements on each platform.
 *
 * Using structural selectors (tag names, classes, DOM position) instead of
 * aria-label strings, because aria-labels are localized per browser language
 * and break for non-English users.
 */

// ─── Gemini Selectors ────────────────────────────────────────────────────────

export const GEMINI_SELECTORS = {
  /** Close sidebar button (desktop) */
  closeSidebar: '.sidenav-with-history-container .close-sidenav-button',
  /** Open sidebar button (desktop) — the sparkle/hamburger button */
  openSidebar: 'side-nav-sparkle-button .side-nav-sparkle-button',
  /** Mobile sidebar toggle (hamburger menu) */
  mobileMenu: 'side-nav-menu-button gem-icon-button button',
} as const;

// ─── AI Studio Selectors ─────────────────────────────────────────────────────

export const AISTUDIO_SELECTORS = {
  /** Sidebar toggle button in top toolbar */
  toggleSidebar: 'ms-playground-toolbar .toolbar-left button',
  /** Close run-settings panel (last button inside the right section, only when panel is open) */
  closeRunSettings: 'ms-right-side-panel ms-run-settings .right>button:last-child',
  /** Toggle run-settings panel button in toolbar */
  toggleRunSettings: 'ms-playground-toolbar .runsettings-toggle-button',
} as const;

// ─── Click Helpers ───────────────────────────────────────────────────────────

/**
 * Try to click the first element matching the selector.
 * Returns true if an element was found and clicked.
 */
function clickFirst(selector: string): boolean {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (el) {
    el.click();
    return true;
  }
  return false;
}

/**
 * Toggle the Gemini native sidebar.
 * Tries close → open → mobile menu in order.
 */
export function toggleGeminiSidebar(): boolean {
  if (clickFirst(GEMINI_SELECTORS.closeSidebar)) return true;
  if (clickFirst(GEMINI_SELECTORS.openSidebar)) return true;
  if (clickFirst(GEMINI_SELECTORS.mobileMenu)) return true;
  console.warn('Better Sidebar: Gemini sidebar toggle button not found');
  return false;
}

/**
 * Toggle the AI Studio native sidebar.
 */
export function toggleAIStudioSidebar(): boolean {
  return clickFirst(AISTUDIO_SELECTORS.toggleSidebar);
}

/**
 * Close the AI Studio run-settings panel if visible.
 * Only matches when ms-right-side-panel is present in DOM (panel is open).
 */
export function closeAIStudioRunSettings(): boolean {
  return clickFirst(AISTUDIO_SELECTORS.closeRunSettings);
}
