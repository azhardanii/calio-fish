'use client';

import React from 'react';
import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { AffiliatorManager } from './AffiliatorManager';

export default function AffiliatePage() {
  const { data: affiliators, isLoading } = useSWR('/api/data/affiliates');

  if (isLoading && !affiliators) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data affiliator...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Database Affiliator</h1>
        <PdfExportButton targetId="affiliate-report" filename="affiliate-report" />
      </div>
      <div id="affiliate-report" className="space-y-6 bg-white p-4 rounded-xl">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardContent className="pt-6">
            <AffiliatorManager affiliators={affiliators || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
