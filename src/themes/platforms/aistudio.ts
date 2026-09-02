/**
 * AI Studio platform theme adapter.
 *
 * AI Studio uses different CSS variable naming from Gemini:
 *   - --color-v3-* (custom design tokens)
 *   - --mat-* (Angular Material tokens)
 *   - --color-* (legacy tokens)
 *
 * This adapter maps ThemePreset colors to AI Studio's variable namespace
 * and injects them onto document.body, similar to the Gemini adapter.
 *
 * Call `initAiStudioThemeSync()` once from the content script.
 */

import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { useLicenseStore, isLicenseValid } from '@/shared/lib/license-store';
import { themeRegistry, applySidebarTheme, refreshThemeRegistry } from '@/themes';
import {
  clearThemeFonts,
  clearThemeFontCss,
  applyThemeFontCss,
} from '../engine';
import { TooltipHelper } from '@/shared/lib/tooltip-helper';
import { syncAiStudioTheme } from '@/shared/lib/utils/utils';
import type { ThemePreset, ThemeVariable } from '../types';

const AISTUDIO_THEME_STYLE_ID = 'better-sidebar-aistudio-custom-theme';
const AISTUDIO_THEME_CLASS_PREFIX = 'bs-theme--';

let currentAiStudioThemeId: string | null = null;

/**
 * Map a ThemePreset's semantic colors to AI Studio CSS variables.
 * This translates from the Gemini-centric variable names in presets
 * to AI Studio's --color-v3-*, --mat-*, --color-* namespace.
 */
