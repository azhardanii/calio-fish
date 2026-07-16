'use client';

import React from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { Badge } from '@/components/ui/badge';
import { Navigation, PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default function PengirimanPage() {
  const { data, isLoading } = useSWR('/api/data/pengiriman');

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data pengiriman...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const shipments = data?.shipments || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Log Pengiriman</h1>
          <p className="text-gray-500 mt-1">Laporan terpusat pendistribusian produk (Online, Outlet, Sample, Retur).</p>
        </div>
        <div className="flex space-x-3">
          <PdfExportButton targetId="pengiriman-report" filename="laporan-pengiriman-terpadu" />
          <Link href="/input" className="action-btn btn-primary">
            <PlusCircle className="w-5 h-5 mr-2" />
            Quick Input
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={{ background: '#eff6ff', borderRadius: 12, padding: 20, border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>TOTAL PENGIRIMAN</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af', marginTop: 4 }}>{data?.totalShipments || 0}</div>
        </div>
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 20, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>TOTAL PRODUK TERKIRIM</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#15803d', marginTop: 4 }}>{data?.totalItemsSent || 0} pcs</div>
        </div>
      </div>

      <div id="pengiriman-report" className="space-y-6 bg-white p-4 rounded-xl mt-6">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>History Distribusi & Pengiriman</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe Pengiriman</TableHead>
                  <TableHead>Rute (Dari &rarr; Ke)</TableHead>
                  <TableHead>Detail Produk</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead>Diinput Oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((s: any) => {
                  const qty = s.items?.reduce((sum: number, item: any) => sum + item.qty, 0) || 0;
                  
                  return (
                    <TableRow key={s.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="whitespace-nowrap">{new Date(s.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {s.shipment_type || 'PENGIRIMAN'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-gray-700">
                            {s.source_name || '-'} 
                          </span>
                          <Navigation className="w-3 h-3 text-gray-400 ml-2" />
                          <span className="text-sm font-bold text-gray-900">
                            {s.destination_name || s.destination_type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{qty} pcs</span>
                        <div className="text-xs text-gray-500 mt-1">
                          {s.items?.length || 0} macam SKU
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs truncate" title={s.notes || '-'}>
                        {s.notes || '-'}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {s.employee ? s.employee.nama : 'Sistem AI'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
