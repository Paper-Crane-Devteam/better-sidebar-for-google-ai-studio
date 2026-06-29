/**
 * Power Pack Paywall
 *
 * Shows a rich popup when users try to access Power Pack features
 * without an active license. Uses a global zustand store so it can
 * be triggered from anywhere (hooks, event handlers, tool executors).
 */

import { create } from 'zustand';
import { openPurchasePage } from './license-links';
import { isPowerPackUser } from './license-store';

export interface PaywallState {
  /** Whether the paywall popup is currently visible */
  isOpen: boolean;
  /** The feature name that triggered the paywall (used for display) */
  featureName: string | null;
  /** Open the paywall popup */
  show: (featureName?: string) => void;
  /** Close the paywall popup */
  close: () => void;
}

export const usePaywallStore = create<PaywallState>((set) => ({
  isOpen: false,
  featureName: null,
  show: (featureName) => set({ isOpen: true, featureName: featureName ?? null }),
  close: () => set({ isOpen: false, featureName: null }),
}));

/**
 * Show the Power Pack paywall popup.
 *
 * Call this from anywhere — UI components, hooks, tool executors, etc.
 * If the user already has Power Pack, this is a no-op and returns true.
 *
 * @param featureName - Optional i18n key or display name for the feature being gated
 * @returns true if user has access (no paywall shown), false if paywall was shown
 *
 * @example
 * ```ts
 * if (!showPowerPackPaywall('AI Agent')) {
 *   return; // user doesn't have access, paywall is displayed
 * }
 * // proceed with premium feature
 * ```
 */
export function showPowerPackPaywall(featureName?: string): boolean {
  if (isPowerPackUser()) {
    return true; // user has access, no paywall needed
  }
  usePaywallStore.getState().show(featureName);
  return false;
}

/**
 * Guard a callback behind the Power Pack paywall.
 * If the user has Power Pack, the callback executes immediately.
 * Otherwise the paywall popup is shown and the callback is not executed.
 *
 * @example
 * ```ts
 * const handleAgentAction = guardWithPaywall('AI Agent', () => {
 *   // ... premium logic
 * });
 * ```
 */
export function guardWithPaywall<T extends (...args: any[]) => any>(
  featureName: string,
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>) => {
    if (!showPowerPackPaywall(featureName)) {
      return undefined;
    }
    return fn(...args);
  };
}

/** Convenience: open the purchase page directly */
export { openPurchasePage };
