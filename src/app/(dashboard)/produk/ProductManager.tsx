'use client';

import React, { useState, useMemo } from 'react';
import { createProduct, updateProduct, deleteProduct, getProductHistory, adjustStockOpname } from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function ProductManager({ products, transactions }: { products: any[], transactions?: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [originalStok, setOriginalStok] = useState(0);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);

  const [logFilter, setLogFilter] = useState('this_month');
  const [customMonth, setCustomMonth] = useState((new Date().getMonth() + 1).toString());
  const [customYear, setCustomYear] = useState(new Date().getFullYear().toString());

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    return transactions.filter((t: any) => {
      if (logFilter === 'lifetime') return true;
      
      const date = new Date(t.created_at);
      const now = new Date();
      
      if (logFilter === 'this_month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      if (logFilter === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
      }
      if (logFilter === 'this_year') {
        return date.getFullYear() === now.getFullYear();
      }
      if (logFilter === 'last_year') {
        return date.getFullYear() === now.getFullYear() - 1;
      }
      if (logFilter === 'custom') {
        return date.getMonth() === parseInt(customMonth) - 1 && date.getFullYear() === parseInt(customYear);
      }
      return true;
    });
  }, [transactions, logFilter, customMonth, customYear]);

  const openModal = (product?: any) => {
    if (product) {
      setFormData(product);
      setOriginalStok(product.stok);
      setIsEditing(true);
    } else {
      setFormData({ is_active: true, unit: 'pcs', stok: 0 });
      setOriginalStok(0);
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
  };

  const openHistory = async (id: string) => {
    const data = await getProductHistory(id);
    setHistoryData(data);
    setHistoryModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      await updateProduct(formData.id, formData);
      if (formData.stok !== originalStok) {
        await adjustStockOpname(formData.id, formData.stok, 'Penyesuaian Opname via Dashboard');
      }
    } else {
      await createProduct(formData);
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus produk ini? Riwayat stok produk ini juga akan terhapus.')) {
      await deleteProduct(id);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Katalog Produk ({products.length})</h2>
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition-colors">
          + Tambah Produk
        </button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nama Produk</TableHead>
              <TableHead>Singkatan</TableHead>
              <TableHead className="text-right">Harga Dasar</TableHead>
              <TableHead className="text-center">Stok Fisik</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((r) => (
              <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                <TableCell className="font-mono text-gray-500">{r.sku}</TableCell>
                <TableCell className="font-bold">{r.name}</TableCell>
                <TableCell>{r.short_name}</TableCell>
                <TableCell className="text-right">Rp {Number(r.base_price).toLocaleString('id-ID')}</TableCell>
                <TableCell className="text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${r.stok <= 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {r.stok} {r.unit}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${r.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                    {r.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-3">
                  <button onClick={() => openHistory(r.id)} className="text-purple-600 hover:text-purple-800 font-medium">Riwayat</button>
                  <button onClick={() => openModal(r)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                  <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:text-red-800 font-medium">Hapus</button>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">Belum ada data produk.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Global Stock Log */}
      {transactions && transactions.length > 0 && (
        <div className="mt-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h2 className="text-xl font-bold">Riwayat Mutasi Stok Keseluruhan</h2>
            
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={logFilter}
                onChange={e => setLogFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="this_month">Bulan Ini</option>
                <option value="last_month">Bulan Lalu</option>
                <option value="this_year">Tahun Ini</option>
                <option value="last_year">Tahun Lalu</option>
                <option value="lifetime">Lifetime</option>
                <option value="custom">Custom</option>
              </select>
              
              {logFilter === 'custom' && (
                <div className="flex items-center gap-2">
                  <select 
                    value={customMonth} 
                    onChange={e => setCustomMonth(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'short' })}</option>
                    ))}
                  </select>
                  <select 
                    value={customYear} 
                    onChange={e => setCustomYear(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-center">In/Out</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((h: any) => (
                  <TableRow key={h.id} className="hover:bg-gray-50">
                    <TableCell className="text-gray-600">{new Date(h.created_at).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="font-bold text-gray-800">{h.productName} <span className="text-xs text-gray-500 font-normal">({h.productSku})</span></TableCell>
                    <TableCell className="font-semibold text-gray-700">{h.type}</TableCell>
                    <TableCell className="text-gray-600">{h.description}</TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${h.flow === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {h.flow}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-gray-700">
                      {h.flow === 'IN' ? '+' : '-'}{h.qty}
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-900">{h.balance}</TableCell>
                  </TableRow>
                ))}
                {filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">Belum ada riwayat mutasi stok untuk periode ini.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditing ? 'Edit Produk & Penyesuaian Stok' : 'Tambah Produk Baru'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">SKU (Kunci Pencocokan WA)</label>
                  <input required type="text" className="w-full border rounded p-2" placeholder="Cth: fs_original" value={formData.sku || ''} onChange={e => setFormData({...formData, sku: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Kategori</label>
                  <input required type="text" className="w-full border rounded p-2" placeholder="Cth: Snack" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nama Lengkap Produk</label>
                <input required type="text" className="w-full border rounded p-2" placeholder="Cth: Fish Skin Original" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Singkatan / Nickname</label>
                  <input required type="text" className="w-full border rounded p-2" placeholder="Cth: FS Ori" value={formData.short_name || ''} onChange={e => setFormData({...formData, short_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Satuan</label>
                  <input required type="text" className="w-full border rounded p-2" placeholder="Cth: pcs" value={formData.unit || ''} onChange={e => setFormData({...formData, unit: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Harga Dasar (Rp)</label>
                  <input required type="number" className="w-full border rounded p-2" value={formData.base_price || ''} onChange={e => setFormData({...formData, base_price: e.target.value ? Number(e.target.value) : ''})} />
                </div>
                <div className="bg-blue-50 p-2 rounded border border-blue-100">
                  <label className="block text-sm font-bold text-blue-900 mb-1">Stok Fisik Aktual</label>
                  <input required type="number" className="w-full border-blue-200 rounded p-2 font-bold" value={formData.stok === undefined ? '' : formData.stok} onChange={e => setFormData({...formData, stok: e.target.value ? Number(e.target.value) : 0})} />
                  {isEditing && <p className="text-xs text-blue-600 mt-1">Mengubah angka ini akan otomatis mencatat log "Penyesuaian Opname" di riwayat.</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="is_active" className="text-sm font-medium cursor-pointer">Status Aktif (Tampil di katalog)</label>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded hover:bg-gray-50">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Simpan Produk</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Riwayat & Mutasi Stok (Ledger)</h3>
              <button onClick={() => setHistoryModalOpen(false)} className="text-gray-500 hover:text-gray-800 text-xl font-bold">&times;</button>
            </div>
            
            <div className="overflow-y-auto flex-1">
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0">
                  <TableRow>
                    <TableHead>Waktu Transaksi</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead className="text-center">In/Out</TableHead>
                    <TableHead className="text-right">Perubahan</TableHead>
                    <TableHead className="text-right">Saldo Akhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.map((h: any) => (
                    <TableRow key={h.id} className="hover:bg-gray-50">
                      <TableCell className="text-gray-600">{new Date(h.created_at).toLocaleString('id-ID')}</TableCell>
                      <TableCell className="font-semibold text-gray-800">{h.type}</TableCell>
                      <TableCell className="text-gray-600">{h.description}</TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${h.flow === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {h.flow}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-gray-700">
                        {h.flow === 'IN' ? '+' : '-'}{h.qty}
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-900">{h.balance}</TableCell>
                    </TableRow>
                  ))}
                  {historyData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">Belum ada pergerakan stok.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
