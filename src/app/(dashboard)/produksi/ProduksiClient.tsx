'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Download, Edit2, Plus, Trash2 } from 'lucide-react';
import {
  createProduksiKegiatan,
  updateProduksiKegiatan,
  deleteProduksiKegiatan,
  createStokBahan,
  updateStokBahan,
  deleteStokBahan,
} from '@/app/actions';

interface Produksi {
  id: string;
  date: Date;
  kegiatan: string;
  jenis_produksi?: string | null;
  bahan_baku: number | null;
  bahan_jadi: number | null;
  total_hasil_pcs: number | null;
  hpp_batch?: number | null;
  employee_name?: string;
}

export function ProduksiClient({ 
  initialData, 
  stokBahan = [],
  targetPcs = 200, 
  targetKg = 50, 
  exportButton,
  mutate,
  products = [],
  warehouses = []
}: { 
  initialData: Produksi[], 
  stokBahan?: any[],
  targetPcs?: number, 
  targetKg?: number, 
  exportButton?: React.ReactNode,
  mutate?: () => void,
  products?: any[],
  warehouses?: any[]
}) {
  const [activeSubTab, setActiveSubTab] = useState<'produksi' | 'stok_bahan'>('produksi');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduksi, setEditingProduksi] = useState<Produksi | null>(null);
  const [isBahanModalOpen, setIsBahanModalOpen] = useState(false);
  const [editingBahan, setEditingBahan] = useState<any>(null);
  const [bahanForm, setBahanForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    kategori: 'KEMASAN',
    jenis_ukuran: '',
    masuk: '',
    keluar: '',
  });
  const [savingBahan, setSavingBahan] = useState(false);
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
      data = data.filter((p) => {
        if (filterKegiatan === 'Pengemasan') {
          return /kemas|pengemasan|packing/i.test(p.kegiatan);
        }
        return p.kegiatan.toLowerCase() === filterKegiatan.toLowerCase();
      });
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
      if (p.bahan_jadi && !/kemas|pengemasan|packing/i.test(p.kegiatan)) {
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
  const uniqueKegiatan = defaultKegiatan;

  const stokBahanSummary = useMemo(() => {
    const map = new Map<string, { kategori: string; jenis_ukuran: string; masuk: number; keluar: number; saldo: number }>();
    for (const sb of stokBahan || []) {
      const k = `${sb.kategori}::${sb.jenis_ukuran}`;
      const cur = map.get(k) || { kategori: sb.kategori, jenis_ukuran: sb.jenis_ukuran, masuk: 0, keluar: 0, saldo: 0 };
      cur.masuk += Number(sb.masuk || 0);
      cur.keluar += Number(sb.keluar || 0);
      cur.saldo = cur.masuk - cur.keluar;
      map.set(k, cur);
    }
    return Array.from(map.values());
  }, [stokBahan]);

  const openBahanModal = (item?: any) => {
    if (item) {
      setEditingBahan(item);
      setBahanForm({
        tanggal: new Date(item.tanggal).toISOString().split('T')[0],
        kategori: item.kategori || 'KEMASAN',
        jenis_ukuran: item.jenis_ukuran || '',
        masuk: String(item.masuk || 0),
        keluar: String(item.keluar || 0),
      });
    } else {
      setEditingBahan(null);
      setBahanForm({
        tanggal: new Date().toISOString().split('T')[0],
        kategori: 'KEMASAN',
        jenis_ukuran: '',
        masuk: '',
        keluar: '',
      });
    }
    setIsBahanModalOpen(true);
  };

  const handleSaveBahan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bahanForm.jenis_ukuran.trim()) {
      alert('Jenis / ukuran bahan wajib diisi');
      return;
    }
    setSavingBahan(true);
    try {
      const payload = {
        tanggal: bahanForm.tanggal,
        kategori: bahanForm.kategori,
        jenis_ukuran: bahanForm.jenis_ukuran,
        masuk: Number(bahanForm.masuk) || 0,
        keluar: Number(bahanForm.keluar) || 0,
      };
      if (editingBahan) {
        await updateStokBahan(editingBahan.id, payload);
      } else {
        await createStokBahan(payload);
      }
      if (mutate) mutate();
      setIsBahanModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan stok bahan');
    } finally {
      setSavingBahan(false);
    }
  };

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
            onClick={() => { setEditingProduksi(null); setIsModalOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer transition-all shadow-sm active:scale-95"
          >
            <Plus size={16} /> Tambah Kegiatan
          </button>

          <button
            onClick={() => openBahanModal()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer transition-all shadow-sm active:scale-95"
          >
            <Plus size={16} /> Input Stok Bahan
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

      {/* Sub-Tab Switcher */}
      <div className="flex gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('produksi')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeSubTab === 'produksi' ? 'bg-slate-900 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🏭 Laporan Produksi Harian ({filteredData.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('stok_bahan')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeSubTab === 'stok_bahan' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📦 Stok Bahan (Kemasan / Bumbu / Kardus) ({stokBahan.length})
        </button>
      </div>

      {activeSubTab === 'stok_bahan' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stokBahanSummary.map((item, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">{item.kategori}</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{item.jenis_ukuran}</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{item.saldo.toLocaleString('id-ID')}</div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Masuk: <b className="text-emerald-700">+{item.masuk}</b> • Keluar: <b className="text-rose-600">-{item.keluar}</b>
                </div>
              </div>
            ))}
            {stokBahanSummary.length === 0 && (
              <div className="col-span-full text-center py-8 bg-gray-50 rounded-xl border border-dashed text-sm text-gray-500">
                Belum ada catatan stok bahan. Klik &quot;+ Input Stok Bahan&quot; untuk menambahkan.
              </div>
            )}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Log Mutasi Stok Bahan (Kemasan, Bumbu, Kardus)</CardTitle>
              <button
                type="button"
                onClick={() => openBahanModal()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                + Tambah Mutasi Bahan
              </button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Jenis / Ukuran</TableHead>
                    <TableHead className="text-right">Masuk</TableHead>
                    <TableHead className="text-right">Keluar</TableHead>
                    <TableHead>PIC</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stokBahan.map((sb: any) => (
                    <TableRow key={sb.id} className="hover:bg-gray-50">
                      <TableCell>{new Date(sb.tanggal).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-bold">{sb.kategori}</span>
                      </TableCell>
                      <TableCell className="font-semibold">{sb.jenis_ukuran}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">{sb.masuk > 0 ? `+${sb.masuk}` : '-'}</TableCell>
                      <TableCell className="text-right font-bold text-rose-600">{sb.keluar > 0 ? `-${sb.keluar}` : '-'}</TableCell>
                      <TableCell className="text-gray-600">{sb.employee_name || 'Sistem'}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openBahanModal(sb)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm('Hapus mutasi stok bahan ini?')) {
                                await deleteStokBahan(sb.id);
                                if (mutate) mutate();
                              }
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {stokBahan.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-8">Belum ada log mutasi stok bahan.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>

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
                <TableHead>Kegiatan &amp; Jenis</TableHead>
                <TableHead>Bahan Baku (kg)</TableHead>
                <TableHead>Bahan Jadi (kg)</TableHead>
                <TableHead>Rendemen</TableHead>
                <TableHead>Total Hasil (pcs)</TableHead>
                <TableHead className="text-right">HPP Batch</TableHead>
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
                    <TableCell className="capitalize">
                      <div className="font-semibold">{p.kegiatan}</div>
                      {p.jenis_produksi && <div className="text-[11px] text-gray-500">{p.jenis_produksi}</div>}
                    </TableCell>
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
                    <TableCell className="text-right font-mono text-xs">
                      {p.hpp_batch ? `Rp ${Number(p.hpp_batch).toLocaleString('id-ID')}` : '-'}
                    </TableCell>
                    <TableCell className="text-gray-600">{p.employee_name || 'Sistem'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="Edit baris kegiatan produksi"
                          onClick={() => {
                            setEditingProduksi(p);
                            setIsModalOpen(true);
                          }}
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
                  <TableCell colSpan={9} className="text-center text-gray-500 py-8">Belum ada data produksi.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </>
      )}

      {/* ── MODAL: STOK BAHAN CRUD ── */}
      {isBahanModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[75] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingBahan ? 'Edit Mutasi Stok Bahan' : 'Input Stok Bahan (Kemasan/Bumbu/Kardus)'}
            </h3>
            <form onSubmit={handleSaveBahan} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tanggal *</label>
                <input
                  type="date"
                  required
                  value={bahanForm.tanggal}
                  onChange={e => setBahanForm({ ...bahanForm, tanggal: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Kategori *</label>
                <select
                  value={bahanForm.kategori}
                  onChange={e => setBahanForm({ ...bahanForm, kategori: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm bg-white font-semibold"
                >
                  <option value="KEMASAN">KEMASAN</option>
                  <option value="BUMBU">BUMBU</option>
                  <option value="KARDUS">KARDUS</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Jenis / Ukuran *</label>
                <input
                  type="text"
                  required
                  placeholder="Cth: Standing Pouch 60gr / Bumbu Balado / Kardus Besar"
                  value={bahanForm.jenis_ukuran}
                  onChange={e => setBahanForm({ ...bahanForm, jenis_ukuran: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-emerald-700 block mb-1">Masuk (+)</label>
                  <input
                    type="number"
                    min="0"
                    value={bahanForm.masuk}
                    onChange={e => setBahanForm({ ...bahanForm, masuk: e.target.value })}
                    className="w-full p-2 border rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-rose-700 block mb-1">Keluar (-)</label>
                  <input
                    type="number"
                    min="0"
                    value={bahanForm.keluar}
                    onChange={e => setBahanForm({ ...bahanForm, keluar: e.target.value })}
                    className="w-full p-2 border rounded-lg text-sm font-bold"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsBahanModalOpen(false)} className="px-4 py-2 text-sm border rounded-lg">Batal</button>
                <button type="submit" disabled={savingBahan} className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer">
                  {savingBahan ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: TAMBAH / EDIT KEGIATAN PRODUKSI ── */}
      {isModalOpen && (
        <TambahKegiatanModal
          editingItem={editingProduksi}
          onClose={() => { setIsModalOpen(false); setEditingProduksi(null); }}
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
  editingItem = null,
  onClose, 
  onSaved,
  products = [],
  warehouses = []
}: { 
  editingItem?: Produksi | null;
  onClose: () => void; 
  onSaved: () => void;
  products?: any[];
  warehouses?: any[];
}) {
  const [date, setDate] = useState(
    editingItem ? new Date(editingItem.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [kegiatan, setKegiatan] = useState<string>(
    editingItem
      ? /kemas|pengemasan|packing/i.test(editingItem.kegiatan)
        ? 'Pengemasan'
        : 'Pembersihan'
      : 'Pembersihan'
  );
  const [jenisProduksi, setJenisProduksi] = useState<string>(editingItem?.jenis_produksi || '');
  const [bahanBaku, setBahanBaku] = useState<string>(editingItem?.bahan_baku != null ? String(editingItem.bahan_baku) : '');
  const [bahanJadi, setBahanJadi] = useState<string>(editingItem?.bahan_jadi != null ? String(editingItem.bahan_jadi) : '');
  const [hppBatch, setHppBatch] = useState<string>(editingItem?.hpp_batch != null ? String(editingItem.hpp_batch) : '');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(warehouses[0]?.id || '');
  const [totalHasilPcs, setTotalHasilPcs] = useState<string>(editingItem?.total_hasil_pcs != null ? String(editingItem.total_hasil_pcs) : '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (products.length > 0 && !selectedProductId) setSelectedProductId(products[0].id);
    if (warehouses.length > 0 && !selectedWarehouseId) setSelectedWarehouseId(warehouses[0].id);
  }, [products, warehouses, selectedProductId, selectedWarehouseId]);

  const isPengemasan = /kemas|pengemasan|packing/i.test(kegiatan);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem && isPengemasan) {
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
      if (editingItem) {
        await updateProduksiKegiatan(editingItem.id, {
          date,
          kegiatan,
          jenis_produksi: jenisProduksi || null,
          bahan_baku: bahanBaku ? parseFloat(bahanBaku) : null,
          bahan_jadi: bahanJadi ? parseFloat(bahanJadi) : null,
          total_hasil_pcs: totalHasilPcs ? parseInt(totalHasilPcs, 10) : null,
          hpp_batch: hppBatch ? parseFloat(hppBatch) : null,
        });
      } else {
        await createProduksiKegiatan({
          date,
          kegiatan,
          jenis_produksi: jenisProduksi || (isPengemasan ? (selectedProduct?.name || selectedProduct?.short_name) : undefined),
          bahan_baku: bahanBaku ? parseFloat(bahanBaku) : null,
          bahan_jadi: bahanJadi ? parseFloat(bahanJadi) : null,
          total_hasil_pcs: isPengemasan && totalHasilPcs ? parseInt(totalHasilPcs, 10) : (totalHasilPcs ? parseInt(totalHasilPcs, 10) : null),
          hpp_batch: hppBatch ? parseFloat(hppBatch) : null,
          product_id: isPengemasan ? selectedProductId : undefined,
          warehouse_id: isPengemasan ? (selectedWarehouseId || warehouses[0]?.id) : undefined,
        });
      }
      alert(`✅ Kegiatan "${kegiatan}" berhasil ${editingItem ? 'diperbarui' : 'dicatat'}!`);
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
              <span>🏭</span> {editingItem ? 'Edit Laporan Produksi' : 'Tambah Laporan Produksi'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Pencatatan tahapan produksi &amp; pengemasan</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
                onChange={e => setKegiatan(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-semibold text-gray-800"
              >
                <option value="Pembersihan">Pembersihan</option>
                <option value="Pengemasan">Pengemasan (Masuk Stok)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Jenis Produksi / Batch</label>
              <input
                type="text"
                placeholder="Cth: basah / kering / rasa"
                value={jenisProduksi}
                onChange={e => setJenisProduksi(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">HPP Batch (Rp, Opsional)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={hppBatch}
                onChange={e => setHppBatch(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </div>
          </div>

          {/* MODE NON-PENGEMASAN ATAU EDIT */}
          {(!isPengemasan || editingItem) && (
            <div className="space-y-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Bahan Baku (Kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={bahanBaku}
                    onChange={e => setBahanBaku(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Bahan Jadi (Kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={bahanJadi}
                    onChange={e => setBahanJadi(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Hasil (Pcs)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={totalHasilPcs}
                    onChange={e => setTotalHasilPcs(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* MODE PENGEMASAN BARU (MASUK KE STOK PRODUK & GUDANG) */}
          {isPengemasan && !editingItem && (
            <div className="space-y-3 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
              <div className="text-xs text-emerald-900 font-medium leading-relaxed">
                <span className="font-bold">📦 Masuk ke Stok:</span> Hasil pengemasan otomatis menambah stok produk &amp; gudang yang dipilih.
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
