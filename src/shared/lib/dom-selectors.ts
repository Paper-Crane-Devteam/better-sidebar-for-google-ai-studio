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
  /** Signed-in user's avatar image in the sidenav footer */
  accountAvatar: 'sidenav-mavatar-footer .mavatar-container img',
  /** Avatar link wrapping that image — opens the Google account menu */
  accountMenu: ['sidenav-mavatar-footer .mavatar-footer-row a'],
  /**
   * Sign-in control, shown instead of the avatar when nobody is signed in.
   * Gemini renders a different element per footer state — icon-only while the
   * native sidenav is collapsed, labelled while it is expanded — and only one
   * of them is in the DOM at a time.
   */
  accountSignIn: [
    'sidenav-mavatar-footer gem-icon-button button',
    'sidenav-mavatar-footer .mavatar-footer-row gem-button button',
  ],
} as const;

// ─── AI Studio Selectors ─────────────────────────────────────────────────────

export const AISTUDIO_SELECTORS = {
  /** Sidebar toggle button in top toolbar */
  toggleSidebar: 'ms-playground-toolbar .toolbar-left button',
  /** Close run-settings panel (last button inside the right section, only when panel is open) */
  closeRunSettings: 'ms-right-side-panel ms-run-settings .right>button:last-child',
  /** Toggle run-settings panel button in toolbar */
  toggleRunSettings: 'ms-playground-toolbar .runsettings-toggle-button',
  /** Signed-in user's avatar image in the navbar's account switcher */
  accountAvatar: 'ms-account-switcher connect-avatar img',
  /**
   * Account switcher button — opens the Google account menu. AI Studio requires
   * a signed-in user, so there is no sign-out state to handle here.
   */
  accountMenu: [
    '.account-switcher-container button.account-switcher-button',
    'ms-account-switcher button.account-switcher-button',
  ],
  /**
   * The account menu itself, once open. It lives in the CDK overlay layer at the
   * end of `<body>`, not next to its trigger, and positions itself with offsets
   * measured against the native navbar — so it needs nudging back on screen when
   * opened from our narrower icon rail.
   */
  accountPanel: ['.cdk-overlay-container .ms-account-switcher-panel'],
} as const;

// ─── Query Helpers ───────────────────────────────────────────────────────────

/**
 * First element matching any of `selectors`, tried in the order given.
 *
 * Selector order matters, which is why this is not a single comma-separated
 * query: `querySelector` resolves those in *document* order, so the most
 * specific candidate does not necessarily win.
 */
export function queryFirst(
  selectors: readonly string[],
): HTMLElement | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) return el;
  }
  return null;
}

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
