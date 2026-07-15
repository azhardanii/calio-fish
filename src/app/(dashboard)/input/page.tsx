'use client';

import React from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import WarehouseInputForm from './WarehouseInputForm';
import KaryawanInputForm from './KaryawanInputForm';
import OutletInputForm from './OutletInputForm';

export default function QuickInputPage() {
  const { data, isLoading } = useSWR('/api/data/input-refs');

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data referensi...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const { outlets = [], affiliates = [], products = [], employees = [] } = data || {};

  const tabs = [
    {
      id: 'warehouse',
      label: 'Logistik & Pengiriman',
      content: <WarehouseInputForm outlets={outlets} affiliates={affiliates} products={products} />
    },
    {
      id: 'karyawan',
      label: 'Presensi Karyawan',
      content: <KaryawanInputForm employees={employees} />
    },
    {
      id: 'outlet',
      label: 'Data Outlet',
      content: <OutletInputForm outlets={outlets} />
    }
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <p className="text-muted mt-1">Gunakan form di bawah ini untuk input data operasional secara cepat dan valid tanpa melalui WhatsApp.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pilih Kategori Input</CardTitle>
          <CardDescription>Pilih tab yang sesuai dengan data yang ingin Anda masukkan.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs tabs={tabs} />
        </CardContent>
      </Card>
    </div>
  );
}
