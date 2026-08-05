/**
 * Sign-in hint for the overlay.
 *
 * The sidebar is account-scoped, so when no account can be detected on the page
 * we let everything keep working but toast a reminder to sign in.
 */

import { detectAccount } from '@/entrypoints/content/shared/detect-account';
import { Platform } from '@/shared/types/platform';
import { toast } from '@/shared/lib/toast';
import i18n from '@/locale/i18n';

/**
 * Shorter than the default detection timeout: on a signed-out page the account
 * element never shows up, so there's no point waiting the full 10s.
 */
const DETECT_TIMEOUT_MS = 6000;

/** How long the "please sign in" toast stays visible. */
const TOAST_DURATION_MS = 10000;

/**
 * Toast a sign-in reminder when no account is detected. Fire-and-forget: never
 * throws and never blocks the overlay from mounting.
 */
export function warnIfNoAccount(platform: Platform): void {
  detectAccount(platform, DETECT_TIMEOUT_MS)
    .then((username) => {
      if (username) return;
      console.warn(`Better Sidebar: No account detected on ${platform}`);
      toast.warning(i18n.t('account.signInRequired'), TOAST_DURATION_MS);
    })
    .catch((e) => {
      console.warn('Better Sidebar: Account detection failed', e);
    });
}
