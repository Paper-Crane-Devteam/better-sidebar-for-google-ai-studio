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

import { applyTheme, removeTheme, preloadThemeFonts } from '@/themes';
import { themeRegistry } from '@/themes';
import { syncGeminiTheme, syncAiStudioTheme } from '@/shared/lib/utils/utils';
import { detectPlatform, Platform } from '@/shared/types/platform';

/** ID for the injected style element on the host page */
const VIEW_TRANSITION_STYLE_ID = 'better-sidebar-view-transition-css';

/** Marker class on <html>, present only while OUR theme transition is running */
const VT_ACTIVE_CLASS = 'bs-theme-transition';

/**
 * Ensure the view-transition CSS rules are present in the HOST document (not Shadow DOM).
 * This is required because ::view-transition-* pseudo-elements live on the document level.
 */
function ensureViewTransitionStyles(): void {
  if (document.getElementById(VIEW_TRANSITION_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = VIEW_TRANSITION_STYLE_ID;
  // Everything is scoped to the marker class so a view transition started by
  // the host page (Gemini/AI Studio use them for their own navigation) keeps
  // its default behaviour.
  style.textContent = `
:root.${VT_ACTIVE_CLASS}::view-transition-old(root),
:root.${VT_ACTIVE_CLASS}::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
:root.${VT_ACTIVE_CLASS}::view-transition-old(root) {
  z-index: 1;
}
:root.${VT_ACTIVE_CLASS}::view-transition-new(root) {
  z-index: 9999;
  /* Start fully clipped. The WAAPI animation takes over from here; without
     this the new theme would show at full size on any frame that renders
     before the animation is attached. */
  clip-path: circle(0px at var(--bs-vt-x, 50%) var(--bs-vt-y, 50%));
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
 * @param duration - Animation duration in ms (default 500)
 */
export function startViewTransition(
  event: React.MouseEvent | MouseEvent,
  updateCallback: () => void,
  themeId?: string | null,
  lightDarkTheme?: 'light' | 'dark' | 'system',
  duration = 500,
): void {
  // Fallback: just apply the change immediately
  if (!document.startViewTransition) {
    updateCallback();
    return;
  }

  // Read click coordinates now — the event object is reused/pooled and the
  // work below is async.
  const x = event.clientX;
  const y = event.clientY;

  void runThemeTransition({ x, y, updateCallback, themeId, lightDarkTheme, duration });
}

async function runThemeTransition({
  x,
  y,
  updateCallback,
  themeId,
  lightDarkTheme,
  duration,
}: {
  x: number;
  y: number;
  updateCallback: () => void;
  themeId?: string | null;
  lightDarkTheme?: 'light' | 'dark' | 'system';
  duration: number;
}): Promise<void> {
  // Inject CSS rules into host document (not Shadow DOM)
  ensureViewTransitionStyles();

  // Download the theme's webfonts BEFORE the transition starts.
  // Otherwise they land mid-animation and the resulting full-page relayout
  // freezes the expanding circle for as long as the relayout takes.
  const preset = themeId ? themeRegistry[themeId] : null;
  if (preset) {
    // Short budget: the click should not feel unresponsive if the network is
    // slow. Cards also warm their fonts on hover, so this is usually instant.
    await preloadThemeFonts(preset, 300);
  }

  // Compute the radius needed to cover the entire viewport
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  // Feed the click point to the CSS fallback clip (see ensureViewTransitionStyles)
  const root = document.documentElement;
  root.style.setProperty('--bs-vt-x', `${x}px`);
  root.style.setProperty('--bs-vt-y', `${y}px`);
  root.classList.add(VT_ACTIVE_CLASS);

  const transition = document.startViewTransition(() => {
    // 1. Update store state (this triggers subscriber which also calls applyTheme,
    //    but since applyTheme is idempotent with removeTheme() first, it's fine)
    updateCallback();

    // 2. Force synchronous DOM changes so the browser captures the new state
    if (themeId !== undefined) {
      applyThemeSync(themeId ?? null, lightDarkTheme ?? 'system');
    }
  });

  transition.ready
    .then(() => {
      // Must stay synchronous inside this callback: the browser ends the
      // transition once no animations are attached to the pseudo-elements,
      // so deferring this (rAF/timeout) can drop the animation entirely.
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration,
          // Ease-out: most of the visible progress happens early, so a late
          // main-thread hiccup reads as settling rather than as a freeze
          // followed by a jump to full screen.
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          // Hold the end state so the CSS fallback clip (circle(0)) doesn't
          // snap back before the transition tears down.
          fill: 'both',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {
      // Transition was skipped (e.g. another one started) — nothing to animate.
    });

  // Drop the marker once the transition is over (or was skipped) so host-page
  // view transitions are never affected.
  transition.finished.finally(() => {
    root.classList.remove(VT_ACTIVE_CLASS);
  });
}
