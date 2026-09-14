'use client';

import React from 'react';
import useSWR from 'swr';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { PengeluaranClient } from './PengeluaranClient';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function PengeluaranPage() {
  const { data, isLoading } = useSWR('/api/pengeluaran', fetcher);

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data pengeluaran...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div id="pengeluaran-report">
        <PengeluaranClient 
          initialData={data?.data || []} 
          exportButton={<PdfExportButton targetId="pengeluaran-report" filename="laporan-pengeluaran" />}
        />
      </div>
    </div>
  );
}
