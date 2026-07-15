'use client';

import React from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';

export default function DistribusiSamplePage() {
  const { data: reports, isLoading } = useSWR('/api/data/distribusi-sample');

  if (isLoading && !reports) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data distribusi sample...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const data = reports || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Distribusi Sample</h1>
        <PdfExportButton targetId="sample-report" filename="distribusi-sample" />
      </div>

      <div id="sample-report" className="space-y-6 bg-white p-4 rounded-xl">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>History Distribusi Sample Produk</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis Sample</TableHead>
                  <TableHead>Total Produk</TableHead>
                  <TableHead>Biaya Ekspedisi</TableHead>
                  <TableHead>Diinput Oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>{new Date(r.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="font-medium">{r.jenis_sample}</TableCell>
                    <TableCell>{r.total_produk} pcs</TableCell>
                    <TableCell>Rp {Number(r.biaya_ekspedisi).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-gray-600">
                      {r.employee ? r.employee.nama : 'Sistem'}
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-4">Belum ada data distribusi sample</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
