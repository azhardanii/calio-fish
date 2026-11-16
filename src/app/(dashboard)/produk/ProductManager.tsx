'use client';

import React, { useState, useMemo } from 'react';
import { mutate } from 'swr';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductHistory,
  adjustStockOpname,
  createProductType,
  updateProductType,
  deleteProductType,
} from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function ProductManager({
  products,
  productTypes = [],
  transactions,
}: {
  products: any[];
  productTypes?: any[];
  transactions?: any[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [originalStok, setOriginalStok] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeSection, setActiveSection] = useState<'products' | 'categories'>('products');

  // Category CRUD modal state (kode dibuat otomatis dari nama di server)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState<{
    id?: string;
    name: string;
    base_price: string;
    is_active: boolean;
  }>({ name: '', base_price: '', is_active: true });
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);

  const [logFilter, setLogFilter] = useState('this_month');
  const [customMonth, setCustomMonth] = useState((new Date().getMonth() + 1).toString());
  const [customYear, setCustomYear] = useState(new Date().getFullYear().toString());

  const activeCategories = useMemo(
    () => productTypes.filter((pt: any) => pt.is_active !== false),
    [productTypes]
  );

  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') return products;
    if (categoryFilter === 'none') return products.filter((p) => !p.product_type_id);
    return products.filter((p) => p.product_type_id === categoryFilter);
  }, [products, categoryFilter]);

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
      setFormData({
        ...product,
        product_type_id: product.product_type_id || '',
      });
      setOriginalStok(product.stok);
      setIsEditing(true);
    } else {
      const defaultType = activeCategories[0];
      setFormData({
        is_active: true,
        unit: 'pcs',
        stok: 0,
        product_type_id: defaultType?.id || '',
        category: defaultType?.name || '',
        base_price: defaultType ? Number(defaultType.base_price) : '',
      });
      setOriginalStok(0);
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
  };

  const openCategoryModal = (cat?: any) => {
    if (cat) {
      setIsEditingCategory(true);
      setCategoryForm({
        id: cat.id,
        name: cat.name,
        base_price: String(Number(cat.base_price || 0)),
        is_active: cat.is_active !== false,
      });
    } else {
      setIsEditingCategory(false);
      setCategoryForm({ name: '', base_price: '', is_active: true });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      alert('Nama kategori wajib diisi (contoh: 20g, 60g, 90g).');
      return;
    }
    setIsSavingCategory(true);
    try {
      let saved: any;
      if (isEditingCategory && categoryForm.id) {
        saved = await updateProductType(categoryForm.id, {
          name: categoryForm.name.trim(),
          base_price: Number(categoryForm.base_price) || 0,
          is_active: categoryForm.is_active,
        });
        if (isModalOpen && saved?.id && formData.product_type_id === saved.id) {
          setFormData((prev: any) => ({
            ...prev,
            category: saved.name,
          }));
        }
      } else {
        saved = await createProductType({
          name: categoryForm.name.trim(),
          base_price: Number(categoryForm.base_price) || 0,
          is_active: categoryForm.is_active,
        });
        if (isModalOpen && saved?.id) {
          setFormData((prev: any) => ({
            ...prev,
            product_type_id: saved.id,
            category: saved.name,
            base_price: prev.base_price || Number(saved.base_price || 0),
          }));
        }
      }
      await mutate('/api/data/products');
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan kategori');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat: any) => {
    if (!confirm(`Yakin ingin menghapus kategori "${cat.name}"?`)) return;
    try {
      await deleteProductType(cat.id);
      if (categoryFilter === cat.id) setCategoryFilter('all');
      if (formData.product_type_id === cat.id) {
        setFormData((prev: any) => ({ ...prev, product_type_id: '', category: '' }));
      }
      await mutate('/api/data/products');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kategori');
    }
  };

  const openHistory = async (id: string) => {
    const data = await getProductHistory(id);
    setHistoryData(data);
    setHistoryModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_type_id) {
      alert('Harap pilih kategori produk.');
      return;
    }
    try {
      if (isEditing) {
        await updateProduct(formData.id, formData);
        if (formData.stok !== originalStok) {
          await adjustStockOpname(formData.id, formData.stok, 'Penyesuaian Opname via Dashboard');
        }
      } else {
        await createProduct(formData);
      }
      mutate('/api/data/products');
      closeModal();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan produk');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus produk ini? Riwayat stok produk ini juga akan terhapus.')) {
      await deleteProduct(id);
      mutate('/api/data/products');
    }
  };

  return (
    <>
      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('products')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              activeSection === 'products'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📦 Katalog Produk ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('categories')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              activeSection === 'categories'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🏷️ Kelola Kategori ({productTypes.length})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeSection === 'products' && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium text-gray-700"
            >
              <option value="all">Semua Kategori ({products.length})</option>
              {productTypes.map((pt: any) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
              <option value="none">Belum Berkategori</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => openCategoryModal()}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer"
          >
            + Tambah Kategori
          </button>
          <button
            type="button"
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors cursor-pointer"
          >
            + Tambah Produk
          </button>
        </div>
      </div>

      {/* Quick Category Management Chip Bar (langsung terlihat di halaman utama) */}
      {activeSection === 'products' && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mr-1">
            Kategori:
          </span>
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Semua ({products.length})
          </button>
          {productTypes.map((pt: any) => {
            const count = products.filter((p) => p.product_type_id === pt.id).length;
            const isSelected = categoryFilter === pt.id;
            return (
              <div
                key={pt.id}
                className={`inline-flex items-center rounded-lg border text-xs overflow-hidden transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-800 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setCategoryFilter(isSelected ? 'all' : pt.id)}
                  className="px-2.5 py-1 font-bold cursor-pointer hover:opacity-90"
                  title={`Filter kategori ${pt.name}`}
                >
                  {pt.name} <span className="opacity-75 font-normal">({count})</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCategoryModal(pt)}
                  title={`Edit kategori ${pt.name}`}
                  className={`px-1.5 py-1 border-l cursor-pointer transition ${
                    isSelected
                      ? 'border-indigo-500 hover:bg-indigo-700 text-white'
                      : 'border-slate-200 text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(pt)}
                  title={`Hapus kategori ${pt.name}`}
                  className={`px-1.5 py-1 border-l cursor-pointer transition ${
                    isSelected
                      ? 'border-indigo-500 hover:bg-rose-600 text-white'
                      : 'border-slate-200 text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  🗑️
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => openCategoryModal()}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-dashed border-indigo-300 cursor-pointer"
          >
            + Kategori Baru
          </button>
        </div>
      )}

      {/* SECTION 1: CATALOG TABLE */}
      {activeSection === 'products' && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nama Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Singkatan</TableHead>
                <TableHead className="text-right">Harga Dasar</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((r) => (
                <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="font-mono text-gray-500">{r.sku}</TableCell>
                  <TableCell className="font-bold">{r.name}</TableCell>
                  <TableCell>
                    {r.product_type ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {r.product_type.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        {r.category || 'Belum diset'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{r.short_name}</TableCell>
                  <TableCell className="text-right">Rp {Number(r.base_price).toLocaleString('id-ID')}</TableCell>
                  <TableCell className="text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${r.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                      {r.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-3">
                    <button onClick={() => openHistory(r.id)} className="text-purple-600 hover:text-purple-800 font-medium cursor-pointer">Riwayat</button>
                    <button onClick={() => openModal(r)} className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer">Edit</button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:text-red-800 font-medium cursor-pointer">Hapus</button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">Belum ada data produk.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* SECTION 2: CATEGORY (ProductType) CRUD TABLE */}
      {activeSection === 'categories' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-900">
            <b>Manajemen Kategori (Jenis Produk):</b> Kategori digunakan pada dropdown produk, laporan stok &amp; valuasi konsinyasi outlet, serta laporan WhatsApp sales di lapangan (mis. <code className="bg-white px-1 rounded">20g</code>, <code className="bg-white px-1 rounded">60g</code>, <code className="bg-white px-1 rounded">90g</code>, <code className="bg-white px-1 rounded">Abon</code>).
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Nama Kategori</TableHead>
                  <TableHead className="text-right">Harga Dasar Default</TableHead>
                  <TableHead className="text-center">Jumlah Varian</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productTypes.map((pt: any) => {
                  const variantCount = products.filter((p) => p.product_type_id === pt.id).length;
                  return (
                    <TableRow key={pt.id} className="hover:bg-gray-50">
                      <TableCell className="font-bold text-gray-900">{pt.name}</TableCell>
                      <TableCell className="text-right font-semibold">
                        Rp {Number(pt.base_price || 0).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          {variantCount} varian
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${pt.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                          {pt.is_active !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openCategoryModal(pt)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(pt)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 cursor-pointer"
                        >
                          Hapus
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {productTypes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      Belum ada kategori produk. Klik &quot;+ Tambah Kategori&quot; untuk membuat.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Global Stock Log */}
      {transactions && transactions.length > 0 && activeSection === 'products' && (
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
                      <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('id-ID', { month: 'short' })}</option>
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
                  <TableHead>Diinput Oleh</TableHead>
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
                    <TableCell className="text-gray-600 capitalize">{h.employee_name}</TableCell>
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

      {/* PRODUCT CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditing ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">SKU (Kunci Pencocokan WA) *</label>
                  <input required type="text" className="w-full border rounded p-2" placeholder="Cth: fs_original" value={formData.sku || ''} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="block text-sm font-medium">Kategori / Jenis Produk *</label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openCategoryModal()}
                        className="font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        + Tambah
                      </button>
                      {formData.product_type_id && (() => {
                        const selectedPt = productTypes.find((t: any) => t.id === formData.product_type_id);
                        if (!selectedPt) return null;
                        return (
                          <>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => openCategoryModal(selectedPt)}
                              className="font-bold text-blue-600 hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(selectedPt)}
                              className="font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              Hapus
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <select
                    required
                    value={formData.product_type_id || ''}
                    onChange={(e) => {
                      const ptId = e.target.value;
                      const pt = productTypes.find((t: any) => t.id === ptId);
                      setFormData({
                        ...formData,
                        product_type_id: ptId,
                        category: pt ? pt.name : formData.category,
                        base_price: !isEditing && pt ? Number(pt.base_price) : formData.base_price,
                      });
                    }}
                    className="w-full border rounded p-2 bg-white font-medium"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {productTypes.map((pt: any) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name} — Rp {Number(pt.base_price || 0).toLocaleString('id-ID')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nama Lengkap Produk *</label>
                <input required type="text" className="w-full border rounded p-2" placeholder="Cth: Fish Skin Original 60g" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Singkatan / Nickname *</label>
                  <input required type="text" className="w-full border rounded p-2" placeholder="Cth: FS Ori 60" value={formData.short_name || ''} onChange={e => setFormData({ ...formData, short_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Satuan *</label>
                  <input required type="text" className="w-full border rounded p-2" placeholder="Cth: pcs" value={formData.unit || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Harga Dasar (Rp) *</label>
                <input required type="number" className="w-full border rounded p-2 text-base font-semibold" placeholder="Contoh: 20000" value={formData.base_price || ''} onChange={e => setFormData({ ...formData, base_price: e.target.value ? Number(e.target.value) : '' })} />
                <p className="text-xs text-gray-500 mt-1">Stok fisik produk dikelola dan dipantau melalui menu Gudang / Warehouse.</p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="is_active" checked={formData.is_active !== false} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="is_active" className="text-sm font-medium cursor-pointer">Status Aktif (Tampil di katalog)</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded hover:bg-gray-50 cursor-pointer">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold cursor-pointer">Simpan Produk</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY (ProductType) CREATE / EDIT MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-1">
              {isEditingCategory ? 'Edit Kategori Produk' : 'Tambah Kategori Produk'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Cukup isi nama kategori (contoh: <b>20g</b>, <b>60g</b>, <b>90g</b>, <b>Abon</b>). Kode kategori dibuat otomatis oleh sistem.
            </p>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Kategori *</label>
                <input
                  required
                  type="text"
                  placeholder="Cth: 20g, 60g, 90g, Abon"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full border rounded p-2 font-semibold"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Harga Dasar Default (Rp, Opsional)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Cth: 20000"
                  value={categoryForm.base_price}
                  onChange={(e) => setCategoryForm({ ...categoryForm, base_price: e.target.value })}
                  className="w-full border rounded p-2 font-bold"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cat_active"
                  checked={categoryForm.is_active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="cat_active" className="text-sm font-medium cursor-pointer">Aktif</label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  disabled={isSavingCategory}
                  className="px-4 py-2 border rounded text-sm hover:bg-gray-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSavingCategory ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Riwayat &amp; Mutasi Stok (Ledger)</h3>
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
                    <TableHead>Diinput Oleh</TableHead>
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
                      <TableCell className="text-gray-600 capitalize">{h.employee_name}</TableCell>
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
