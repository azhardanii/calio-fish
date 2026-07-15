'use client';

import { SWRConfig } from 'swr';
import React from 'react';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
});

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: true,
        dedupingInterval: 5000,
        refreshInterval: 60000, // Auto-refresh every 60s (replaces AutoRefresh)
        errorRetryCount: 3,
        keepPreviousData: true, // Key for zero-loading feel on filter changes
      }}
    >
      {children}
    </SWRConfig>
  );
}