function mapPresetToAiStudioVariables(preset: ThemePreset): ThemeVariable[] {
  // Build a lookup from the preset's variables for easy access
  const lookup: Record<string, string> = {};
  for (const v of preset.variables) {
    lookup[v.property] = v.value;
  }

  // Helper to get a value or fallback
  const get = (key: string, fallback?: string) => lookup[key] ?? fallback ?? '';

  const vars: ThemeVariable[] = [];
  const add = (property: string, value: string) => {
    if (value) vars.push({ property, value });
  };

  // ─── Surface / Background ───────────────────────────────────────
  const surface = get('--gem-sys-color--surface');
  const surfaceBright = get('--gem-sys-color--surface-bright', surface);
  const surfaceDim = get('--gem-sys-color--surface-dim', surface);
  const surfaceContainer = get('--gem-sys-color--surface-container', surface);
  const surfaceContainerHigh = get('--gem-sys-color--surface-container-high', surface);
  const surfaceContainerHighest = get('--gem-sys-color--surface-container-highest', surface);
  const surfaceContainerLow = get('--gem-sys-color--surface-container-low', surface);
  const surfaceVariant = get('--gem-sys-color--surface-variant', surface);

  add('--color-surface', surface);
  add('--color-v3-surface', surfaceBright);
  add('--color-v3-surface-container', surfaceContainer);
  add('--color-v3-surface-container-high', surfaceContainerHigh);
  add('--color-v3-surface-container-highest', surfaceContainerHighest);
  add('--color-v3-surface-left-nav', surfaceContainerHigh);
  add('--color-surface-bright', surfaceBright);
  add('--color-loading-background', surfaceContainerLow);
  add('--mat-sys-surface', surface);
  add('--mat-sys-surface-container', surfaceContainer);
  add('--mat-menu-container-color', surfaceContainer);
  add('--mat-select-panel-background-color', surfaceContainer);
  add('--color-nav-item-active', surfaceContainerHighest);
  add('--color-nav-item-hover', surfaceContainerHigh);
  add('--color-v3-hover', surfaceContainerHigh);

  // ─── Text / On-Surface ──────────────────────────────────────────
  const onSurface = get('--gem-sys-color--on-surface');
  const onSurfaceVariant = get('--gem-sys-color--on-surface-variant', onSurface);
  const onSurfaceLow = get('--gem-sys-color--on-surface-low', onSurfaceVariant);

  add('--color-on-surface', onSurface);
  add('--color-v3-text', onSurface);
  add('--color-v3-text-var', onSurfaceVariant);
  add('--color-run-settings-text', onSurface);
  add('--mat-sys-on-surface', onSurface);
  add('--mat-sys-on-surface-variant', onSurfaceVariant);
  add('--mat-menu-item-label-text-color', onSurface);
  add('--mat-option-label-text-color', onSurface);
  add('--color-logo-icon', onSurface);
  add('--color-logo-lockup', onSurface);
  add('--color-v3-text-disable', onSurfaceLow);

  // ─── Outline / Border ───────────────────────────────────────────
  const outline = get('--gem-sys-color--outline');
  const outlineVariant = get('--gem-sys-color--outline-variant', outline);
  const outlineLow = get('--gem-sys-color--outline-low', outlineVariant);

  add('--color-v3-outline', outlineVariant);
  add('--color-v3-outline-var', outlineLow);
  add('--color-v3-surface-left-nav-border', outlineVariant);
  add('--mat-sys-outline', outline);
  add('--mat-sys-outline-variant', outlineVariant);
  add('--mat-divider-color', outlineLow);
  add('--mat-slide-toggle-track-outline-color', outlineVariant);
  add('--mat-form-field-outlined-outline-color', outlineLow);
  add('--mat-form-field-outlined-hover-outline-color', outlineVariant);
  add('--mat-form-field-outlined-focus-outline-color', onSurfaceVariant);

  // ─── Primary ────────────────────────────────────────────────────
  const primary = get('--gem-sys-color--primary');
  const onPrimary = get('--gem-sys-color--on-primary');
  const primaryContainer = get('--gem-sys-color--primary-container');
  const onPrimaryContainer = get('--gem-sys-color--on-primary-container');

  add('--mat-sys-primary', primary);
  add('--mat-sys-on-primary', onPrimary);
  add('--mat-sys-primary-container', primaryContainer);
  add('--mat-sys-on-primary-container', onPrimaryContainer);
  add('--color-v3-outline-accent', primary);
  add('--color-v3-text-link', primary);
  add('--color-v3-button-container-accent', primaryContainer);
  add('--mat-form-field-filled-caret-color', primary);
  add('--mat-form-field-outlined-caret-color', primary);
  add('--mat-form-field-filled-focus-active-indicator-color', primary);
  add('--mat-form-field-filled-focus-label-text-color', `color-mix(in srgb, ${primary} 87%, transparent)`);
  add('--mat-form-field-outlined-focus-label-text-color', `color-mix(in srgb, ${primary} 87%, transparent)`);
  add('--mat-option-selected-state-label-text-color', primary);
  add('--mat-pseudo-checkbox-minimal-selected-checkmark-color', primary);
  add('--mat-pseudo-checkbox-full-selected-icon-color', primary);

  // ─── Secondary ──────────────────────────────────────────────────
  const secondary = get('--gem-sys-color--secondary');
  const secondaryContainer = get('--gem-sys-color--secondary-container');
  const onSecondaryContainer = get('--gem-sys-color--on-secondary-container');

  add('--mat-sys-secondary-container', secondaryContainer);
  add('--mat-sys-on-secondary-container', onSecondaryContainer);

  // ─── Error ──────────────────────────────────────────────────────
  const error = get('--gem-sys-color--error');
  add('--color-error', error);
  add('--mat-sys-error', error);

  // ─── Inverse ────────────────────────────────────────────────────
  const inverseSurface = get('--gem-sys-color--inverse-surface');
  const inverseOnSurface = get('--gem-sys-color--inverse-on-surface');
  add('--color-inverse-surface', inverseSurface);
  add('--color-inverse-on-surface', inverseOnSurface);

  // ─── Buttons ────────────────────────────────────────────────────
  const buttonFilled = get('--mat-button-filled-container-color', primary);
  const buttonFilledLabel = get('--mat-button-filled-label-text-color', onPrimary);
  const buttonTonal = get('--mat-button-tonal-container-color', secondaryContainer);
  const buttonTonalLabel = get('--mat-button-tonal-label-text-color', onSecondaryContainer);

  add('--color-v3-button-container', surfaceBright);
  add('--color-v3-button-container-high', surfaceContainerHighest);
  add('--color-v3-text-on-button', onSurface);

  // ─── Slide Toggle ───────────────────────────────────────────────
  add('--mat-slide-toggle-selected-track-color', onSurface);
  add('--mat-slide-toggle-selected-hover-track-color', onSurface);
  add('--mat-slide-toggle-selected-focus-track-color', onSurface);
  add('--mat-slide-toggle-unselected-track-color', surfaceContainerHigh);
  add('--mat-slide-toggle-unselected-hover-track-color', surfaceContainerHigh);
  add('--mat-slide-toggle-unselected-focus-track-color', surfaceContainerHigh);
  add('--mat-slide-toggle-selected-handle-color', surface);
  add('--mat-slide-toggle-selected-hover-handle-color', surface);
  add('--mat-slide-toggle-selected-focus-handle-color', surface);
  add('--mat-slide-toggle-unselected-handle-color', onSurfaceVariant);
  add('--mat-slide-toggle-unselected-hover-handle-color', onSurfaceVariant);
  add('--mat-slide-toggle-unselected-focus-handle-color', onSurfaceVariant);
  add('--mat-slide-toggle-label-text-color', onSurface);

  // ─── Surface Variant ────────────────────────────────────────────
  add('--mat-sys-surface-variant', surfaceVariant);
  add('--color-on-surface-variant', onSurfaceVariant);

  // ─── Shadows (keep subtle, map from preset if available) ────────
  const menuShadow = get('--mat-menu-container-elevation-shadow');
  if (menuShadow) {
    add('--mat-menu-container-elevation-shadow', menuShadow);
  }

  // Font tokens are NOT mapped here — see mapPresetToAiStudioFontVariables().
  // They point at a webfont, so they must not be applied while the theme
  // switch animation is running.

  return vars;
}

