/**
 * Theme injection engine.
 *
 * Responsible for applying/removing CSS variable overrides on document.body,
 * loading Google Fonts, and injecting extra CSS (textures, backdrop-filter, etc.)
 */

import type { ThemePreset } from './types';

const THEME_STYLE_ID = 'better-sidebar-custom-theme';
/**
 * Marker attribute for theme webfont <link> elements.
 *
 * Font stylesheets are kept keyed by URL and are never swapped while switching
 * themes: removing and re-adding a Google Fonts stylesheet makes the browser
 * re-resolve every @font-face, and the resulting full-page reflow is what makes
 * the theme transition animation stall halfway. An unreferenced font stylesheet
 * costs nothing, so they are only cleaned up when themes are turned off.
 */
const THEME_FONT_ATTR = 'data-bs-theme-fonts';
const THEME_CLASS_PREFIX = 'bs-theme--';

let currentThemeId: string | null = null;

/** All CSS custom properties that sidebar themes may set on a container. */
const SIDEBAR_VARIABLE_PROPS = [
  '--background', '--foreground', '--card', '--card-foreground',
  '--popover', '--popover-foreground', '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
  '--accent', '--accent-foreground', '--destructive', '--destructive-foreground',
  '--border', '--input', '--ring', '--sidebar-icon-color', '--font-sans',
  '--gem-sys-color--primary-container', '--gem-sys-color--on-primary-container',
  '--radius', '--popover-blur', '--popover-bg',
  '--panel-blur', '--panel-bg', '--overlay-bg', '--overlay-blur',
  '--shadow-popover', '--shadow-panel',
  '--highlight', '--highlight-foreground',
  '--success', '--success-foreground',
  '--warning', '--warning-foreground',
] as const;

/** Direct CSS style properties that sidebar themes may set. */
const SIDEBAR_STYLE_PROPS = [
  'backdrop-filter', '-webkit-backdrop-filter', 'background-color',
] as const;

/**
 * Clear all sidebar theme variables and styles from a container element.
 * Exported so other modules (e.g. tooltip-helper) can reuse without duplicating the prop list.
 */
export function clearSidebarTheme(container: HTMLElement): void {
  container.removeAttribute('data-custom-theme');
  for (const prop of SIDEBAR_VARIABLE_PROPS) {
    container.style.removeProperty(prop);
  }
  for (const prop of SIDEBAR_STYLE_PROPS) {
    container.style.removeProperty(prop);
  }
}

/**
 * Apply a theme preset to the page.
 * Injects CSS variables onto body via a high-specificity selector,
 * loads fonts, and adds extra CSS.
 */
export function applyTheme(preset: ThemePreset): void {
  const body = document.body;
  if (!body) return;

  const themeClass = `${THEME_CLASS_PREFIX}${preset.id}`;

  // 1. Build CSS variable block with high specificity
  //    Using body[class] to beat :root .light-theme specificity
  const variablesCss = preset.variables
    .map((v) => `  ${v.property}: ${v.value} !important;`)
    .join('\n');

  let css = `body.${themeClass} {\n${variablesCss}\n}`;

  // 2. Append extra CSS if provided
  if (preset.extraCss) {
    css += `\n\n/* Theme extra styles: ${preset.id} */\n${preset.extraCss}`;
  }

  // 3. Bail out if this exact theme CSS is already live.
  //    A theme switch reaches applyTheme() more than once (store subscriber +
  //    the view-transition callback); re-injecting the <style> would force a
  //    second full-page style recalc for nothing. Comparing the CSS text keeps
  //    live-editing a user theme working.
  const existingStyle = document.getElementById(THEME_STYLE_ID);
  if (
    currentThemeId === preset.id &&
    existingStyle?.textContent === css &&
    body.classList.contains(themeClass)
  ) {
    ensureThemeFonts(preset.fonts);
    return;
  }

  removeTheme({ keepFonts: true }); // Clean up previous theme first

  body.classList.add(themeClass);
  currentThemeId = preset.id;

  // 4. Inject style element
  const style = document.createElement('style');
  style.id = THEME_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);

  // 5. Load Google Fonts if specified (no-op when already loaded)
  if (preset.fonts && preset.fonts.length > 0) {
    loadFonts(preset.fonts);
  }

  console.log(`Better Sidebar: Theme "${preset.id}" applied`);
}

/**
 * Remove the currently applied theme, restoring original styles.
 *
 * @param options.keepFonts - Keep the theme webfont stylesheets in place.
 *   Used when applyTheme() is about to apply another theme — see THEME_FONT_ATTR.
 */
