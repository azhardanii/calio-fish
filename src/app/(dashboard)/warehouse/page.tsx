import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { prisma } from '@/lib/prisma';

export default async function PaketKirimanPage() {
  const reports = await prisma.paketKiriman.findMany({
    orderBy: { date: 'desc' },
  });

  // Aggregate totals for summary
  const totalPaket = reports.reduce((sum, r) => sum + r.shopee_paket + (r.tiktok_paket || 0) + r.offline_paket + r.affiliate_paket + r.influencer_paket + r.sample_outlet_paket, 0);
  const totalProduk = reports.reduce((sum, r) => sum + r.fs_original + r.fs_sambal_matah + r.fs_soto + r.fs_rendang + r.abon_90, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Warehouse</h1>
        <PdfExportButton targetId="paket-report" filename="warehouse-report" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={{ background: '#eff6ff', borderRadius: 12, padding: 20, border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>TOTAL PAKET</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af', marginTop: 4 }}>{totalPaket}</div>
        </div>
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 20, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>TOTAL PRODUK KELUAR</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#15803d', marginTop: 4 }}>{totalProduk} pcs</div>
        </div>
        <div style={{ background: '#faf5ff', borderRadius: 12, padding: 20, border: '1px solid #e9d5ff' }}>
          <div style={{ fontSize: 13, color: '#9333ea', fontWeight: 600 }}>JUMLAH LAPORAN</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#7e22ce', marginTop: 4 }}>{reports.length}</div>
        </div>
      </div>

      <div id="paket-report" className="space-y-6 bg-white p-4 rounded-xl">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>History Pengiriman</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Channels (Paket)</TableHead>
                  <TableHead>Products (Pcs)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="align-top font-medium">{new Date(r.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="align-top">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {r.shopee_paket > 0 && <span style={{ background: '#fff7ed', color: '#ea580c', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>Shopee: {r.shopee_paket}</span>}
                        {(r.tiktok_paket || 0) > 0 && <span style={{ background: '#ecfeff', color: '#0891b2', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>TikTok: {r.tiktok_paket}</span>}
                        {r.offline_paket > 0 && <span style={{ background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>Offline: {r.offline_paket}</span>}
                        {r.affiliate_paket > 0 && <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>Affiliate: {r.affiliate_paket}</span>}
                        {r.influencer_paket > 0 && <span style={{ background: '#fce7f3', color: '#be185d', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>Influencer: {r.influencer_paket}</span>}
                        {r.sample_outlet_paket > 0 && <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>Sample: {r.sample_outlet_paket}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {r.fs_original > 0 && <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>FS Ori: {r.fs_original}</span>}
                        {r.fs_sambal_matah > 0 && <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>FS SM: {r.fs_sambal_matah}</span>}
                        {r.fs_soto > 0 && <span style={{ background: '#fefce8', color: '#a16207', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>FS Soto: {r.fs_soto}</span>}
                        {r.fs_rendang > 0 && <span style={{ background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>FS Rend: {r.fs_rendang}</span>}
                        {r.abon_90 > 0 && <span style={{ background: '#faf5ff', color: '#7e22ce', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>Abon: {r.abon_90}</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {reports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500 py-4">Belum ada data laporan</TableCell>
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
