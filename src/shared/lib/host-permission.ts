/**
 * Dynamic host permission management for optional origins.
 *
 * When an origin is declared in `optional_host_permissions` instead of
 * `host_permissions`, Chrome won't prompt users at install time.
 * We request access at runtime only when the user actually wants the feature.
 *
 * NOTE: chrome.permissions.request() can only be called from extension pages
 * (popup, options, tabs opened with extension URLs), NOT from content scripts.
 * For content script contexts, use `openPermissionPage()` which opens a
 * lightweight extension tab to handle the permission request.
 */

/**
 * Check if a specific origin permission is already granted.
 * This works from any context (content script, background, extension page).
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
 * ⚠️ Only works in extension page contexts (popup, options, extension tabs).
 * For content scripts, use `openPermissionPage()` instead.
 */
export async function requestHostPermission(origin: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.request({ origins: [origin] }, (granted) => {
      resolve(granted);
    });
  });
}

/**
 * Open the permission grant page in a new tab.
 * Use this from content scripts where chrome.permissions.request() is not available.
 * Returns a promise that resolves to true once permission is granted (via storage listener).
 */
export function openPermissionPage(origin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const permUrl = browser.runtime.getURL(`/permissions.html?origins=${encodeURIComponent(origin)}`);

    // Listen for the grant signal from the permissions page
    const listener = (changes: Record<string, { oldValue?: any; newValue?: any }>) => {
      if ('_permission_granted' in changes) {
        browser.storage.local.onChanged.removeListener(listener);
        // Clean up the temp key
        void browser.storage.local.remove('_permission_granted');
        resolve(true);
      }
    };
    browser.storage.local.onChanged.addListener(listener);

    // Open the permission page in a new tab
    window.open(permUrl, '_blank');

    // Timeout: if user doesn't grant within 2 minutes, resolve false
    setTimeout(() => {
      browser.storage.local.onChanged.removeListener(listener);
      resolve(false);
    }, 120_000);
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