export function removeTheme(options?: { keepFonts?: boolean }): void {
  // Remove style element
  const style = document.getElementById(THEME_STYLE_ID);
  if (style) style.remove();

  // Remove font links
  if (!options?.keepFonts) {
    clearThemeFonts();
  }

  // Remove theme class from body
  if (currentThemeId) {
    document.body?.classList.remove(`${THEME_CLASS_PREFIX}${currentThemeId}`);
    currentThemeId = null;
  }
}

/**
 * Apply sidebar-specific CSS variables to a Shadow DOM container element.
 * This is called from the overlay Layout to theme the sidebar UI.
 */
export function applySidebarTheme(
  container: HTMLElement,
  preset: ThemePreset | null,
): void {
  // Always clear previous theme first to prevent property leaking between themes
  clearSidebarTheme(container);

  if (!preset || (!preset.sidebarVariables?.length && !preset.sidebarStyles)) {
    return;
  }

  container.setAttribute('data-custom-theme', preset.id);

  // Apply CSS variables
  if (preset.sidebarVariables) {
    for (const v of preset.sidebarVariables) {
      container.style.setProperty(v.property, v.value);
    }
  }

  // Apply direct inline styles (e.g. backdrop-filter)
  if (preset.sidebarStyles) {
    for (const [prop, value] of Object.entries(preset.sidebarStyles)) {
      container.style.setProperty(prop, value);
    }
  }
}

/**
 * Get the currently active theme ID, or null if none.
 */
export function getCurrentThemeId(): string | null {
  return currentThemeId;
}

/** Build the Google Fonts CSS URL for a list of font specs. */
function buildFontsHref(fonts: string[]): string {
  const families = fonts.map((f) => `family=${f.replace(/ /g, '+')}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/**
 * Load Google Fonts via a <link> element.
 * Idempotent per URL: an already-present stylesheet is reused instead of being
 * removed and re-added, so switching themes never re-resolves loaded fonts.
 */
function loadFonts(fonts: string[]): HTMLLinkElement {
  const href = buildFontsHref(fonts);

  for (const el of document.querySelectorAll<HTMLLinkElement>(
    `link[${THEME_FONT_ATTR}]`,
  )) {
    if (el.href === href) return el;
  }

  const link = document.createElement('link');
  link.setAttribute(THEME_FONT_ATTR, '');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  return link;
}

/**
 * Public wrapper around loadFonts() for platform adapters, so every platform
 * shares one set of font stylesheets instead of injecting its own copies.
 */
export function ensureThemeFonts(fonts: string[] | undefined): void {
  if (!fonts?.length) return;
  loadFonts(fonts);
}

/** Drop every theme webfont stylesheet. Only used when themes are turned off. */
export function clearThemeFonts(): void {
  for (const link of document.querySelectorAll(`link[${THEME_FONT_ATTR}]`)) {
    link.remove();
  }
}

/** Parse 'Nunito+Sans:wght@300;400;700' into a family name and its weights. */
function parseFontSpec(spec: string): { family: string; weights: string[] } {
  const [rawFamily, axes] = spec.split(':');
  const family = rawFamily.replace(/\+/g, ' ').trim();
  const wght = axes?.match(/wght@([\d;.]+)/);
  const weights = wght
    ? wght[1].split(';').filter(Boolean)
    : ['400'];
  return { family, weights };
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Download a theme's webfonts BEFORE the theme is applied.
 *
 * Without this, the fonts start downloading at the moment the theme <style> is
 * injected. They arrive a few hundred ms later — right in the middle of the
 * theme transition animation — and force a full-page relayout (themes set
 * font-family on `body *`), which freezes the animation for the length of that
 * relayout. Paying the cost up front keeps the animation window quiet.
 *
 * Resolves early if the fonts are already available, and never blocks longer
 * than `budgetMs`.
 */
export async function preloadThemeFonts(
  preset: ThemePreset,
  budgetMs = 400,
): Promise<void> {
  if (!preset.fonts?.length) return;
  if (typeof document === 'undefined' || !document.fonts) return;

  const descriptors = preset.fonts
    .map(parseFontSpec)
    .flatMap(({ family, weights }) =>
      weights.map((w) => `${w} 1em "${family}"`),
    );

  // Fonts already loaded resolve immediately below, so there is no fast path
  // to take here — document.fonts.load() is the reliable "is it ready?" check.
  const deadline = delay(budgetMs);
  const link = loadFonts(preset.fonts);

  // document.fonts.load() only sees @font-face rules that are already parsed,
  // so wait for the stylesheet first.
  if (!link.sheet) {
    await Promise.race([
      new Promise<void>((resolve) => {
        link.addEventListener('load', () => resolve(), { once: true });
        link.addEventListener('error', () => resolve(), { once: true });
      }),
      deadline,
    ]);
  }

  await Promise.race([
    Promise.all(
      descriptors.map((d) => document.fonts.load(d).catch(() => undefined)),
    ),
    deadline,
  ]);
}
