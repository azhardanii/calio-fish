'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Produksi {
  id: string;
  date: Date;
  kegiatan: string;
  bahan_baku: number | null;
  bahan_jadi: number | null;
  total_hasil_pcs: number | null;
  employee_name?: string;
}

export function ProduksiClient({ initialData }: { initialData: Produksi[] }) {
  const [filterKegiatan, setFilterKegiatan] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<string>('all');

  const filteredData = useMemo(() => {
    let data = [...initialData];

    // Filter Kategori
    if (filterKegiatan !== 'all') {
      data = data.filter((p) => p.kegiatan.toLowerCase() === filterKegiatan.toLowerCase());
    }

    // Filter Range Tanggal
    if (filterDateRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      data = data.filter((p) => {
        const itemDate = new Date(p.date);
        itemDate.setHours(0, 0, 0, 0);

        if (filterDateRange === 'today') {
          return itemDate.getTime() === today.getTime();
        } else if (filterDateRange === 'this_week') {
          const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
          return itemDate >= firstDay;
        } else if (filterDateRange === 'this_month') {
          return itemDate.getMonth() === new Date().getMonth() && itemDate.getFullYear() === new Date().getFullYear();
        } else if (filterDateRange === 'this_year') {
          return itemDate.getFullYear() === new Date().getFullYear();
        }
        return true;
      });
    }

    return data;
  }, [initialData, filterKegiatan, filterDateRange]);

  const defaultKegiatan = ['Pembersihan', 'Menggoreng', 'Menjemur', 'Menimbang', 'Mengemas'];
  const uniqueKegiatan = Array.from(new Set([...defaultKegiatan, ...initialData.map(p => p.kegiatan)]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <select 
          className="border border-gray-300 rounded-md p-2 text-sm"
          value={filterKegiatan}
          onChange={(e) => setFilterKegiatan(e.target.value)}
        >
          <option value="all">Semua Kegiatan</option>
          {uniqueKegiatan.map(k => (
             <option key={k} value={k}>{k}</option>
          ))}
        </select>

        <select 
          className="border border-gray-300 rounded-md p-2 text-sm"
          value={filterDateRange}
          onChange={(e) => setFilterDateRange(e.target.value)}
        >
          <option value="all">Semua Waktu</option>
          <option value="today">Hari Ini</option>
          <option value="this_week">Minggu Ini</option>
          <option value="this_month">Bulan Ini</option>
          <option value="this_year">Tahun Ini</option>
        </select>
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
                <TableHead>Total Hasil (pcs)</TableHead>
                <TableHead>Diinput Oleh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((p) => (
                <TableRow key={p.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="font-medium">{new Date(p.date).toLocaleDateString('id-ID')}</TableCell>
                  <TableCell className="capitalize">{p.kegiatan}</TableCell>
                  <TableCell>{p.bahan_baku ? `${Number(p.bahan_baku)} kg` : '-'}</TableCell>
                  <TableCell>{p.bahan_jadi ? `${Number(p.bahan_jadi)} kg` : '-'}</TableCell>
                  <TableCell className="font-bold">{p.total_hasil_pcs ? `${p.total_hasil_pcs} pcs` : '-'}</TableCell>
                  <TableCell className="text-gray-600">{p.employee_name || 'Sistem'}</TableCell>
                </TableRow>
              ))}
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">Belum ada data produksi.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
