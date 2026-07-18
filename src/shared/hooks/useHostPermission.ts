/**
 * Reusable hook for checking and requesting optional host permissions.
 *
 * Works with any origin declared in `optional_host_permissions`.
 * The permission request must be triggered from a user gesture (click).
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
import { hasHostPermission, requestHostPermission, removeHostPermission } from '@/shared/lib/host-permission';

export interface UseHostPermissionReturn {
  /** Whether the permission is currently granted */
  granted: boolean;
  /** Whether a permission request is in progress */
  requesting: boolean;
  /** Request the permission (must be called from user gesture) */
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

  const request = useCallback(async (): Promise<boolean> => {
    setRequesting(true);
    try {
      const result = await requestHostPermission(origin);
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
