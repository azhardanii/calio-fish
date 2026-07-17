'use client';

import React from 'react';
import useSWR from 'swr';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { ProduksiClient } from './ProduksiClient';

export default function ProduksiPage() {
  const { data, isLoading } = useSWR('/api/data/production');

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data produksi...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-6">
        <PdfExportButton targetId="produksi-report" filename="laporan-produksi" />
      </div>
      <div id="produksi-report">
        <ProduksiClient 
          initialData={data?.data || []} 
          targetPcs={data?.targetPcs || 200} 
          targetKg={data?.targetKg || 50} 
        />
      </div>
    </div>
  );
}
