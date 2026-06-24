import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { Tabs } from '@/components/ui/tabs';
import { prisma } from '@/lib/prisma';

function formatRp(val: number) {
  return 'Rp ' + val.toLocaleString('id-ID');
}

export default async function MarketingPage() {
  const [offlineReports, onlineReports] = await Promise.all([
    prisma.marketingOffline.findMany({ orderBy: { date: 'desc' } }),
    prisma.marketingOnline.findMany({ orderBy: { date: 'desc' } })
  ]);

  const latestOffline = offlineReports[0];
  
  // Get latest online for shopee and tiktok
  const shopeeReports = onlineReports.filter(r => r.platform.toLowerCase() === 'shopee');
  const tiktokReports = onlineReports.filter(r => r.platform.toLowerCase() === 'tiktok');
  const latestShopee = shopeeReports[0];
  const latestTiktok = tiktokReports[0];

  const tabs = [
    {
      id: 'offline',
      label: 'Offline (Outlet & Personal Buyer)',
      content: (
        <section className="space-y-6">
          {latestOffline && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ background: '#eff6ff', borderRadius: 12, padding: '20px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>TARGET BULANAN</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af', marginTop: 4 }}>{formatRp(Number(latestOffline.target_bulanan))}</div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '20px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>OMSET MTD</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#15803d', marginTop: 4 }}>{formatRp(Number(latestOffline.omset_mtd))}</div>
              </div>
              <div style={{ background: '#fefce8', borderRadius: 12, padding: '20px', border: '1px solid #fef08a' }}>
                <div style={{ fontSize: 13, color: '#ca8a04', fontWeight: 600 }}>PERSENTASE</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#a16207', marginTop: 4 }}>{Number(latestOffline.persentase).toFixed(1)}%</div>
              </div>
              <div style={{
                background: Number(latestOffline.gap) >= 0 ? '#f0fdf4' : '#fef2f2',
                borderRadius: 12, padding: '20px',
                border: Number(latestOffline.gap) >= 0 ? '1px solid #bbf7d0' : '1px solid #fecaca'
              }}>
                <div style={{ fontSize: 13, color: Number(latestOffline.gap) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>GAP</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: Number(latestOffline.gap) >= 0 ? '#15803d' : '#b91c1c', marginTop: 4 }}>{formatRp(Number(latestOffline.gap))}</div>
              </div>
            </div>
          )}

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>History Laporan Offline</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Outlet Aktif</TableHead>
                    <TableHead>Omset Harian</TableHead>
                    <TableHead>Omset MTD</TableHead>
                    <TableHead>Persentase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offlineReports.map((r) => (
                    <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>{new Date(r.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell className="font-bold">{r.jumlah_outlet_aktif}</TableCell>
                      <TableCell>{formatRp(Number(r.omset_harian))}</TableCell>
                      <TableCell className="font-bold">{formatRp(Number(r.omset_mtd))}</TableCell>
                      <TableCell>
                        <span style={{
                          background: Number(r.persentase) >= 100 ? '#dcfce7' : '#fef9c3',
                          color: Number(r.persentase) >= 100 ? '#15803d' : '#a16207',
                          padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: 13,
                        }}>
                          {Number(r.persentase).toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {offlineReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-4">Belum ada data laporan offline</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )
    },
    {
      id: 'online',
      label: 'Online (E-Commerce)',
      content: (
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shopee Summary */}
            <div style={{ background: '#fff7ed', borderRadius: 12, padding: '20px', border: '1px solid #fed7aa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 16, color: '#ea580c', fontWeight: 700 }}>Shopee</span>
                <span style={{ fontSize: 12, color: '#c2410c', background: '#ffedd5', padding: '4px 8px', borderRadius: 12 }}>
                  Target: {latestShopee ? formatRp(Number(latestShopee.target_mtd)) : '-'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#ea580c' }}>Omset MTD</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#9a3412' }}>{latestShopee ? formatRp(Number(latestShopee.total_omset_mtd)) : '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#ea580c' }}>Pencapaian</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#9a3412' }}>{latestShopee ? `${Number(latestShopee.persentase).toFixed(1)}%` : '-'}</div>
                </div>
              </div>
            </div>

            {/* TikTok Summary */}
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 16, color: '#334155', fontWeight: 700 }}>TikTok</span>
                <span style={{ fontSize: 12, color: '#475569', background: '#e2e8f0', padding: '4px 8px', borderRadius: 12 }}>
                  Target: {latestTiktok ? formatRp(Number(latestTiktok.target_mtd)) : '-'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#475569' }}>Omset MTD</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{latestTiktok ? formatRp(Number(latestTiktok.total_omset_mtd)) : '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#475569' }}>Pencapaian</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{latestTiktok ? `${Number(latestTiktok.persentase).toFixed(1)}%` : '-'}</div>
                </div>
              </div>
            </div>
          </div>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>History Laporan Online</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Omset Harian</TableHead>
                    <TableHead>Omset MTD</TableHead>
                    <TableHead>Persentase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onlineReports.map((r) => (
                    <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>{new Date(r.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>
                        <span style={{
                          background: r.platform.toLowerCase() === 'shopee' ? '#ffedd5' : '#e2e8f0',
                          color: r.platform.toLowerCase() === 'shopee' ? '#c2410c' : '#334155',
                          padding: '4px 10px', borderRadius: 8, fontWeight: 600, fontSize: 12, textTransform: 'capitalize'
                        }}>
                          {r.platform}
                        </span>
                      </TableCell>
                      <TableCell>{formatRp(Number(r.omset_harian))}</TableCell>
                      <TableCell className="font-bold">{formatRp(Number(r.total_omset_mtd))}</TableCell>
                      <TableCell>
                        <span style={{
                          background: Number(r.persentase) >= 100 ? '#dcfce7' : '#fef9c3',
                          color: Number(r.persentase) >= 100 ? '#15803d' : '#a16207',
                          padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: 13,
                        }}>
                          {Number(r.persentase).toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {onlineReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-4">Belum ada data laporan online</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Marketing</h1>
        <PdfExportButton targetId="marketing-report" filename="marketing-report" />
      </div>

      <div id="marketing-report" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <Tabs tabs={tabs} />
      </div>
    </div>
  );
}
