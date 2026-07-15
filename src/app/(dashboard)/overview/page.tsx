'use client';

import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import OverviewClient from './OverviewClient';

function OverviewContent() {
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'this_month';
  const month = searchParams.get('month') || '';
  const year = searchParams.get('year') || '';

  const apiUrl = `/api/data/overview?filter=${filter}${month ? `&month=${month}` : ''}${year ? `&year=${year}` : ''}`;

  const { data, isLoading, isValidating } = useSWR(apiUrl, { 
    revalidateOnFocus: false,
    refreshInterval: 90000 
  });

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data overview...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) return null;

  return <OverviewClient data={data} isValidating={isValidating} />;
}

export default function OverviewPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Mempersiapkan...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <OverviewContent />
    </Suspense>
  );
}
