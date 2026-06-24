'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useCallback } from 'react';

/**
 * AutoRefresh: Uses document visibility API to only refresh when user
 * is actively viewing the page. No polling when tab is hidden.
 * Default: 30 seconds.
 */
export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  const refresh = useCallback(() => {
    if (document.visibilityState === 'visible') {
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
  }, [refresh, intervalMs]);

  return null;
}
