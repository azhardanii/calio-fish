'use client';

import React from 'react';
import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { OutletManager } from './OutletManager';

export default function OutletPage() {
  const { data: outlets, isLoading } = useSWR('/api/data/outlets');

  if (isLoading && !outlets) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data outlet...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <OutletManager outlets={outlets || []} />
        </CardContent>
      </Card>
    </div>
  );
}
