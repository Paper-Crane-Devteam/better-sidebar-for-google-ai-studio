/**
 * Reusable hook for checking and requesting optional host permissions.
 *
 * Works from content script context — opens an extension tab to handle
 * the actual chrome.permissions.request() call since content scripts
 * can't call it directly.
 *
 * Usage:
 * ```tsx
 * import { useHostPermission } from '@/shared/hooks/useHostPermission';
 * import { NOTION_ORIGIN } from '@/shared/lib/host-permission';
 *
 * const { granted, requesting, request } = useHostPermission(NOTION_ORIGIN);
 *
 * if (!granted) {
 *   return <Button onClick={request}>Allow access to Notion API</Button>;
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { hasHostPermission, openPermissionPage, removeHostPermission } from '@/shared/lib/host-permission';

export interface UseHostPermissionReturn {
  /** Whether the permission is currently granted */
  granted: boolean;
  /** Whether a permission request is in progress */
  requesting: boolean;
  /** Request the permission (opens extension tab for user to confirm) */
  request: () => Promise<boolean>;
  /** Revoke the permission */
  revoke: () => Promise<boolean>;
  /** Re-check permission status */
  refresh: () => Promise<void>;
}

export function useHostPermission(origin: string): UseHostPermissionReturn {
  const [granted, setGranted] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const refresh = useCallback(async () => {
    const result = await hasHostPermission(origin);
    setGranted(result);
  }, [origin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Listen for permission grant signal from the permissions page
  useEffect(() => {
    const listener = (
      changes: Record<string, { oldValue?: any; newValue?: any }>,
      areaName: string,
    ) => {
      if (areaName === 'local' && '_permission_granted' in changes) {
        void refresh();
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, [refresh]);

  const request = useCallback(async (): Promise<boolean> => {
    setRequesting(true);
    try {
      const result = await openPermissionPage(origin);
      setGranted(result);
      return result;
    } finally {
      setRequesting(false);
    }
  }, [origin]);

  const revoke = useCallback(async (): Promise<boolean> => {
    const result = await removeHostPermission(origin);
    if (result) setGranted(false);
    return result;
  }, [origin]);

  return { granted, requesting, request, revoke, refresh };
}
