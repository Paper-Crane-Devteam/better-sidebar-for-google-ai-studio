/**
 * Dynamic host permission management for optional origins.
 *
 * When an origin is declared in `optional_host_permissions` instead of
 * `host_permissions`, Chrome won't prompt users at install time.
 * We request access at runtime only when the user actually wants the feature.
 *
 * Usage:
 * ```ts
 * import { hasHostPermission, requestHostPermission } from '@/shared/lib/host-permission';
 *
 * const granted = await hasHostPermission('https://api.notion.com/*');
 * if (!granted) {
 *   const ok = await requestHostPermission('https://api.notion.com/*');
 *   if (!ok) return; // user denied
 * }
 * ```
 */

/**
 * Check if a specific origin permission is already granted.
 */
export async function hasHostPermission(origin: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: [origin] }, (result) => {
      resolve(result);
    });
  });
}

/**
 * Request a host permission from the user.
 * Must be called from a user gesture context (click handler, etc.)
 * Returns true if granted, false if denied.
 */
export async function requestHostPermission(origin: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.request({ origins: [origin] }, (granted) => {
      resolve(granted);
    });
  });
}

/**
 * Remove a previously granted host permission.
 */
export async function removeHostPermission(origin: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.remove({ origins: [origin] }, (removed) => {
      resolve(removed);
    });
  });
}

// ─── Predefined origins ──────────────────────────────────────────

export const NOTION_ORIGIN = 'https://api.notion.com/*';