/**
 * Map a preset's font variables to AI Studio's typography token namespace.
 * Applied in the deferred typography step, not with the colours.
 */
function mapPresetToAiStudioFontVariables(preset: ThemePreset): ThemeVariable[] {
  const menuFont = preset.fontVariables?.find(
    (v) => v.property === '--mat-menu-item-label-text-font',
  )?.value;
  if (!menuFont) return [];

  return [
    '--mat-sys-label-large-font',
    '--mat-sys-label-medium-font',
    '--mat-sys-body-large-font',
    '--mat-sys-body-medium-font',
    '--mat-sys-body-small-font',
    '--mat-sys-title-medium-font',
    '--mat-form-field-filled-label-text-font',
    '--mat-form-field-outlined-label-text-font',
    '--mat-form-field-subscript-text-font',
    '--mat-form-field-container-text-font',
    '--mat-option-label-text-font',
  ].map((property) => ({ property, value: menuFont }));
}

/**
 * Convert any browser-supported CSS colour to the RGB channel format used by
 * the sidebar's Tailwind tokens (for example, "31 29 46").
 */
function toRgbChannels(color: string): string | null {
  const probe = document.createElement('span');
  probe.style.color = color;
  if (!probe.style.color) return null;

  probe.style.display = 'none';
  (document.body ?? document.documentElement).appendChild(probe);
  const computedColor = getComputedStyle(probe).color;
  probe.remove();

  const match = computedColor.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i,
  );
  return match ? `${match[1]} ${match[2]} ${match[3]}` : null;
}

/**
 * AI Studio's page background is its surface-container token. Unlike Gemini,
 * a darker dedicated sidebar surface looks visually disconnected here, so the
 * custom sidebar uses the same surface as the page body.
 */
function mapPresetToAiStudioSidebar(preset: ThemePreset): ThemePreset {
  const pageSurface =
    preset.variables.find(
      (variable) =>
        variable.property === '--gem-sys-color--surface-container',
    )?.value ??
    preset.variables.find(
      (variable) => variable.property === '--gem-sys-color--surface',
    )?.value;
  const background = pageSurface ? toRgbChannels(pageSurface) : null;
  if (!background) return preset;

  const sidebarVariables = [...(preset.sidebarVariables ?? [])];
  const backgroundIndex = sidebarVariables.findIndex(
    (variable) => variable.property === '--background',
  );
  const backgroundVariable = { property: '--background', value: background };

  if (backgroundIndex >= 0) {
    sidebarVariables[backgroundIndex] = backgroundVariable;
  } else {
    sidebarVariables.unshift(backgroundVariable);
  }

  return { ...preset, sidebarVariables };
}

/**
 * Apply a theme preset to AI Studio page.
 */
function applyAiStudioTheme(preset: ThemePreset): void {
  removeAiStudioTheme({ keepFonts: true });

  const body = document.body;
  if (!body) return;

  body.classList.add(`${AISTUDIO_THEME_CLASS_PREFIX}${preset.id}`);
  currentAiStudioThemeId = preset.id;

  // Map preset to AI Studio variables
  const aiStudioVars = mapPresetToAiStudioVariables(preset);

  const variablesCss = aiStudioVars
    .map((v) => `  ${v.property}: ${v.value} !important;`)
    .join('\n');

  let css = `body.${AISTUDIO_THEME_CLASS_PREFIX}${preset.id} {\n${variablesCss}\n}`;

  // Append extra CSS if provided (textures, effects — typography lives in
  // fontCss and is applied later by applyThemeFontCss)
  if (preset.extraCss) {
    css += `\n\n/* Theme extra styles: ${preset.id} */\n${preset.extraCss}`;
  }

  const style = document.createElement('style');
  style.id = AISTUDIO_THEME_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);

  // Webfonts are requested by the deferred typography step, not here.

  console.log(`Better Sidebar: AI Studio theme "${preset.id}" applied`);
}

