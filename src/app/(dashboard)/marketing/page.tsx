'use client';

import React from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { Tabs } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';

function formatRp(val: number) { return formatCurrency(val); }

export default function MarketingPage() {
  const { data, isLoading } = useSWR('/api/data/marketing');

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data marketing...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const offlineReports = data?.offlineReports || [];
  const onlineReports = data?.onlineReports || [];
  const globalOfflineTarget = data?.globalOfflineTarget || 0;
  const globalShopeeTarget = data?.globalShopeeTarget || 0;
  const globalTiktokTarget = data?.globalTiktokTarget || 0;

  const latestOffline = offlineReports[0];
  const shopeeReports = onlineReports.filter((r: any) => r.platform.toLowerCase() === 'shopee');
  const tiktokReports = onlineReports.filter((r: any) => r.platform.toLowerCase() === 'tiktok');
  const latestShopee = shopeeReports[0];
  const latestTiktok = tiktokReports[0];

  const currentOfflineTarget = globalOfflineTarget > 0 ? globalOfflineTarget : (latestOffline ? Number(latestOffline.target_bulanan) : 0);
  const currentShopeeTarget = globalShopeeTarget > 0 ? globalShopeeTarget : (latestShopee ? Number(latestShopee.target_mtd) : 0);
  const currentTiktokTarget = globalTiktokTarget > 0 ? globalTiktokTarget : (latestTiktok ? Number(latestTiktok.target_mtd) : 0);

  const targetMonth = latestOffline ? new Date(latestOffline.date).getMonth() : new Date().getMonth();
  const targetYear = latestOffline ? new Date(latestOffline.date).getFullYear() : new Date().getFullYear();

  const offlineOmsetMtd = offlineReports
    .filter((r: any) => new Date(r.date).getMonth() === targetMonth && new Date(r.date).getFullYear() === targetYear)
    .reduce((sum: number, r: any) => sum + Number(r.omset_harian), 0);
  const offlineGap = currentOfflineTarget > 0 ? (currentOfflineTarget - offlineOmsetMtd) * -1 : 0;
  const offlinePersentase = currentOfflineTarget > 0 ? (offlineOmsetMtd / currentOfflineTarget) * 100 : 0;
  const currentOutletAktif = data?.totalOutlets || offlineReports.find((r: any) => Number(r.jumlah_outlet_aktif) > 0)?.jumlah_outlet_aktif || 0;

  const shopeeOmsetMtd = shopeeReports
    .filter((r: any) => new Date(r.date).getMonth() === targetMonth && new Date(r.date).getFullYear() === targetYear)
    .reduce((sum: number, r: any) => sum + Number(r.omset_harian), 0);
  const shopeePersentase = currentShopeeTarget > 0 ? (shopeeOmsetMtd / currentShopeeTarget) * 100 : 0;

  const tiktokOmsetMtd = tiktokReports
    .filter((r: any) => new Date(r.date).getMonth() === targetMonth && new Date(r.date).getFullYear() === targetYear)
    .reduce((sum: number, r: any) => sum + Number(r.omset_harian), 0);
  const tiktokPersentase = currentTiktokTarget > 0 ? (tiktokOmsetMtd / currentTiktokTarget) * 100 : 0;

  // Running MTD
  let cumulativeMtd = 0, currentMonth = -1;
  const enrichedOfflineReports = [...offlineReports].reverse().map((r: any) => {
    const rMonth = new Date(r.date).getMonth();
    if (rMonth !== currentMonth) { currentMonth = rMonth; cumulativeMtd = 0; }
    cumulativeMtd += Number(r.omset_harian);
    return { ...r, calculated_omset_mtd: cumulativeMtd, calculated_persentase: currentOfflineTarget > 0 ? (cumulativeMtd / currentOfflineTarget) * 100 : 0 };
  }).reverse();

  let cumulativeShopee = 0, currentShopeeMonth = -1;
  const enrichedShopeeReports = [...shopeeReports].reverse().map((r: any) => {
    const rMonth = new Date(r.date).getMonth();
    if (rMonth !== currentShopeeMonth) { currentShopeeMonth = rMonth; cumulativeShopee = 0; }
    cumulativeShopee += Number(r.omset_harian);
    return { ...r, calculated_omset_mtd: cumulativeShopee, calculated_persentase: currentShopeeTarget > 0 ? (cumulativeShopee / currentShopeeTarget) * 100 : 0 };
  }).reverse();

  let cumulativeTiktok = 0, currentTiktokMonth = -1;
  const enrichedTiktokReports = [...tiktokReports].reverse().map((r: any) => {
    const rMonth = new Date(r.date).getMonth();
    if (rMonth !== currentTiktokMonth) { currentTiktokMonth = rMonth; cumulativeTiktok = 0; }
    cumulativeTiktok += Number(r.omset_harian);
    return { ...r, calculated_omset_mtd: cumulativeTiktok, calculated_persentase: currentTiktokTarget > 0 ? (cumulativeTiktok / currentTiktokTarget) * 100 : 0 };
  }).reverse();

  const enrichedOnlineReports = [...enrichedShopeeReports, ...enrichedTiktokReports].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const tabs = [
    {
      id: 'offline',
      label: 'Offline (Outlet & Personal Buyer)',
      content: (
        <section className="space-y-6">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {/* Target Bulanan */}
            <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: 16, padding: '20px 24px', border: '1px solid #bfdbfe', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.1)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>🎯</span> TARGET BULANAN
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1e3a8a' }}>{formatRp(currentOfflineTarget)}</div>
              <div style={{ position: 'absolute', right: -15, bottom: -15, fontSize: 80, opacity: 0.05 }}>🎯</div>
            </div>
            
            {/* Omset MTD */}
            <div style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', borderRadius: 16, padding: '20px 24px', border: '1px solid #ddd6fe', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.1)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: 13, color: '#7c3aed', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>💰</span> OMSET MTD
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#4c1d95' }}>{formatRp(offlineOmsetMtd)}</div>
              <div style={{ position: 'absolute', right: -15, bottom: -15, fontSize: 80, opacity: 0.05 }}>💰</div>
            </div>

            {/* Persentase */}
            <div style={{ background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)', borderRadius: 16, padding: '20px 24px', border: '1px solid #fde047', boxShadow: '0 4px 15px rgba(234, 179, 8, 0.1)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: 13, color: '#ca8a04', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>📈</span> PERSENTASE
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#713f12' }}>{offlinePersentase.toFixed(1)}%</div>
              <div style={{ position: 'absolute', right: -15, bottom: -15, fontSize: 80, opacity: 0.05 }}>📈</div>
            </div>

            {/* Gap */}
            <div style={{
              background: offlineGap >= 0 ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              borderRadius: 16, padding: '20px 24px',
              border: offlineGap >= 0 ? '1px solid #bbf7d0' : '1px solid #fecaca',
              boxShadow: offlineGap >= 0 ? '0 4px 15px rgba(34, 197, 94, 0.1)' : '0 4px 15px rgba(239, 68, 68, 0.1)',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ fontSize: 13, color: offlineGap >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>{offlineGap >= 0 ? '✅' : '⚠️'}</span> GAP
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: offlineGap >= 0 ? '#14532d' : '#7f1d1d' }}>{formatRp(Math.abs(offlineGap))}</div>
              <div style={{ fontSize: 12, color: offlineGap >= 0 ? '#16a34a' : '#dc2626', marginTop: 4 }}>{offlineGap >= 0 ? 'Target tercapai' : 'Kurang dari target'}</div>
              <div style={{ position: 'absolute', right: -15, bottom: -15, fontSize: 80, opacity: 0.05 }}>{offlineGap >= 0 ? '✅' : '⚠️'}</div>
            </div>

            {/* Outlet Aktif */}
            <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: 16, padding: '20px 24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(100, 116, 139, 0.1)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: 13, color: '#475569', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>🏪</span> OUTLET AKTIF
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{currentOutletAktif}</div>
              <div style={{ position: 'absolute', right: -15, bottom: -15, fontSize: 80, opacity: 0.05 }}>🏪</div>
            </div>
          </div>
          <Card>
            <CardHeader><CardTitle>History Laporan Offline</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Omset Harian</TableHead>
                    <TableHead>Diinput Oleh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedOfflineReports.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>{new Date(r.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>{formatRp(Number(r.omset_harian))}</TableCell>
                      <TableCell className="text-gray-600">{r.employee ? r.employee.nama : 'Sistem'}</TableCell>
                    </TableRow>
                  ))}
                  {enrichedOfflineReports.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-gray-500 py-4">Belum ada data laporan offline</TableCell></TableRow>
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
            <div style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', borderRadius: 16, padding: '24px', border: '1px solid #fed7aa', boxShadow: '0 4px 20px rgba(234, 88, 12, 0.1)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>🛍️</span>
                  <span style={{ fontSize: 18, color: '#c2410c', fontWeight: 800, letterSpacing: 0.5 }}>Shopee</span>
                </div>
                <span style={{ fontSize: 12, color: '#9a3412', background: 'rgba(255, 237, 213, 0.8)', padding: '6px 12px', borderRadius: 20, fontWeight: 600, border: '1px solid #fdba74' }}>
                  Target: {currentShopeeTarget > 0 ? formatRp(currentShopeeTarget) : '-'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, position: 'relative', zIndex: 2 }}>
                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 12, border: '1px solid #ffedd5', boxShadow: '0 2px 8px rgba(234, 88, 12, 0.05)' }}>
                  <div style={{ fontSize: 11, color: '#ea580c', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>OMSET MTD</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#7c2d12' }}>{formatRp(shopeeOmsetMtd)}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 12, border: '1px solid #ffedd5', boxShadow: '0 2px 8px rgba(234, 88, 12, 0.05)' }}>
                  <div style={{ fontSize: 11, color: '#ea580c', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>PENCAPAIAN</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#7c2d12' }}>{`${shopeePersentase.toFixed(1)}%`}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 12, border: '1px solid #ffedd5', boxShadow: '0 2px 8px rgba(234, 88, 12, 0.05)' }}>
                  <div style={{ fontSize: 11, color: '#ea580c', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>GAP</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: (shopeeOmsetMtd - currentShopeeTarget) >= 0 ? '#15803d' : '#b91c1c' }}>{formatRp(Math.abs(shopeeOmsetMtd - currentShopeeTarget))}</div>
                </div>
              </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: 16, padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(71, 85, 105, 0.1)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>🎵</span>
                  <span style={{ fontSize: 18, color: '#334155', fontWeight: 800, letterSpacing: 0.5 }}>TikTok</span>
                </div>
                <span style={{ fontSize: 12, color: '#1e293b', background: 'rgba(226, 232, 240, 0.8)', padding: '6px 12px', borderRadius: 20, fontWeight: 600, border: '1px solid #cbd5e1' }}>
                  Target: {currentTiktokTarget > 0 ? formatRp(currentTiktokTarget) : '-'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, position: 'relative', zIndex: 2 }}>
                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 12, border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(71, 85, 105, 0.05)' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>OMSET MTD</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{formatRp(tiktokOmsetMtd)}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 12, border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(71, 85, 105, 0.05)' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>PENCAPAIAN</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{`${tiktokPersentase.toFixed(1)}%`}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: 12, border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(71, 85, 105, 0.05)' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>GAP</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: (tiktokOmsetMtd - currentTiktokTarget) >= 0 ? '#15803d' : '#b91c1c' }}>{formatRp(Math.abs(tiktokOmsetMtd - currentTiktokTarget))}</div>
                </div>
              </div>
            </div>
          </div>
          <Card>
            <CardHeader><CardTitle>History Laporan Online</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Omset Harian</TableHead>
                    <TableHead>Diinput Oleh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedOnlineReports.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>{new Date(r.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>
                        <span style={{
                          background: r.platform.toLowerCase() === 'shopee' ? '#ffedd5' : '#e2e8f0',
                          color: r.platform.toLowerCase() === 'shopee' ? '#c2410c' : '#334155',
                          padding: '4px 10px', borderRadius: 8, fontWeight: 600, fontSize: 12, textTransform: 'capitalize'
                        }}>{r.platform}</span>
                      </TableCell>
                      <TableCell>{formatRp(Number(r.omset_harian))}</TableCell>
                      <TableCell className="text-gray-600">{r.employee ? r.employee.nama : 'Sistem'}</TableCell>
                    </TableRow>
                  ))}
                  {enrichedOnlineReports.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-4">Belum ada data laporan online</TableCell></TableRow>
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
    <div className="space-y-6">
      <div className="flex justify-end mb-6">
        <PdfExportButton targetId="marketing-report" filename="marketing-report" />
      </div>
      <div id="marketing-report">
        <Tabs tabs={tabs} />
      </div>
    </div>
  );
}
