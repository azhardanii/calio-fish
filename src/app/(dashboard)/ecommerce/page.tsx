'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { formatCurrency } from '@/lib/utils';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { setOnlineTarget } from '@/app/actions';

function formatRp(val: number) {
  return formatCurrency(val);
}

function ProgressBar({ value, color = '#3b82f6' }: { value: number; color?: string }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 999, height: 10, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${clamped}%`, background: `linear-gradient(90deg, ${color}, ${color}dd)`, height: '100%', borderRadius: 999, transition: 'width 0.6s ease' }} />
    </div>
  );
}

// Modal Edit Target E-Commerce (Shopee / TikTok)
function SetEcommerceTargetModal({
  platform,
  currentTarget,
  onClose,
  onSaved,
}: {
  platform: 'shopee' | 'tiktok';
  currentTarget: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [target, setTarget] = useState(currentTarget);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setOnlineTarget(platform, Number(target));
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e.message || 'Gagal menyimpan target');
    } finally {
      setSaving(false);
    }
  };

  const isShopee = platform === 'shopee';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
          {isShopee ? '🛍️ Atur Target Shopee Official' : '🎵 Atur Target TikTok Shop'}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
          Target omset bulanan untuk penjualan online di {isShopee ? 'Shopee' : 'TikTok'}.
        </p>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>
          Target Bulanan (Rp)
        </label>
        <input
          type="number"
          value={target}
          onChange={e => setTarget(Number(e.target.value))}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 16, fontWeight: 700, marginBottom: 20, outline: 'none', boxSizing: 'border-box' }}
          placeholder="Contoh: 100000000"
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 20px',
              borderRadius: 10,
              border: 'none',
              background: isShopee ? 'linear-gradient(135deg, #ea580c, #c2410c)' : 'linear-gradient(135deg, #0f172a, #334155)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? '⏳ Menyimpan...' : '💾 Simpan Target'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EcommercePage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    };
  });
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>(dateRange);

  const [filterPlatform, setFilterPlatform] = useState<'ALL' | 'SHOPEE' | 'TIKTOK'>('ALL');
  const [targetModalPlatform, setTargetModalPlatform] = useState<'shopee' | 'tiktok' | null>(null);

  const apiUrl = useMemo(() => {
    if (appliedDateRange?.from) {
      const fromStr = format(appliedDateRange.from, 'yyyy-MM-dd');
      const toDate = appliedDateRange.to || appliedDateRange.from;
      const toStr = format(toDate, 'yyyy-MM-dd');
      return `/api/data/marketing?startDate=${fromStr}&endDate=${toStr}`;
    }
    return '/api/data/marketing';
  }, [appliedDateRange]);

  const { data, isLoading, mutate } = useSWR(apiUrl);
  const { data: currentUser } = useSWR('/api/auth/me');

  const isOwnerOrAdmin = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data E-Commerce...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const onlineReports: any[] = data?.onlineReports || [];
  const globalShopeeTarget = Number(data?.globalShopeeTarget || 0);
  const globalTiktokTarget = Number(data?.globalTiktokTarget || 0);

  const shopeeReports = onlineReports.filter((r: any) => r.platform?.toLowerCase() === 'shopee');
  const tiktokReports = onlineReports.filter((r: any) => r.platform?.toLowerCase() === 'tiktok');

  const shopeeOmsetMtd = shopeeReports.reduce((sum: number, r: any) => sum + Number(r.omset_harian), 0);
  const tiktokOmsetMtd = tiktokReports.reduce((sum: number, r: any) => sum + Number(r.omset_harian), 0);
  const totalOmsetOnline = shopeeOmsetMtd + tiktokOmsetMtd;
  const totalTargetOnline = globalShopeeTarget + globalTiktokTarget;

  const shopeePersentase = globalShopeeTarget > 0 ? (shopeeOmsetMtd / globalShopeeTarget) * 100 : 0;
  const tiktokPersentase = globalTiktokTarget > 0 ? (tiktokOmsetMtd / globalTiktokTarget) * 100 : 0;
  const totalPersentase = totalTargetOnline > 0 ? (totalOmsetOnline / totalTargetOnline) * 100 : 0;

  // Filtered reports table
  const displayedReports = onlineReports.filter((r: any) => {
    if (filterPlatform === 'SHOPEE') return r.platform?.toLowerCase() === 'shopee';
    if (filterPlatform === 'TIKTOK') return r.platform?.toLowerCase() === 'tiktok';
    return true;
  });

  return (
    <div className="space-y-6" id="ecommerce-report">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🛒</span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              E-Commerce & Marketplace
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Pusat monitoring penjualan online resmi CalioFish (Shopee Official & TikTok Shop).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onApply={() => setAppliedDateRange(dateRange)}
            onReset={() => {
              const today = new Date();
              const def = {
                from: new Date(today.getFullYear(), today.getMonth(), 1),
                to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
              };
              setDateRange(def);
              setAppliedDateRange(def);
            }}
          />
          <PdfExportButton targetId="ecommerce-report" filename="laporan-ecommerce-caliofish" />
        </div>
      </div>

      {/* Global Summary KPI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100/60 rounded-2xl p-4 sm:p-5 border border-blue-200/80 shadow-xs">
          <div className="text-xs text-blue-700 font-bold uppercase tracking-wider">TOTAL OMSET E-COMMERCE</div>
          <div className="text-2xl sm:text-3xl font-black text-blue-950 mt-1">{formatRp(totalOmsetOnline)}</div>
          <div className="text-xs text-blue-600/80 mt-1 font-medium">Akumulasi Shopee + TikTok</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-100/60 rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-xs">
          <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider">TOTAL TARGET GABUNGAN</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-950 mt-1">{formatRp(totalTargetOnline)}</div>
          <div className="text-xs text-emerald-600/80 mt-1 font-medium">Realisasi: {totalPersentase.toFixed(1)}% dari target</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-100/60 rounded-2xl p-4 sm:p-5 border border-purple-200/80 shadow-xs">
          <div className="text-xs text-purple-700 font-bold uppercase tracking-wider">TRANSAKSI TERCATAT</div>
          <div className="text-2xl sm:text-3xl font-black text-purple-950 mt-1">{onlineReports.length} Laporan</div>
          <div className="text-xs text-purple-600/80 mt-1 font-medium">{shopeeReports.length} Shopee • {tiktokReports.length} TikTok</div>
        </div>
      </div>

      {/* Shopee & TikTok Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Shopee Card */}
        <div className="bg-gradient-to-br from-orange-50/90 to-amber-100/70 rounded-2xl p-5 border border-orange-200 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-200 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl">🛍️</span>
              <div>
                <h4 className="text-lg font-black text-orange-950 leading-tight">Shopee Official</h4>
                <span className="text-xs font-semibold text-orange-700/80">Marketplace Online</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-orange-200/80 text-orange-900 border border-orange-300 text-xs px-3 py-1 rounded-full font-bold">
                Target: {globalShopeeTarget > 0 ? formatRp(globalShopeeTarget) : 'Belum diset'}
              </span>
              {isOwnerOrAdmin && (
                <button
                  onClick={() => setTargetModalPlatform('shopee')}
                  className="text-xs bg-white text-orange-700 border border-orange-200 hover:bg-orange-50 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  ✏️ Edit
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-orange-900 mb-1.5">
              <span>Pencapaian Periode</span>
              <span className="font-extrabold">{shopeePersentase.toFixed(1)}%</span>
            </div>
            <ProgressBar value={shopeePersentase} color="#ea580c" />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white/95 p-3 rounded-xl border border-orange-100">
              <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">OMSET</div>
              <div className="text-sm sm:text-base font-black text-orange-950 truncate">{formatRp(shopeeOmsetMtd)}</div>
            </div>
            <div className="bg-white/95 p-3 rounded-xl border border-orange-100">
              <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">PENCAPAIAN</div>
              <div className="text-sm sm:text-base font-black text-orange-950">{shopeePersentase.toFixed(1)}%</div>
            </div>
            <div className="bg-white/95 p-3 rounded-xl border border-orange-100">
              <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">GAP TARGET</div>
              <div className={`text-sm sm:text-base font-black truncate ${(shopeeOmsetMtd - globalShopeeTarget) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(shopeeOmsetMtd - globalShopeeTarget) >= 0 ? '+' : '-'}{formatRp(Math.abs(shopeeOmsetMtd - globalShopeeTarget))}
              </div>
            </div>
          </div>
        </div>

        {/* TikTok Card */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/95 rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl">🎵</span>
              <div>
                <h4 className="text-lg font-black text-slate-900 leading-tight">TikTok Shop</h4>
                <span className="text-xs font-semibold text-slate-500">Social Commerce</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-slate-200/80 text-slate-800 border border-slate-300 text-xs px-3 py-1 rounded-full font-bold">
                Target: {globalTiktokTarget > 0 ? formatRp(globalTiktokTarget) : 'Belum diset'}
              </span>
              {isOwnerOrAdmin && (
                <button
                  onClick={() => setTargetModalPlatform('tiktok')}
                  className="text-xs bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  ✏️ Edit
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <span>Pencapaian Periode</span>
              <span className="font-extrabold">{tiktokPersentase.toFixed(1)}%</span>
            </div>
            <ProgressBar value={tiktokPersentase} color="#0f172a" />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white/95 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">OMSET</div>
              <div className="text-sm sm:text-base font-black text-slate-900 truncate">{formatRp(tiktokOmsetMtd)}</div>
            </div>
            <div className="bg-white/95 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">PENCAPAIAN</div>
              <div className="text-sm sm:text-base font-black text-slate-900">{tiktokPersentase.toFixed(1)}%</div>
            </div>
            <div className="bg-white/95 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">GAP TARGET</div>
              <div className={`text-sm sm:text-base font-black truncate ${(tiktokOmsetMtd - globalTiktokTarget) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(tiktokOmsetMtd - globalTiktokTarget) >= 0 ? '+' : '-'}{formatRp(Math.abs(tiktokOmsetMtd - globalTiktokTarget))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Online Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📋</span> Riwayat Laporan Penjualan E-Commerce
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Daftar rekaman transaksi harian dari Shopee & TikTok</p>
          </div>

          {/* Filter Platform Buttons */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterPlatform('ALL')}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filterPlatform === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Semua ({onlineReports.length})
            </button>
            <button
              onClick={() => setFilterPlatform('SHOPEE')}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filterPlatform === 'SHOPEE' ? 'bg-orange-500 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Shopee ({shopeeReports.length})
            </button>
            <button
              onClick={() => setFilterPlatform('TIKTOK')}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filterPlatform === 'TIKTOK' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              TikTok ({tiktokReports.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Platform</th>
                <th className="py-3 px-4 text-right">Omset Harian</th>
                <th className="py-3 px-4 text-right">Target Harian</th>
                <th className="py-3 px-4 text-center">Gap</th>
                <th className="py-3 px-4">Pelapor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada laporan penjualan online pada rentang tanggal ini.
                  </td>
                </tr>
              ) : (
                displayedReports.map((r: any) => {
                  const isShp = r.platform?.toLowerCase() === 'shopee';
                  const gap = Number(r.omset_harian || 0) - Number(r.target_harian || 0);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isShp ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          <span>{isShp ? '🛍️' : '🎵'}</span>
                          <span>{isShp ? 'Shopee' : 'TikTok'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                        {formatRp(Number(r.omset_harian || 0))}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                        {Number(r.target_harian || 0) > 0 ? formatRp(Number(r.target_harian || 0)) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {Number(r.target_harian || 0) > 0 ? (
                          <span className={`font-bold text-xs ${gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {gap >= 0 ? '+' : ''}{formatRp(gap)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {r.employee?.nama || 'Admin / AI Webhook'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Target Modal */}
      {targetModalPlatform && (
        <SetEcommerceTargetModal
          platform={targetModalPlatform}
          currentTarget={targetModalPlatform === 'shopee' ? globalShopeeTarget : globalTiktokTarget}
          onClose={() => setTargetModalPlatform(null)}
          onSaved={() => mutate()}
        />
      )}
    </div>
  );
}
