'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { AffiliatorManager } from './AffiliatorManager';

export default function AffiliatePage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  });

  const fromStr = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const toStr = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '';
  const queryString = fromStr && toStr ? `?from=${fromStr}&to=${toStr}` : '';

  const { data: affiliators, isLoading, mutate } = useSWR(`/api/data/affiliates${queryString}`);
  const { data: productData } = useSWR('/api/data/products');
  const { data: warehouseData } = useSWR('/api/data/warehouses');

  const products = productData?.products || [];
  const warehouses = warehouseData?.warehouses || [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header section with Date Range Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Database &amp; Pengiriman Affiliate</h1>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">KOL &amp; Sample</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Kelola database affiliator dan monitoring stok sample yang dikirim langsung dari gudang pusat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <DateRangePicker date={dateRange} setDate={setDateRange} />
          <PdfExportButton targetId="affiliate-report" filename={`affiliate-report-${fromStr || 'all'}`} />
        </div>
      </div>

      {isLoading && !affiliators ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ color: '#64748b', fontSize: 14, fontWeight: 600 }}>Memuat data affiliator &amp; distribusi sample...</div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div id="affiliate-report">
          <AffiliatorManager
            affiliators={affiliators || []}
            products={products}
            warehouses={warehouses}
            dateRange={dateRange}
            mutate={mutate}
          />
        </div>
      )}
    </div>
  );
}
