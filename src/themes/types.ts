/**
 * Theme system type definitions.
 *
 * A theme preset defines CSS variable overrides that get injected onto
 * document.body to override Gemini/AI Studio's native theme variables.
 */

/** Built-in theme preset identifiers */
export type BuiltinThemePresetId = 'grimoire' | 'cupertino-glass' | 'retro-terminal' | 'nord-aurora' | 'cyberpunk-neon' | 'paper-ink' | 'solarized' | 'rose-pine' | 'tokyo-night' | 'catppuccin-mocha' | 'dracula' | 'ocean-breeze' | 'midnight-purple';

/** Theme preset ID — built-in or user-created (any string) */
export type ThemePresetId = BuiltinThemePresetId | (string & {});

/** A single CSS variable override */
export interface ThemeVariable {
  property: string; // e.g. "--gem-sys-color--surface"
  value: string; // e.g. "#f5f0e8"
}

/** Metadata for a theme preset */
export interface ThemePresetMeta {
  id: ThemePresetId;
  name: string; // Display name (English)
  description: string;
  author?: string;
  /** Whether this theme requires a Support Pack to use permanently */
  isPremium?: boolean;
  /** Whether this is a user-generated theme (not built-in) */
  isUserTheme?: boolean;
  /**
   * The preferred Gemini page color mode for this theme.
   * When a custom theme is applied, the page will be forced to this mode
   * so that native CSS variables (not overridden by the theme) stay consistent.
   */
  preferredMode: 'light' | 'dark';
  /** Google Fonts to load (if any) */
  fonts?: string[];
  /** Extra CSS rules beyond variables (e.g. backdrop-filter, noise texture) */
  extraCss?: string;
  /**
   * Typography rules, kept separate from `extraCss` on purpose.
   *
   * Font rules are the expensive half of a theme: they match large parts of the
   * page and they depend on a webfont that may still be downloading. They are
   * therefore applied in a second step, after the theme switch animation has
   * finished and the fonts are ready — see applyThemeFontCss().
   *
   * Selectors here must be keyed on `body.bs-fonts--<id>`, NOT on
   * `body.bs-theme--<id>`: the two classes are added at different moments, and
   * the font class of the previous theme stays in place until the new theme's
   * fonts are ready, so text never flickers back to the page default.
   */
  fontCss?: string;
}

/** Platform-specific variable overrides for a theme */
export interface ThemePreset extends ThemePresetMeta {
  /** CSS variables to inject on body (overrides Gemini's :root .light-theme / .dark-theme) */
  variables: ThemeVariable[];
  /**
   * Font-related CSS variables (e.g. --mat-*-text-font).
   *
   * These belong with `fontCss`, not with `variables`: a token pointing at a
   * webfont makes the page reflow the moment that font finishes downloading, so
   * it must not be set while the theme switch animation is running.
   */
  fontVariables?: ThemeVariable[];
  /**
   * CSS variables to inject into the sidebar Shadow DOM root container.
   * These override the sidebar's own design tokens (--background, --foreground, --primary, etc.)
   * defined in _gemini.scss. Values should be RGB triplets like "245 240 232" for color vars.
   */
  sidebarVariables?: ThemeVariable[];
  /**
   * Direct inline styles to apply on the sidebar Shadow DOM root container.
   * Use for properties like backdrop-filter that aren't CSS variables.
   * Keys are CSS property names (camelCase or kebab-case).
   */
  sidebarStyles?: Record<string, string>;
}

/** Registry of all available theme presets (built-in + user) */
export type ThemeRegistry = Record<string, ThemePreset>;
