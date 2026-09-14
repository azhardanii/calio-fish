'use client';

import React, { useState, useMemo } from 'react';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit2, Trash2, X, Download } from 'lucide-react';

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  description: string;
  employee?: { nama: string };
}

export function PengeluaranClient({ initialData, exportButton }: { initialData: Expense[], exportButton?: React.ReactNode }) {
  const [data, setData] = useState<Expense[]>(initialData);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    }
  });
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>(dateRange);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    category: 'OPERASIONAL',
    description: ''
  });

  const filteredData = useMemo(() => {
    let result = [...data];
    if (appliedDateRange?.from) {
      result = result.filter((p) => {
        const itemDate = new Date(p.date);
        itemDate.setHours(0, 0, 0, 0);
        
        const from = new Date(appliedDateRange.from!);
        from.setHours(0, 0, 0, 0);
        
        const to = appliedDateRange.to ? new Date(appliedDateRange.to) : new Date(from);
        to.setHours(23, 59, 59, 999);

        return itemDate >= from && itemDate <= to;
      });
    }
    return result;
  }, [data, appliedDateRange]);

  const totalAmount = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + Number(item.amount), 0);
  }, [filteredData]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach(item => {
      map.set(item.category, (map.get(item.category) || 0) + Number(item.amount));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredData]);

  const handleApplyFilter = () => {
    setAppliedDateRange(dateRange);
    // Ideally we should refetch from API here if it was server paginated, but since we fetched current month by default it works for simple cases.
  };

  const handleOpenModal = (item?: Expense) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        amount: item.amount.toString(),
        date: new Date(item.date).toISOString().slice(0, 10),
        category: item.category,
        description: item.description || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        title: '',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        category: 'OPERASIONAL',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = '/api/pengeluaran';
      const method = editingItem ? 'PUT' : 'POST';
      const body = {
        ...formData,
        id: editingItem?.id,
        amount: Number(formData.amount)
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) throw new Error('Gagal menyimpan pengeluaran');
      
      const savedData = await res.json();
      
      if (editingItem) {
        setData(data.map(item => item.id === savedData.id ? { ...savedData, employee: item.employee } : item));
      } else {
        setData([savedData, ...data]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menyimpan data');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pengeluaran ini?')) return;
    try {
      const res = await fetch(`/api/pengeluaran?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus pengeluaran');
      setData(data.filter(item => item.id !== id));
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menghapus data');
    }
  };

  const formatRp = (val: number) => {
    return 'Rp ' + Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const exportToCsv = () => {
    const headers = ['Tanggal', 'Kategori', 'Judul', 'Jumlah', 'Deskripsi', 'PIC'];
    const csvData = filteredData.map(row => [
      new Date(row.date).toLocaleDateString('id-ID'),
      row.category,
      `"${row.title.replace(/"/g, '""')}"`,
      row.amount,
      `"${(row.description || '').replace(/"/g, '""')}"`,
      row.employee?.nama || 'Sistem'
    ]);
    const csvContent = [headers.join(','), ...csvData.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pengeluaran_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pengeluaran Operasional</h2>
          <p className="text-sm text-gray-500">Catat dan pantau arus kas keluar perusahaan</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker date={dateRange} setDate={setDateRange} />
          <button onClick={handleApplyFilter} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm">
            Filter
          </button>
          
          <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-1.5">
            <Plus size={16} /> Tambah
          </button>

          <button onClick={exportToCsv} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-1.5">
            <Download size={16} /> CSV/Excel
          </button>
          
          {exportButton && <div>{exportButton}</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-rose-50 border-rose-100 shadow-sm md:col-span-1">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-rose-700 uppercase mb-2">Total Pengeluaran</h3>
            <div className="text-3xl font-black text-rose-900">{formatRp(totalAmount)}</div>
            <div className="text-xs text-rose-600 mt-2">Berdasarkan filter tanggal aktif</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm md:col-span-2">
          <CardContent className="p-4 sm:p-6 flex items-center h-full gap-4 overflow-x-auto whitespace-nowrap">
            {categories.slice(0, 4).map(([cat, val], idx) => (
              <div key={idx} className="flex-1 min-w-[150px] p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-xs font-bold text-gray-500 mb-1">{cat}</div>
                <div className="text-lg font-bold text-gray-900">{formatRp(val)}</div>
              </div>
            ))}
            {categories.length === 0 && <div className="text-sm text-gray-400 italic">Belum ada pengeluaran</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Riwayat Transaksi Pengeluaran</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="py-4 px-4 whitespace-nowrap">Tanggal</TableHead>
                  <TableHead className="py-4 px-4">Kategori</TableHead>
                  <TableHead className="py-4 px-4 min-w-[200px]">Judul Pengeluaran</TableHead>
                  <TableHead className="py-4 px-4 text-right">Jumlah</TableHead>
                  <TableHead className="py-4 px-4">PIC / Oleh</TableHead>
                  <TableHead className="py-4 px-4 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map(item => (
                  <TableRow key={item.id} className="hover:bg-gray-50/50">
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold uppercase">
                        {item.category}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="font-bold text-gray-900">{item.title}</div>
                      {item.description && <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{item.description}</div>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-bold text-rose-600 whitespace-nowrap">
                      {formatRp(item.amount)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600">
                      {item.employee?.nama || 'Sistem'}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleOpenModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                      Tidak ada data pengeluaran pada rentang tanggal ini.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">
                {editingItem ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Tanggal</label>
                    <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Kategori</label>
                    <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                      <option value="OPERASIONAL">Operasional</option>
                      <option value="PRODUKSI">Produksi</option>
                      <option value="GAJI">Gaji / Bonus</option>
                      <option value="MARKETING">Marketing / Ads</option>
                      <option value="LOGISTIK">Logistik / Ongkir</option>
                      <option value="LAINNYA">Lainnya</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Judul / Nama Pengeluaran</label>
                  <input type="text" required placeholder="Contoh: Beli Lakban & Plastik" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Jumlah (Rp)</label>
                  <input type="number" required placeholder="150000" min="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-gray-900" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Catatan Tambahan (Opsional)</label>
                  <textarea rows={3} placeholder="Tambahkan rincian jika perlu..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
                </div>
              </form>
            </div>
            
            <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-xl transition-colors">
                Batal
              </button>
              <button type="submit" form="expense-form" className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm shadow-blue-600/20">
                Simpan Pengeluaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
