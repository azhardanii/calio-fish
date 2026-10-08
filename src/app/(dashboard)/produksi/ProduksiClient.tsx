'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Download, Edit2, Plus, Trash2 } from 'lucide-react';
import { createProduksiKegiatan, deleteProduksiKegiatan } from '@/app/actions';

interface Produksi {
  id: string;
  date: Date;
  kegiatan: string;
  bahan_baku: number | null;
  bahan_jadi: number | null;
  total_hasil_pcs: number | null;
  employee_name?: string;
}

export function ProduksiClient({ 
  initialData, 
  targetPcs = 200, 
  targetKg = 50, 
  exportButton,
  mutate,
  products = [],
  warehouses = []
}: { 
  initialData: Produksi[], 
  targetPcs?: number, 
  targetKg?: number, 
  exportButton?: React.ReactNode,
  mutate?: () => void,
  products?: any[],
  warehouses?: any[]
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterKegiatan, setFilterKegiatan] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    }
  });
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>(dateRange);

  const filteredData = useMemo(() => {
    let data = [...initialData];

    if (filterKegiatan !== 'all') {
      data = data.filter((p) => p.kegiatan.toLowerCase() === filterKegiatan.toLowerCase());
    }

    if (appliedDateRange?.from) {
      data = data.filter((p) => {
        const itemDate = new Date(p.date);
        itemDate.setHours(0, 0, 0, 0);
        
        const from = new Date(appliedDateRange.from!);
        from.setHours(0, 0, 0, 0);
        
        const to = appliedDateRange.to ? new Date(appliedDateRange.to) : new Date(from);
        to.setHours(23, 59, 59, 999);

        return itemDate >= from && itemDate <= to;
      });
    }
    return data;
  }, [initialData, filterKegiatan, appliedDateRange]);

  const daysInPeriod = useMemo(() => {
    if (!appliedDateRange?.from) return 1;
    const from = appliedDateRange.from;
    const to = appliedDateRange.to || from;
    const diffTime = Math.abs(to.getTime() - from.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return days || 1;
  }, [appliedDateRange]);

  const totalTargetPcs = targetPcs * daysInPeriod;
  const totalTargetKg = targetKg * daysInPeriod;

  // Calculations for Top Cards (Dynamic based on filter)
  const summaryStats = useMemo(() => {
    let totalPcs = 0;
    let totalKg = 0;
    let sumBaku = 0;
    let sumJadi = 0;

    filteredData.forEach(p => {
      if (p.total_hasil_pcs) totalPcs += Number(p.total_hasil_pcs);
      if (p.bahan_jadi && p.kegiatan.toLowerCase() !== 'mengemas') {
        totalKg += Number(p.bahan_jadi);
      }
      if (p.bahan_baku && p.bahan_jadi) {
        sumBaku += Number(p.bahan_baku);
        sumJadi += Number(p.bahan_jadi);
      }
    });

    const rendemen = sumBaku > 0 ? (sumJadi / sumBaku) * 100 : 0;
    
    return {
      totalPcs,
      totalKg,
      rendemen: rendemen.toFixed(1)
    };
  }, [filteredData]);

  // Data for Charts (Dynamic based on filter)
  const chartData = useMemo(() => {
    const dataMap: Record<string, { dateStr: string; pcs: number; rendemen: number; sumBaku: number; sumJadi: number; sortKey: number }> = {};
    
    let isYearly = false;
    if (dateRange?.from) {
      const from = dateRange.from;
      const to = dateRange.to || from;
      const diffTime = Math.abs(to.getTime() - from.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (days > 31) {
        isYearly = true;
      }
    } else {
      isYearly = true;
    }

    filteredData.forEach(p => {
      const d = new Date(p.date);
      let key = '';
      let dateStr = '';
      let sortKey = 0;

      if (isYearly) {
        key = `${d.getFullYear()}-${d.getMonth()}`;
        dateStr = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      } else {
        key = d.toDateString();
        dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        sortKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }

      if (!dataMap[key]) {
        dataMap[key] = { dateStr, pcs: 0, rendemen: 0, sumBaku: 0, sumJadi: 0, sortKey };
      }

      if (p.total_hasil_pcs) dataMap[key].pcs += Number(p.total_hasil_pcs);
      if (p.bahan_baku && p.bahan_jadi) {
        dataMap[key].sumBaku += Number(p.bahan_baku);
        dataMap[key].sumJadi += Number(p.bahan_jadi);
      }
    });

    return Object.values(dataMap)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(item => ({
        date: item.dateStr,
        pcs: item.pcs,
        rendemen: item.sumBaku > 0 ? Number(((item.sumJadi / item.sumBaku) * 100).toFixed(1)) : 0
      }));
  }, [filteredData, appliedDateRange]);

  const defaultKegiatan = ['Pembersihan', 'Pengemasan'];
  const uniqueKegiatan = Array.from(new Set([...defaultKegiatan, ...initialData.map(p => p.kegiatan)]));

  const filterLabel = useMemo(() => {
    if (!appliedDateRange?.from) return 'Lifetime (Semua Waktu)';
    
    const fromDate = appliedDateRange.from;
    const toDate = appliedDateRange.to || fromDate;
    
    const isFullMonth = 
      fromDate.getDate() === 1 && 
      toDate.getDate() === new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0).getDate() &&
      fromDate.getMonth() === toDate.getMonth() &&
      fromDate.getFullYear() === toDate.getFullYear();

    if (isFullMonth) {
      return fromDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }
    
    const fromStr = fromDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    
    // Check if the selected date is exactly today
    const today = new Date();
    const isToday = fromDate.getDate() === today.getDate() && 
                    fromDate.getMonth() === today.getMonth() &&
                    fromDate.getFullYear() === today.getFullYear();

    const isSameDay = fromDate.getTime() === toDate.getTime();

    if (isSameDay) {
      return isToday ? 'Hari Ini' : fromStr;
    }
    
    const toStr = toDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fromStr} - ${toStr}`;
  }, [appliedDateRange]);

  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  const exportToCsv = () => {
    const headers = ['Tanggal', 'Kegiatan', 'Bahan Baku (kg)', 'Bahan Jadi (kg)', 'Rendemen (%)', 'Hasil (pcs)', 'Diinput Oleh'];
    const rows = filteredData.map(p => [
      new Date(p.date).toLocaleDateString('id-ID'),
      `"${p.kegiatan.replace(/"/g, '""')}"`,
      p.bahan_baku ?? '',
      p.bahan_jadi ?? '',
      p.bahan_baku && p.bahan_jadi ? ((Number(p.bahan_jadi) / Number(p.bahan_baku)) * 100).toFixed(1) : '',
      p.total_hasil_pcs ?? '',
      p.employee_name || 'Sistem'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `produksi_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6">
      {/* ── FILTER TOOLBAR ── */}
      <div className="marketing-filter-toolbar">
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Produksi</h2>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Menampilkan data untuk: <b>{filterLabel}</b>
          </div>
        </div>

        <div className="marketing-filter-actions">
          <select 
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white shrink-0 outline-none focus:border-blue-500 cursor-pointer h-9 w-full sm:w-auto"
            value={filterKegiatan}
            onChange={(e) => setFilterKegiatan(e.target.value)}
          >
            <option value="all">Semua Kegiatan</option>
            {uniqueKegiatan.map(k => (
               <option key={k} value={k}>{k}</option>
            ))}
          </select>

          <DateRangePicker date={dateRange} setDate={setDateRange} />

          <button
            onClick={() => setAppliedDateRange(dateRange)}
            className="overview-filter-btn"
          >
            Tampilkan
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer transition-all shadow-sm active:scale-95"
          >
            <Plus size={16} /> Tambah Kegiatan
          </button>

          <button
            onClick={exportToCsv}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-400 bg-amber-50 text-amber-800 text-sm font-bold cursor-pointer hover:bg-amber-100 transition-colors"
          >
            <Download size={15} /> Export CSV
          </button>

          {exportButton && (
            <div>
              {exportButton}
            </div>
          )}
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white shadow-sm border-blue-100">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-blue-600 mb-2">Pencapaian (Pcs) {filterLabel}</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gray-900">{summaryStats.totalPcs}</span>
              <span className="text-sm text-gray-500 mb-1">/ {totalTargetPcs} pcs</span>
            </div>
            <div className="mt-4 h-2 w-full bg-blue-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${summaryStats.totalPcs >= totalTargetPcs ? 'bg-green-500' : 'bg-blue-500'}`} 
                style={{ width: `${Math.min((summaryStats.totalPcs / totalTargetPcs) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {((summaryStats.totalPcs / totalTargetPcs) * 100 || 0).toFixed(1)}% tercapai
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-white shadow-sm border-indigo-100">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-indigo-600 mb-2">Barang Setengah Jadi (Kg) {filterLabel}</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gray-900">{summaryStats.totalKg.toFixed(1)}</span>
              <span className="text-sm text-gray-500 mb-1">/ {totalTargetKg} kg</span>
            </div>
            <div className="mt-4 h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${summaryStats.totalKg >= totalTargetKg ? 'bg-green-500' : 'bg-indigo-500'}`} 
                style={{ width: `${Math.min((summaryStats.totalKg / totalTargetKg) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {((summaryStats.totalKg / totalTargetKg) * 100 || 0).toFixed(1)}% tercapai
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white shadow-sm border-emerald-100">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-emerald-600 mb-2">Rata-Rata Rendemen {filterLabel}</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gray-900">{summaryStats.rendemen}%</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <span className={`text-xs font-semibold px-2 py-1 rounded-full ${Number(summaryStats.rendemen) >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                 {Number(summaryStats.rendemen) >= 80 ? 'Efisien' : (Number(summaryStats.rendemen) === 0 ? 'Belum Ada Data' : 'Perlu Perhatian')}
               </span>
               <span className="text-xs text-gray-500">(Ideal &gt; 80%)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">Output Produksi (Pcs) - {filterLabel}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="pcs" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Produksi Pcs" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">Tren Rendemen (%) - {filterLabel}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="rendemen" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Rendemen %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>



      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle>Riwayat Produksi Harian</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kegiatan</TableHead>
                <TableHead>Bahan Baku (kg)</TableHead>
                <TableHead>Bahan Jadi (kg)</TableHead>
                <TableHead>Rendemen</TableHead>
                <TableHead>Total Hasil (pcs)</TableHead>
                <TableHead>Diinput Oleh</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((p) => {
                const yieldPerc = p.bahan_baku && p.bahan_jadi ? ((p.bahan_jadi / p.bahan_baku) * 100).toFixed(1) : null;
                return (
                  <TableRow key={p.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium">{new Date(p.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="capitalize">{p.kegiatan}</TableCell>
                    <TableCell>{p.bahan_baku ? `${Number(p.bahan_baku)} kg` : '-'}</TableCell>
                    <TableCell>{p.bahan_jadi ? `${Number(p.bahan_jadi)} kg` : '-'}</TableCell>
                    <TableCell>
                      {yieldPerc ? (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${Number(yieldPerc) >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {yieldPerc}%
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="font-bold">{p.total_hasil_pcs ? `${p.total_hasil_pcs} pcs` : '-'}</TableCell>
                    <TableCell className="text-gray-600">{p.employee_name || 'Sistem'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="Info input/edit via sistem & WA"
                          onClick={() => alert(`Data produksi "${p.kegiatan}" tanggal ${new Date(p.date).toLocaleDateString('id-ID')}.\nUntuk memperbarui data, Anda bisa menambahkan kegiatan revisi atau input baru.`)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          title="Hapus baris kegiatan produksi"
                          onClick={async () => {
                            if (confirm(`Hapus kegiatan produksi "${p.kegiatan}" tanggal ${new Date(p.date).toLocaleDateString('id-ID')}?`)) {
                              try {
                                await deleteProduksiKegiatan(p.id);
                                if (mutate) mutate();
                              } catch (err: any) {
                                alert(err.message || 'Gagal menghapus kegiatan');
                              }
                            }
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">Belum ada data produksi.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── MODAL: TAMBAH KEGIATAN PRODUKSI ── */}
      {isModalOpen && (
        <TambahKegiatanModal
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            if (mutate) mutate();
          }}
          products={products}
          warehouses={warehouses}
        />
      )}
    </div>
  );
}

function TambahKegiatanModal({ 
  onClose, 
  onSaved,
  products = [],
  warehouses = []
}: { 
  onClose: () => void; 
  onSaved: () => void;
  products?: any[];
  warehouses?: any[];
}) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [kegiatan, setKegiatan] = useState<'Pembersihan' | 'Pengemasan'>('Pembersihan');
  const [bahanBaku, setBahanBaku] = useState<string>('');
  const [bahanJadi, setBahanJadi] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(warehouses[0]?.id || '');
  const [totalHasilPcs, setTotalHasilPcs] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (products.length > 0 && !selectedProductId) setSelectedProductId(products[0].id);
    if (warehouses.length > 0 && !selectedWarehouseId) setSelectedWarehouseId(warehouses[0].id);
  }, [products, warehouses, selectedProductId, selectedWarehouseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kegiatan === 'Pengemasan') {
      if (!totalHasilPcs || parseInt(totalHasilPcs, 10) <= 0) {
        alert('Masukkan jumlah hasil kemasan jadi (pcs) yang valid.');
        return;
      }
      if (!selectedProductId) {
        alert('Pilih varian produk jadi.');
        return;
      }
    }

    setLoading(true);
    try {
      const selectedProduct = products.find(p => p.id === selectedProductId);
      await createProduksiKegiatan({
        date,
        kegiatan,
        jenis_produksi: kegiatan === 'Pengemasan' ? (selectedProduct?.name || selectedProduct?.short_name) : undefined,
        bahan_baku: bahanBaku ? parseFloat(bahanBaku) : null,
        bahan_jadi: kegiatan === 'Pembersihan' ? (bahanJadi ? parseFloat(bahanJadi) : null) : null,
        total_hasil_pcs: kegiatan === 'Pengemasan' && totalHasilPcs ? parseInt(totalHasilPcs, 10) : null,
        product_id: kegiatan === 'Pengemasan' ? selectedProductId : undefined,
        warehouse_id: kegiatan === 'Pengemasan' ? (selectedWarehouseId || warehouses[0]?.id) : undefined,
      });
      alert(`✅ Kegiatan "${kegiatan}" berhasil dicatat!${kegiatan === 'Pengemasan' ? ' Stok produk & gudang telah bertambah.' : ''}`);
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan kegiatan produksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>🏭</span> Tambah Laporan Produksi
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Pencatatan pembersihan &amp; penambahan stok dari pengemasan</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Tanggal Kegiatan *</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Jenis Kegiatan *</label>
            <select
              value={kegiatan}
              onChange={e => setKegiatan(e.target.value as 'Pembersihan' | 'Pengemasan')}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-semibold text-gray-800"
            >
              <option value="Pembersihan">🐟 Pembersihan (Bahan Beku → Bahan Kering)</option>
              <option value="Pengemasan">📦 Pengemasan (Bahan Kering → Bahan Jadi Masuk Stok)</option>
            </select>
          </div>

          {/* MODE 1: PEMBERSIHAN (HANYA PENCATATAN, TIDAK MASUK STOK) */}
          {kegiatan === 'Pembersihan' && (
            <div className="space-y-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
              <div className="text-xs text-amber-900 font-medium leading-relaxed">
                <span className="font-bold">📝 Catatan Alur:</span> Pembersihan (bahan beku → bahan kering) hanya bersifat pencatatan konversi berat dan <u>tidak menambah stok kemasan</u>.
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Bahan Beku (Kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={bahanBaku}
                    onChange={e => setBahanBaku(e.target.value)}
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Bahan Kering (Kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={bahanJadi}
                    onChange={e => setBahanJadi(e.target.value)}
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-bold text-emerald-700"
                  />
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: PENGEMASAN (MASUK KE STOK PRODUK & GUDANG) */}
          {kegiatan === 'Pengemasan' && (
            <div className="space-y-3 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
              <div className="text-xs text-emerald-900 font-medium leading-relaxed">
                <span className="font-bold">📦 Masuk ke Stok:</span> Hasil pengemasan akan otomatis menambahkan stok produk siap jual dan tercatat masuk ke stok gudang yang dipilih.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Produk Jadi (SKU) *</label>
                  <select
                    value={selectedProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-semibold text-gray-800"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.short_name || p.name} (Stok: {p.stok} pcs)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Gudang Tujuan Masuk Stok *</label>
                  <select
                    value={selectedWarehouseId}
                    onChange={e => setSelectedWarehouseId(e.target.value)}
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-semibold text-gray-800"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        🏬 {w.name} ({w.type === 'FACTORY' ? 'Pabrik' : 'Penyimpanan'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Bahan Kering Terpakai (Kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={bahanBaku}
                    onChange={e => setBahanBaku(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Hasil Jadi Kemasan (Pcs) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 150"
                    value={totalHasilPcs}
                    onChange={e => setTotalHasilPcs(e.target.value)}
                    required
                    className="w-full p-2.5 border border-emerald-400 rounded-lg text-sm bg-white font-black text-emerald-700"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-3 justify-end border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Menyimpan...' : 'Simpan Laporan Produksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