/**
 * Remove the currently applied AI Studio theme.
 *
 * @param options.keepFonts - Keep the theme webfont stylesheets; used when
 *   another theme is about to be applied (see applyAiStudioTheme).
 */
function removeAiStudioTheme(options?: { keepFonts?: boolean }): void {
  const style = document.getElementById(AISTUDIO_THEME_STYLE_ID);
  if (style) style.remove();

  if (!options?.keepFonts) {
    clearThemeFonts();
    clearThemeFontCss();
  }

  if (currentAiStudioThemeId) {
    document.body?.classList.remove(`${AISTUDIO_THEME_CLASS_PREFIX}${currentAiStudioThemeId}`);
    currentAiStudioThemeId = null;
  }
}

/**
 * Apply a preset to the AI Studio page: colours now, typography once the switch
 * animation is over and the webfonts have arrived.
 */
function applyAiStudioPreset(preset: ThemePreset): void {
  applyAiStudioTheme(preset);
  TooltipHelper.getInstance().setCustomThemeVariables(preset.sidebarVariables ?? null);
  syncAiStudioTheme(preset.preferredMode);
  void applyThemeFontCss(preset, mapPresetToAiStudioFontVariables(preset));
}

/**
 * Initialize theme sync for AI Studio.
 * Reads the current customTheme from store and subscribes to changes.
 * Returns an unsubscribe function.
 */
export function initAiStudioThemeSync(): () => void {
  // Ensure user themes are loaded into registry
  refreshThemeRegistry();

  // On init: if a premium theme is persisted but user has no license, revert to default.
  const initialThemeId = usePegasusStore.getState().customTheme;
  if (initialThemeId && themeRegistry[initialThemeId]?.isPremium) {
    const licenseState = useLicenseStore.getState();
    if (!isLicenseValid(licenseState)) {
      usePegasusStore.getState().setCustomTheme(null);
      useLicenseStore.getState().endPreview();
    } else {
      applyAiStudioPreset(themeRegistry[initialThemeId]);
    }
  } else if (initialThemeId && themeRegistry[initialThemeId]) {
    applyAiStudioPreset(themeRegistry[initialThemeId]);
  }

  // Subscribe to changes
  const unsubscribe = usePegasusStore.subscribe((state, prevState) => {
    if (state.customTheme !== prevState.customTheme) {
      if (state.customTheme && themeRegistry[state.customTheme]) {
        applyAiStudioPreset(themeRegistry[state.customTheme]);
      } else {
        // keepFonts: typography is handed over to applyThemeFontCss(null) so it
        // reverts after the animation instead of mid-way through it.
        removeAiStudioTheme({ keepFonts: true });
        TooltipHelper.getInstance().setCustomThemeVariables(null);
        void applyThemeFontCss(null);
        // Restore user's chosen theme setting
        syncAiStudioTheme(state.theme);
      }
    }
  });

  return unsubscribe;
}

/**
 * Bind a Shadow DOM root container to the custom theme system for AI Studio.
 * Applies the current theme immediately and subscribes to future changes.
 * Returns an unsubscribe function for cleanup.
 */
export function bindAiStudioShadowRootToTheme(container: HTMLElement): () => void {
  // Ensure user themes are in registry
  refreshThemeRegistry();

  // Apply current theme with AI Studio's page-matched sidebar surface.
  const currentThemeId = usePegasusStore.getState().customTheme;
  if (currentThemeId && themeRegistry[currentThemeId]) {
    applySidebarTheme(
      container,
      mapPresetToAiStudioSidebar(themeRegistry[currentThemeId]),
    );
  }

  // Subscribe to changes
  const unsubscribe = usePegasusStore.subscribe((state, prevState) => {
    if (state.customTheme !== prevState.customTheme) {
      refreshThemeRegistry();
      const preset = state.customTheme ? themeRegistry[state.customTheme] : null;
      applySidebarTheme(
        container,
        preset ? mapPresetToAiStudioSidebar(preset) : null,
      );
    }
  });

  return unsubscribe;
}
