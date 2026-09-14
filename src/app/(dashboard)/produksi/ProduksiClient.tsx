'use client';

import React, { useState, useMemo } from 'react';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Download, Edit2 } from 'lucide-react';

interface Produksi {
  id: string;
  date: Date;
  kegiatan: string;
  bahan_baku: number | null;
  bahan_jadi: number | null;
  total_hasil_pcs: number | null;
  employee_name?: string;
}

export function ProduksiClient({ initialData, targetPcs = 200, targetKg = 50, exportButton }: { initialData: Produksi[], targetPcs?: number, targetKg?: number, exportButton?: React.ReactNode }) {
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

  const defaultKegiatan = ['Pembersihan', 'Menggoreng', 'Menjemur', 'Menimbang', 'Mengemas'];
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
                      <button
                        title="Edit via pesan WA atau sistem input"
                        onClick={() => alert(`Untuk edit data produksi ${new Date(p.date).toLocaleDateString('id-ID')}, silakan gunakan format WA atau input manual melalui sistem.`)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
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
    </div>
  );
}
