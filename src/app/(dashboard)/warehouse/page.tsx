'use client';

import React from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Building2, PackageMinus } from 'lucide-react';
import Link from 'next/link';

function formatDateFull(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function WarehousePage() {
  const { data, isLoading } = useSWR('/api/data/warehouses');

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data warehouse...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const warehouses = data?.warehouses || [];
  const shipments = data?.shipments || [];
  const totalShipments = data?.totalShipments || 0;
  const totalItemsSent = data?.totalItemsSent || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-500">Laporan detail pergerakan barang keluar gudang.</p>
        <div className="flex space-x-3">
          <PdfExportButton targetId="warehouse-report" filename="laporan-pengiriman" />
          <Link href="/input" className="action-btn btn-primary">
            <PlusCircle className="w-5 h-5 mr-2" />
            Quick Input
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={{ background: '#eff6ff', borderRadius: 12, padding: 20, border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>TOTAL RESI / PENGIRIMAN</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af', marginTop: 4 }}>{totalShipments}</div>
        </div>
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 20, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>TOTAL PRODUK KELUAR</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#15803d', marginTop: 4 }}>{totalItemsSent} pcs</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {warehouses.map((w: any) => {
          const totalKerugian = w.stocks.reduce((acc: number, s: any) => acc + (s.returned_qty * Number(s.product.base_price)), 0);
          return (
            <Card key={w.id} className="border-t-4 border-t-blue-600 shadow-md">
              <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50">
                <CardTitle className="flex items-center gap-2 text-xl text-blue-900">
                  <Building2 className="text-blue-600" />
                  {w.name}
                  <Badge variant="outline" className="ml-2">{w.type}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {w.stocks.map((s: any) => (
                    <div key={s.id} className="p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                      <div className="text-sm font-medium text-gray-500">{s.product.name}</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">{s.quantity} <span className="text-sm font-normal text-gray-500">pcs</span></div>
                    </div>
                  ))}
                </div>
                {totalKerugian > 0 && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PackageMinus className="text-red-500 w-5 h-5" />
                      <div className="font-semibold text-red-800">Estimasi Kerugian (Retur)</div>
                    </div>
                    <div className="font-bold text-lg text-red-700">Rp {totalKerugian.toLocaleString('id-ID')}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div id="warehouse-report" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Pengiriman (Outbound)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tujuan</TableHead>
                  <TableHead>Detail Barang (Pcs)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Diinput Oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((s: any) => (
                  <TableRow key={s.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="align-top font-medium text-gray-700">
                      {formatDateFull(s.date)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-semibold text-ocean-900">
                         {s.destination_type === 'Outlet' ? 'Cabang / Outlet' :
                          s.destination_type === 'Affiliate' ? 'Kreator / Affiliate' :
                          s.destination_type === 'E-Commerce' ? 'E-Commerce / Marketplace' :
                          s.destination_type}
                      </div>
                      <div className="text-sm text-muted mt-1 font-medium">
                        Tujuan: {s.outlet ? s.outlet.nama : s.affiliate ? s.affiliate.nama : s.destination_name || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {s.items.map((item: any) => (
                          <span key={item.id} style={{ background: '#f3f4f6', color: '#374151', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb' }}>
                            {item.product.short_name}: <span className="text-blue-600">{item.qty}</span>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <span className={
                        s.status === 'SHIPPED' ? 'bdg bdg-green' :
                        s.status === 'PENDING' ? 'bdg bdg-yellow' : 'bdg bdg-red'
                      }>
                        {s.status}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="text-gray-600">
                        {s.employee ? s.employee.nama : 'Sistem'}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {shipments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8 text-lg">Belum ada riwayat pengiriman.</TableCell>
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
