/**
 * Theme transition utility — circular clip-path expansion animation
 * from the click point, revealing the new theme inside the expanding circle
 * while the old theme remains visible outside.
 *
 * Uses the View Transition API when available. Falls back to instant switch.
 *
 * The key insight: we animate clip-path on ::view-transition-new(root)
 * which is the NEW theme layer. The OLD theme layer sits beneath at full size.
 * As the circle expands, more of the new theme is revealed.
 *
 * For this to work correctly, the theme DOM changes MUST happen synchronously
 * within the startViewTransition callback.
 */

import { applyTheme, removeTheme } from '@/themes';
import { themeRegistry } from '@/themes';
import { syncGeminiTheme, syncAiStudioTheme } from '@/shared/lib/utils/utils';
import { detectPlatform, Platform } from '@/shared/types/platform';

/** ID for the injected style element on the host page */
const VIEW_TRANSITION_STYLE_ID = 'better-sidebar-view-transition-css';

/**
 * Ensure the view-transition CSS rules are present in the HOST document (not Shadow DOM).
 * This is required because ::view-transition-* pseudo-elements live on the document level.
 */
function ensureViewTransitionStyles(): void {
  if (document.getElementById(VIEW_TRANSITION_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = VIEW_TRANSITION_STYLE_ID;
  style.textContent = `
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
::view-transition-old(root) {
  z-index: 1;
}
::view-transition-new(root) {
  z-index: 9999;
}
`;
  document.head.appendChild(style);
}

/**
 * Immediately apply a custom theme (or revert to default) in a synchronous manner.
 * This ensures the DOM is fully updated within the View Transition callback
 * so the browser captures the correct "new" snapshot.
 */
function applyThemeSync(
  themeId: string | null,
  lightDarkTheme: 'light' | 'dark' | 'system',
): void {
  if (themeId && themeRegistry[themeId]) {
    applyTheme(themeRegistry[themeId]);
    const preset = themeRegistry[themeId];
    const platform = detectPlatform();

    // Force page to theme's preferred mode synchronously
    if (platform === Platform.GEMINI) {
      syncGeminiTheme(preset.preferredMode);
    } else if (platform === Platform.AI_STUDIO) {
      syncAiStudioTheme(preset.preferredMode);
    }
  } else {
    removeTheme();
    const platform = detectPlatform();
    if (platform === Platform.GEMINI) {
      syncGeminiTheme(lightDarkTheme);
    } else if (platform === Platform.AI_STUDIO) {
      syncAiStudioTheme(lightDarkTheme);
    }
  }
}

/**
 * Perform a theme change with circular clip-path expansion animation
 * originating from the mouse click position.
 *
 * @param event - The mouse event from clicking the theme button
 * @param updateCallback - The function that performs the store state update
 * @param themeId - The new theme preset ID (null = default/no custom theme)
 * @param lightDarkTheme - The light/dark/system setting for fallback
 * @param duration - Animation duration in ms (default 600)
 */
export function startViewTransition(
  event: React.MouseEvent | MouseEvent,
  updateCallback: () => void,
  themeId?: string | null,
  lightDarkTheme?: 'light' | 'dark' | 'system',
  duration = 600,
): void {
  // Fallback: just apply the change immediately
  if (!document.startViewTransition) {
    updateCallback();
    return;
  }

  // Inject CSS rules into host document (not Shadow DOM)
  ensureViewTransitionStyles();

  // Get click coordinates
  const x = event.clientX;
  const y = event.clientY;

  // Compute the radius needed to cover the entire viewport
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = document.startViewTransition(() => {
    // 1. Update store state (this triggers subscriber which also calls applyTheme,
    //    but since applyTheme is idempotent with removeTheme() first, it's fine)
    updateCallback();

    // 2. Force synchronous DOM changes so the browser captures the new state
    if (themeId !== undefined) {
      applyThemeSync(themeId ?? null, lightDarkTheme ?? 'system');
    }
  });

  transition.ready.then(() => {
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pseudoElement: '::view-transition-new(root)',
      },
    );
  });
}
