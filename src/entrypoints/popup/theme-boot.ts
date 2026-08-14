/**
 * Zero-flash theme boot for the popup.
 *
 * The real theme lives in `storage.local`, which is async, and extension pages
 * cannot use inline scripts (CSP) — so by the time we know whether to render
 * dark, the browser has already painted a light popup. Result: a visible flash,
 * plus a second one when a custom theme's variables land.
 *
 * Fix: mirror the resolved theme into `localStorage` (synchronous, same origin
 * as the popup) and replay it at the top of the bundle, before the first paint.
 * The cache is refreshed on every open, so it only ever misses on the very first
 * launch or right after the theme was changed somewhere else.
 */

const CACHE_KEY = 'bs:popup-theme-v1';

export interface PopupThemeSnapshot {
  /** Light/dark preference. `system` is resolved against the OS at boot. */
  mode: 'light' | 'dark' | 'system';
  /** CSS custom properties from the active custom theme, as [property, value] */
  vars: Array<[string, string]>;
}

const isDarkMode = (mode: PopupThemeSnapshot['mode']): boolean =>
  mode === 'dark' ||
  (mode === 'system' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches);

const paint = (snapshot: PopupThemeSnapshot) => {
  const root = document.documentElement;
  root.classList.add('theme-gemini');
  root.classList.toggle('dark', isDarkMode(snapshot.mode));
  // Drop variables left over from a previously applied theme before reapplying.
  root.removeAttribute('style');
  for (const [property, value] of snapshot.vars ?? []) {
    root.style.setProperty(property, value);
  }
  // Also switches off the prefers-color-scheme fallback in index.html
  root.classList.add('theme-ready');
};

/**
 * Apply the last known theme synchronously, before the first paint.
 *
 * @returns true when a cached snapshot was applied
 */
export const applyCachedPopupTheme = (): boolean => {
  document.documentElement.classList.add('theme-gemini');
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    paint(JSON.parse(raw) as PopupThemeSnapshot);
    return true;
  } catch {
    return false;
  }
};

/** Apply a freshly resolved theme and remember it for the next open. */
export const applyPopupTheme = (snapshot: PopupThemeSnapshot): void => {
  paint(snapshot);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage unavailable — worst case the popup flashes once next time.
  }
};
