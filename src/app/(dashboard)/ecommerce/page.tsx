'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { formatCurrency } from '@/lib/utils';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import {
  setOnlineTarget,
  createMarketingOnlineReport,
  updateMarketingOnlineReport,
  deleteMarketingOnlineReport,
} from '@/app/actions';

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
            {saving ? 'Menyimpan...' : 'Simpan Target'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal Input / Edit Laporan Penjualan E-Commerce
function EcommerceReportModal({
  editingReport,
  products,
  warehouses,
  onClose,
  onSaved,
}: {
  editingReport: any | null;
  products: any[];
  warehouses: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(editingReport);
  const [date, setDate] = useState(
    editingReport?.date
      ? new Date(editingReport.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [platform, setPlatform] = useState<'shopee' | 'tiktok'>(
    editingReport?.platform?.toLowerCase() === 'tiktok' ? 'tiktok' : 'shopee'
  );
  const [omsetHarian, setOmsetHarian] = useState<string>(
    editingReport ? String(Number(editingReport.omset_harian || 0)) : ''
  );
  const [targetHarian, setTargetHarian] = useState<string>(
    editingReport && Number(editingReport.target_harian || 0) > 0
      ? String(Number(editingReport.target_harian))
      : ''
  );
  const centralWarehouse =
    warehouses.find((w: any) => w.type === 'FACTORY' || w.name?.toLowerCase().includes('banyuwangi')) ||
    warehouses[0];
  const [warehouseId, setWarehouseId] = useState<string>(centralWarehouse?.id || '');
  const [deductStock, setDeductStock] = useState(false);
  const [items, setItems] = useState<Array<{ product_id: string; qty: number }>>([
    { product_id: products[0]?.id || '', qty: 1 },
  ]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !omsetHarian) return;
    setSaving(true);
    try {
      const targetVal = targetHarian ? Number(targetHarian) : undefined;
      if (isEditing) {
        await updateMarketingOnlineReport(editingReport.id, {
          date,
          platform,
          omset_harian: Number(omsetHarian),
          target_harian: targetVal ?? 0,
        });
      } else {
        const validItems = deductStock
          ? items.filter((it) => it.product_id && it.qty > 0)
          : undefined;
        await createMarketingOnlineReport({
          date,
          platform,
          omset_harian: Number(omsetHarian),
          target_harian: targetVal,
          warehouse_id: deductStock && validItems?.length ? warehouseId : undefined,
          items: validItems?.length ? validItems : undefined,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Gagal menyimpan laporan e-commerce');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-lg font-extrabold text-slate-900">
            {isEditing ? '✏️ Edit Laporan E-Commerce' : '🛒 Catat Penjualan E-Commerce'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tanggal</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as 'shopee' | 'tiktok')}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="shopee">🛍️ Shopee</option>
                <option value="tiktok">🎵 TikTok</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Omset Harian (Rp) *</label>
              <input
                type="number"
                min={0}
                required
                placeholder="Contoh: 2500000"
                value={omsetHarian}
                onChange={(e) => setOmsetHarian(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Target Harian (Opsional)</label>
              <input
                type="number"
                min={0}
                placeholder="Otomatis dari target/30"
                value={targetHarian}
                onChange={(e) => setTargetHarian(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          {!isEditing && products.length > 0 && warehouses.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductStock}
                  onChange={(e) => setDeductStock(e.target.checked)}
                />
                <span>Sekalian potong stok gudang &amp; catat pengiriman produk keluar</span>
              </label>

              {deductStock && (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gudang Asal</label>
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    >
                      {warehouses.map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Item Terjual</span>
                      <button
                        type="button"
                        onClick={() => setItems([...items, { product_id: products[0]?.id || '', qty: 1 }])}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        + Tambah Produk
                      </button>
                    </div>
                    {items.map((it, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={it.product_id}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...next[idx], product_id: e.target.value };
                            setItems(next);
                          }}
                          className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                        >
                          {products.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...next[idx], qty: Math.max(1, Number(e.target.value) || 1) };
                            setItems(next);
                          }}
                          className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-center font-bold bg-white"
                        />
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setItems(items.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-700 font-bold px-1.5 cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Simpan Laporan'}
            </button>
          </div>
        </form>
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
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);

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
          <DateRangePicker date={dateRange} setDate={setDateRange} />
          <button
            type="button"
            onClick={() => setAppliedDateRange(dateRange)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            Tampilkan
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const def = {
                from: new Date(today.getFullYear(), today.getMonth(), 1),
                to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
              };
              setDateRange(def);
              setAppliedDateRange(def);
            }}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium border border-slate-300 transition"
          >
            Reset Bulan Ini
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingReport(null);
              setReportModalOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition shadow-sm cursor-pointer"
          >
            + Catat Penjualan E-Commerce
          </button>
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
                  Edit
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
                  Edit
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
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
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
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReport(r);
                            setReportModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Hapus laporan penjualan online ini?')) return;
                            try {
                              await deleteMarketingOnlineReport(r.id);
                              await mutate();
                            } catch (err: any) {
                              alert(err?.message || 'Gagal menghapus laporan');
                            }
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 cursor-pointer"
                        >
                          Hapus
                        </button>
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

      {/* Create / Edit Report Modal */}
      {reportModalOpen && (
        <EcommerceReportModal
          editingReport={editingReport}
          products={data?.products || []}
          warehouses={data?.warehouses || []}
          onClose={() => {
            setReportModalOpen(false);
            setEditingReport(null);
          }}
          onSaved={() => mutate()}
        />
      )}
    </div>
  );
}
