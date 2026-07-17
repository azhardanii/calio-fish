'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface Produksi {
  id: string;
  date: Date;
  kegiatan: string;
  bahan_baku: number | null;
  bahan_jadi: number | null;
  total_hasil_pcs: number | null;
  employee_name?: string;
}

export function ProduksiClient({ initialData, targetPcs = 200, targetKg = 50 }: { initialData: Produksi[], targetPcs?: number, targetKg?: number }) {
  const [filterKegiatan, setFilterKegiatan] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<string>('this_month');
  const [customMonth, setCustomMonth] = useState((new Date().getMonth() + 1).toString());
  const [customYear, setCustomYear] = useState(new Date().getFullYear().toString());

  const filteredData = useMemo(() => {
    let data = [...initialData];

    if (filterKegiatan !== 'all') {
      data = data.filter((p) => p.kegiatan.toLowerCase() === filterKegiatan.toLowerCase());
    }

    if (filterDateRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      data = data.filter((p) => {
        const itemDate = new Date(p.date);
        itemDate.setHours(0, 0, 0, 0);
        const y = itemDate.getFullYear();
        const m = itemDate.getMonth();

        if (filterDateRange === 'today') {
          return itemDate.getTime() === today.getTime();
        } else if (filterDateRange === 'this_week') {
          const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
          return itemDate >= firstDay;
        } else if (filterDateRange === 'this_month') {
          return m === new Date().getMonth() && y === new Date().getFullYear();
        } else if (filterDateRange === 'last_month') {
          let lastMonth = new Date().getMonth() - 1;
          let expectedYear = new Date().getFullYear();
          if (lastMonth < 0) {
            lastMonth = 11;
            expectedYear -= 1;
          }
          return m === lastMonth && y === expectedYear;
        } else if (filterDateRange === 'this_year') {
          return y === new Date().getFullYear();
        } else if (filterDateRange === 'last_year') {
          return y === (new Date().getFullYear() - 1);
        } else if (filterDateRange === 'custom') {
          return m === (parseInt(customMonth) - 1) && y === parseInt(customYear);
        }
        return true;
      });
    }
    return data;
  }, [initialData, filterKegiatan, filterDateRange]);

  // Calculations for Top Cards (Today)
  const todayStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayData = initialData.filter((p) => {
      const d = new Date(p.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });

    let totalPcs = 0;
    let totalKg = 0;
    let sumBaku = 0;
    let sumJadi = 0;

    todayData.forEach(p => {
      if (p.total_hasil_pcs) totalPcs += p.total_hasil_pcs;
      if (p.bahan_jadi && p.kegiatan.toLowerCase() !== 'mengemas') {
        totalKg += p.bahan_jadi;
      }
      if (p.bahan_baku && p.bahan_jadi) {
        sumBaku += p.bahan_baku;
        sumJadi += p.bahan_jadi;
      }
    });

    const rendemen = sumBaku > 0 ? (sumJadi / sumBaku) * 100 : 0;
    
    return {
      totalPcs,
      totalKg,
      rendemen: rendemen.toFixed(1)
    };
  }, [initialData]);

  // Data for Charts (Last 7 Days)
  const chartData = useMemo(() => {
    const dataMap: Record<string, { dateStr: string; pcs: number; rendemen: number; sumBaku: number; sumJadi: number }> = {};
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      dataMap[d.toDateString()] = { dateStr, pcs: 0, rendemen: 0, sumBaku: 0, sumJadi: 0 };
    }

    initialData.forEach(p => {
      const d = new Date(p.date);
      const key = d.toDateString();
      if (dataMap[key]) {
        if (p.total_hasil_pcs) dataMap[key].pcs += p.total_hasil_pcs;
        if (p.bahan_baku && p.bahan_jadi) {
          dataMap[key].sumBaku += p.bahan_baku;
          dataMap[key].sumJadi += p.bahan_jadi;
        }
      }
    });

    return Object.values(dataMap).map(item => ({
      date: item.dateStr,
      pcs: item.pcs,
      rendemen: item.sumBaku > 0 ? Number(((item.sumJadi / item.sumBaku) * 100).toFixed(1)) : 0
    }));
  }, [initialData]);

  const defaultKegiatan = ['Pembersihan', 'Menggoreng', 'Menjemur', 'Menimbang', 'Mengemas'];
  const uniqueKegiatan = Array.from(new Set([...defaultKegiatan, ...initialData.map(p => p.kegiatan)]));

  const filterLabel = useMemo(() => {
    switch (filterDateRange) {
      case 'today': return 'Hari Ini';
      case 'this_week': return 'Minggu Ini';
      case 'this_month': return 'Bulan Ini';
      case 'last_month': return 'Bulan Lalu';
      case 'this_year': return 'Tahun Ini';
      case 'last_year': return 'Tahun Lalu';
      case 'custom': return `${new Date(0, parseInt(customMonth) - 1).toLocaleString('id-ID', { month: 'long' })} ${customYear}`;
      default: return 'Semua Waktu';
    }
  }, [filterDateRange, customMonth, customYear]);

  return (
    <div className="space-y-6">
      {/* ── FILTER TOOLBAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 m-0">Produksi</h2>
          <div className="text-sm text-gray-500 mt-1">
            Menampilkan data untuk: <b className="text-blue-600">{filterLabel}</b>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full filter-container" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          <style>{`.filter-container::-webkit-scrollbar { display: none; }`}</style>
          
          <select 
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white shrink-0 outline-none focus:border-blue-500 cursor-pointer"
            value={filterKegiatan}
            onChange={(e) => setFilterKegiatan(e.target.value)}
          >
            <option value="all">Semua Kegiatan</option>
            {uniqueKegiatan.map(k => (
               <option key={k} value={k}>{k}</option>
            ))}
          </select>

          <button
            onClick={() => setFilterDateRange('this_month')}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${filterDateRange === 'this_month' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Bulan Ini
          </button>
          
          <button
            onClick={() => setFilterDateRange('last_month')}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${filterDateRange === 'last_month' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Bulan Lalu
          </button>
          
          <button
            onClick={() => setFilterDateRange('this_year')}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${filterDateRange === 'this_year' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Tahun Ini
          </button>
          
          <button
            onClick={() => setFilterDateRange('last_year')}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${filterDateRange === 'last_year' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Tahun Lalu
          </button>

          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-gray-300 shrink-0 shadow-sm">
            <select
              value={customMonth}
              onChange={e => setCustomMonth(e.target.value)}
              className="bg-transparent border-none text-sm outline-none cursor-pointer py-1 font-medium text-gray-700"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('id-ID', { month: 'short' })}</option>
              ))}
            </select>
            <select
              value={customYear}
              onChange={e => setCustomYear(e.target.value)}
              className="bg-transparent border-none text-sm outline-none cursor-pointer py-1 font-medium text-gray-700"
            >
              {[2024, 2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={() => setFilterDateRange('custom')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold border-none cursor-pointer transition-colors ${filterDateRange === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Go
            </button>
          </div>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white shadow-sm border-blue-100">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-blue-600 mb-2">Pencapaian (Pcs) Hari Ini</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gray-900">{todayStats.totalPcs}</span>
              <span className="text-sm text-gray-500 mb-1">/ {targetPcs} pcs</span>
            </div>
            <div className="mt-4 h-2 w-full bg-blue-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${todayStats.totalPcs >= targetPcs ? 'bg-green-500' : 'bg-blue-500'}`} 
                style={{ width: `${Math.min((todayStats.totalPcs / targetPcs) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {((todayStats.totalPcs / targetPcs) * 100).toFixed(1)}% tercapai
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-white shadow-sm border-indigo-100">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-indigo-600 mb-2">Barang Setengah Jadi (Kg) Hari Ini</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gray-900">{todayStats.totalKg.toFixed(1)}</span>
              <span className="text-sm text-gray-500 mb-1">/ {targetKg} kg</span>
            </div>
            <div className="mt-4 h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${todayStats.totalKg >= targetKg ? 'bg-green-500' : 'bg-indigo-500'}`} 
                style={{ width: `${Math.min((todayStats.totalKg / targetKg) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {((todayStats.totalKg / targetKg) * 100).toFixed(1)}% tercapai
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white shadow-sm border-emerald-100">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-emerald-600 mb-2">Rata-Rata Rendemen Hari Ini</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gray-900">{todayStats.rendemen}%</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <span className={`text-xs font-semibold px-2 py-1 rounded-full ${Number(todayStats.rendemen) >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                 {Number(todayStats.rendemen) >= 80 ? 'Efisien' : (Number(todayStats.rendemen) === 0 ? 'Belum Ada Data' : 'Perlu Perhatian')}
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
            <CardTitle className="text-sm text-gray-600">Output Produksi (Pcs) - 7 Hari Terakhir</CardTitle>
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
            <CardTitle className="text-sm text-gray-600">Tren Rendemen (%) - 7 Hari Terakhir</CardTitle>
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
                  </TableRow>
                );
              })}
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">Belum ada data produksi.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
