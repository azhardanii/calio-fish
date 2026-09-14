'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  PackageMinus, 
  MapPin, 
  Edit, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Info, 
  Boxes,
  X
} from 'lucide-react';
import Link from 'next/link';
import { createWarehouse, updateWarehouse, deleteWarehouse, createDistributor } from '@/app/actions';

export default function WarehousePage() {
  const { data, isLoading, mutate } = useSWR('/api/data/warehouses');
  const { data: currentUser } = useSWR('/api/auth/me');
  
  const [activeTab, setActiveTab] = useState<'warehouse' | 'distributor'>('warehouse');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '', type: 'STORAGE', address: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [detailedShipment, setDetailedShipment] = useState<any>(null);

  // Distributor modal state
  const [isDistributorModalOpen, setIsDistributorModalOpen] = useState(false);
  const [distributorFormData, setDistributorFormData] = useState({
    nama: '',
    no_hp: '',
    wilayah: '',
    warehouse_name: '',
    address: '',
  });
  const [isSubmittingDistributor, setIsSubmittingDistributor] = useState(false);

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data warehouse...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const role = (currentUser?.role || '').toUpperCase();
  const isDistributor = role === 'DISTRIBUTOR';
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  const currentTab = isDistributor ? 'distributor' : activeTab;

  const warehouses = data?.warehouses || [];
  const shipments = data?.shipments || [];
  const totalShipments = data?.totalShipments || 0;
  const totalItemsSent = data?.totalItemsSent || 0;

  const centralAndBranchWarehouses = warehouses.filter((w: any) => w.type === 'FACTORY' || w.type === 'STORAGE');
  const distributorWarehouses = warehouses.filter((w: any) => w.type === 'DISTRIBUTOR');
  const displayedWarehouses = currentTab === 'distributor' ? distributorWarehouses : centralAndBranchWarehouses;

  const totalGlobalStock = displayedWarehouses.reduce((sum: number, w: any) => {
    return sum + (w.stocks || []).reduce((acc: number, s: any) => acc + (s.quantity || 0), 0);
  }, 0);

  const openCreateModal = () => {
    if (!isOwnerOrAdmin) return;
    setFormError(null);
    setIsEditing(false);
    setFormData({
      name: '',
      type: 'STORAGE',
      address: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (w: any) => {
    if (!isOwnerOrAdmin) return;
    setFormError(null);
    setIsEditing(true);
    setFormData({
      id: w.id,
      name: w.name,
      type: w.type || 'STORAGE',
      address: w.address || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributorFormData.nama.trim()) { alert('Nama distributor wajib diisi'); return; }
    setIsSubmittingDistributor(true);
    try {
      await createDistributor(distributorFormData);
      await mutate();
      setIsDistributorModalOpen(false);
      setDistributorFormData({ nama: '', no_hp: '', wilayah: '', warehouse_name: '', address: '' });
      alert('Distributor dan gudang distributor berhasil ditambahkan!');
    } catch (err: any) {
      alert(err.message || 'Gagal mendaftarkan distributor');
    } finally {
      setIsSubmittingDistributor(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOrAdmin) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateWarehouse(formData.id, formData);
      } else {
        await createWarehouse(formData);
      }
      await mutate();
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data warehouse');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (w: any) => {
    if (!isOwnerOrAdmin) return;
    const totalStock = (w.stocks || []).reduce((acc: number, s: any) => acc + (s.quantity || 0) + (s.returned_qty || 0), 0);
    if (totalStock > 0) {
      alert(`Gudang "${w.name}" tidak dapat dihapus karena masih memiliki stok aktif sebanyak ${totalStock} pcs.\n\nSilakan mutasikan atau transfer stok terlebih dahulu ke gudang lain.`);
      return;
    }

    if (warehouses.length <= 1) {
      alert('Tidak dapat menghapus warehouse. Sistem memerlukan minimal 1 fasilitas gudang.');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus fasilitas gudang "${w.name}"?\n\nTindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setIsDeletingId(w.id);
    try {
      await deleteWarehouse(w.id);
      await mutate();
      if (isModalOpen && formData.id === w.id) {
        setIsModalOpen(false);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus warehouse');
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
            {isDistributor ? 'Gudang Distributor' : 'Manajemen Gudang & Distributor'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isDistributor
              ? 'Status stok fisik dan logistik fasilitas distributor Anda.'
              : 'Status stok fisik, lokasi fasilitas penyimpanan, dan manajemen gudang distributor.'}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <PdfExportButton targetId="warehouse-report" filename="laporan-warehouse" />
          {isOwnerOrAdmin && (
            currentTab === 'distributor' ? (
              <button
                onClick={() => setIsDistributorModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Distributor</span>
              </button>
            ) : (
              <button
                onClick={openCreateModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Warehouse</span>
              </button>
            )
          )}
          {!isOwnerOrAdmin && (
            <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200/80 px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs">
              <span>👁️</span> Mode View Only
            </span>
          )}
        </div>
      </div>

      {/* Tabs Switcher for Non-Distributor */}
      {!isDistributor && (
        <div className="flex gap-2 border-b border-gray-200 pb-3">
          <button
            onClick={() => setActiveTab('warehouse')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'warehouse'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>🏢 Gudang Pusat &amp; Cabang ({centralAndBranchWarehouses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('distributor')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'distributor'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>🚚 Distributor ({distributorWarehouses.length})</span>
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-blue-50/80 rounded-2xl p-4 sm:p-5 border border-blue-200/80 shadow-xs">
          <div className="text-xs text-blue-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>TOTAL FASILITAS</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-900 mt-1">{warehouses.length} Fasilitas</div>
          <div className="text-xs text-blue-600/80 mt-1 font-medium">
            {warehouses.filter((w: any) => w.type === 'FACTORY').length} Pabrik • {warehouses.filter((w: any) => w.type === 'STORAGE').length} Storage Cabang
          </div>
        </div>

        <div className="bg-emerald-50/80 rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-xs">
          <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Boxes className="w-4 h-4 text-emerald-600" />
            <span>TOTAL STOK FISIK</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-1">{totalGlobalStock} pcs</div>
          <div className="text-xs text-emerald-600/80 mt-1 font-medium">Siap didistribusikan ke outlet & booth</div>
        </div>

        <div className="bg-indigo-50/80 rounded-2xl p-4 sm:p-5 border border-indigo-200/80 shadow-xs">
          <div className="text-xs text-indigo-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ArrowRight className="w-4 h-4 text-indigo-600" />
            <span>TOTAL LOGISTIK KELUAR</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-900 mt-1">{totalItemsSent} pcs</div>
          <div className="text-xs text-indigo-600/80 mt-1 font-medium">{totalShipments} Resi / Pengiriman tercatat</div>
        </div>
      </div>

      {/* Warehouse Cards List */}
      <div id="warehouse-report" className="grid grid-cols-1 gap-6">
        {displayedWarehouses.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="text-4xl mb-2">{currentTab === 'distributor' ? '🚚' : '🏢'}</div>
            <div className="text-base font-bold text-gray-800">
              {currentTab === 'distributor'
                ? 'Belum ada fasilitas gudang distributor yang terdaftar'
                : 'Belum ada fasilitas gudang pusat/cabang yang terdaftar'}
            </div>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              {currentTab === 'distributor'
                ? 'Gunakan tombol "+ Tambah Distributor" untuk mendaftarkan mitra distributor baru beserta gudangnya.'
                : 'Gunakan tombol "+ Tambah Warehouse" untuk mendaftarkan gudang penyimpanan baru.'}
            </p>
          </div>
        ) : (
          displayedWarehouses.map((w: any) => {
            const totalStockFasilitas = (w.stocks || []).reduce((acc: number, s: any) => acc + (s.quantity || 0), 0);
            const totalKerugian = (w.stocks || []).reduce((acc: number, s: any) => acc + (s.returned_qty * Number(s.product?.base_price || 0)), 0);
            const mapQuery = w.address || w.name;
            const isFactory = w.type === 'FACTORY';
            const isDist = w.type === 'DISTRIBUTOR';

            return (
              <Card
                key={w.id}
                className={`shadow-sm rounded-2xl overflow-hidden border border-gray-200 border-t-4 ${
                  isDist ? 'border-t-emerald-600' : isFactory ? 'border-t-blue-600' : 'border-t-indigo-600'
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3">
                  <div className="lg:col-span-2 flex flex-col">
                    {/* Card Header */}
                    <CardHeader className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/60 flex flex-row items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Building2 className={isDist ? 'text-emerald-600 w-5 h-5' : isFactory ? 'text-blue-600 w-5 h-5' : 'text-indigo-600 w-5 h-5'} />
                            <span>{w.name}</span>
                          </CardTitle>
                          <Badge 
                            variant="outline" 
                            className={isDist
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                              : isFactory 
                              ? 'bg-blue-50 text-blue-800 border-blue-300 font-bold' 
                              : 'bg-indigo-50 text-indigo-800 border-indigo-300 font-bold'
                            }
                          >
                            {isDist ? '🚚 DISTRIBUTOR' : isFactory ? '🏭 FACTORY (Pabrik)' : '📦 STORAGE (Cabang)'}
                          </Badge>
                          <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                            {totalStockFasilitas} pcs stok
                          </span>
                        </div>
                        {w.distributor && (
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs font-bold text-emerald-800">
                              👤 Mitra: {w.distributor.nama} {w.distributor.wilayah ? `• Area: ${w.distributor.wilayah}` : ''}
                            </span>
                            {w.distributor.no_hp && (
                              <a
                                href={`https://wa.me/${w.distributor.no_hp.replace(/\D/g, '').replace(/^0/, '62')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-md font-bold transition-colors"
                              >
                                <span>💬</span> Chat WA ({w.distributor.no_hp})
                              </a>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 mt-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="line-clamp-1">{w.address || 'Alamat fisik belum diatur'}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {isOwnerOrAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={() => openEditModal(w)} 
                            title="Edit Warehouse"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            disabled={isDeletingId === w.id}
                            onClick={() => handleDelete(w)} 
                            title="Hapus Warehouse"
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </CardHeader>

                    {/* Card Content: Stocks */}
                    <CardContent className="p-4 sm:p-6 space-y-4 flex-1">
                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Stok Fisik Standby Per SKU</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {w.stocks.map((s: any) => (
                            <div key={s.id} className="p-3 bg-white border border-gray-200/80 rounded-xl shadow-xs">
                              <div className="text-xs font-bold text-gray-500 truncate">{s.product.name}</div>
                              <div className="text-xl font-black text-gray-900 mt-1">
                                {s.quantity} <span className="text-xs font-semibold text-gray-400">pcs</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {totalKerugian > 0 && (
                        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PackageMinus className="text-rose-500 w-5 h-5" />
                            <div className="font-semibold text-rose-800 text-xs sm:text-sm">Estimasi Kerugian (Barang Rusak/Retur)</div>
                          </div>
                          <div className="font-bold text-sm sm:text-base text-rose-700">Rp {totalKerugian.toLocaleString('id-ID')}</div>
                        </div>
                      )}

                      {/* Riwayat Pengiriman */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="font-bold text-gray-700 mb-2.5 text-xs uppercase tracking-wider">Riwayat Logistik Terakhir</h4>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                          {shipments.filter((s: any) => s.source_name === w.name || s.destination_name === w.name).slice(0, 8).map((s: any) => (
                            <div key={s.id} onClick={() => setDetailedShipment(s)} className="flex justify-between items-center p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200/60 rounded-xl text-xs cursor-pointer transition">
                              <div>
                                <div className="font-bold text-gray-800">{s.destination_name || s.destination_type}</div>
                                <div className="text-[11px] text-gray-400 mt-0.5">
                                  {new Date(s.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} • {s.shipment_type || 'PENGIRIMAN'}
                                </div>
                              </div>
                              <div className="font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                {s.items?.reduce((sum: number, i: any) => sum + i.qty, 0)} pcs
                              </div>
                            </div>
                          ))}
                          
                          {shipments.filter((s: any) => s.source_name === w.name || s.destination_name === w.name).length === 0 && (
                            <div className="text-xs text-gray-400 italic py-3 text-center">Belum ada riwayat logistik tercatat.</div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </div>
                  
                  {/* Map preview */}
                  <div className="border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50 p-4 h-64 lg:h-auto min-h-[220px]">
                    <iframe 
                      width="100%" 
                      height="100%" 
                      frameBorder="0" 
                      style={{ border: 0, borderRadius: 12, minHeight: 200 }}
                      src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`} 
                      allowFullScreen
                    />
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
      
      {/* Bottom Link */}
      <div className="mt-8 flex justify-center">
        <Link href="/pengiriman" className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-md text-sm">
          Lihat Semua Log Pengiriman <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  {isEditing ? 'Edit Fasilitas Warehouse' : 'Tambah Warehouse Baru'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isEditing ? 'Perbarui informasi nama, tipe, atau alamat fasilitas' : 'Daftarkan fasilitas gudang pabrik atau storage baru'}
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Panduan & Contoh */}
            <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3.5 text-xs text-blue-950 mb-4 space-y-1.5 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Panduan Input &amp; Contoh Sesuai Data Saat Ini:</span>
              </div>
              <div>• <b>Contoh Nama Gudang:</b> <code className="bg-white px-1.5 py-0.5 rounded text-blue-700 border border-blue-200">Banyuwangi (factory)</code>, <code className="bg-white px-1.5 py-0.5 rounded text-blue-700 border border-blue-200">Malang (storage branch)</code>, atau <code className="bg-white px-1.5 py-0.5 rounded text-blue-700 border border-blue-200">Surabaya (Hub)</code></div>
              <div>• <b>Tipe Fasilitas:</b> <b>FACTORY</b> untuk pabrik pengolahan utama, atau <b>STORAGE</b> untuk gudang transit/cabang distribusi.</div>
              <div>• <b>Otomatisasi Stok:</b> Begitu warehouse didaftarkan, sistem otomatis menginisialisasi inventaris semua produk Calio Fish dengan stok awal 0 pcs.</div>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold mb-4">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nama Warehouse / Fasilitas *
                </label>
                <input 
                  required 
                  type="text" 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="Contoh: Surabaya (Hub) atau Gudang Jakarta" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Tipe Fasilitas *
                </label>
                <select 
                  required 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm bg-white font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  value={formData.type || 'STORAGE'} 
                  onChange={e => setFormData({...formData, type: e.target.value})}
                >
                  <option value="STORAGE">📦 STORAGE (Gudang Cabang / Distribusi)</option>
                  <option value="FACTORY">🏭 FACTORY (Pabrik Produksi Utama)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">Gunakan FACTORY untuk fasilitas yang menerima hasil pengemasan produksi.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Alamat Lengkap / Titik Google Maps
                </label>
                <textarea 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  rows={3} 
                  placeholder="Contoh: Jl. Rungkut Industri No. 45, Rungkut Kidul, Surabaya, Jawa Timur" 
                  value={formData.address || ''} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
                <p className="text-[11px] text-gray-500 mt-1">Alamat ini akan digunakan untuk menampilkan peta lokasi Google Maps di kartu fasilitas.</p>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-6">
                {isEditing ? (
                  <button 
                    type="button" 
                    onClick={() => handleDelete(formData)}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold px-3 py-2 bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer"
                  >
                    Hapus Gudang
                  </button>
                ) : <div />}

                <div className="flex gap-2.5">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    disabled={isSubmitting} 
                    className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>{isEditing ? 'Simpan Perubahan' : 'Simpan Warehouse'}</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DISTRIBUTOR MODAL */}
      {isDistributorModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  🚚 Daftarkan Distributor &amp; Fasilitas Gudang
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Daftarkan mitra distributor baru beserta fasilitas penyimpanan stoknya
                </p>
              </div>
              <button 
                onClick={() => setIsDistributorModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDistributor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nama Distributor / Badan Usaha *
                </label>
                <input 
                  required 
                  type="text" 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                  placeholder="Contoh: CV Berkah Bahari / Budi Santoso" 
                  value={distributorFormData.nama} 
                  onChange={e => setDistributorFormData({...distributorFormData, nama: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    No. WhatsApp / HP *
                  </label>
                  <input 
                    required 
                    type="text" 
                    className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                    placeholder="081234567890" 
                    value={distributorFormData.no_hp} 
                    onChange={e => setDistributorFormData({...distributorFormData, no_hp: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Wilayah / Area *
                  </label>
                  <input 
                    required 
                    type="text" 
                    className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                    placeholder="Contoh: Malang Raya / Jember" 
                    value={distributorFormData.wilayah} 
                    onChange={e => setDistributorFormData({...distributorFormData, wilayah: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nama Fasilitas Gudang Distributor (Opsional)
                </label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                  placeholder="Otomatis: Gudang Distributor - [Nama]" 
                  value={distributorFormData.warehouse_name} 
                  onChange={e => setDistributorFormData({...distributorFormData, warehouse_name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Alamat Fasilitas Gudang Distributor
                </label>
                <textarea 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                  rows={2} 
                  placeholder="Contoh: Jl. Ijen No. 12, Klojen, Kota Malang" 
                  value={distributorFormData.address} 
                  onChange={e => setDistributorFormData({...distributorFormData, address: e.target.value})} 
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsDistributorModalOpen(false)} 
                  disabled={isSubmittingDistributor} 
                  className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingDistributor} 
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDistributor ? 'Mendaftarkan...' : 'Simpan Distributor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL SHIPMENT MODAL */}
      {detailedShipment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Detail Riwayat Pengiriman</h3>
                <p className="text-xs text-gray-500 mt-0.5">ID Resi: {detailedShipment.id}</p>
              </div>
              <button 
                onClick={() => setDetailedShipment(null)} 
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="grid grid-cols-2 gap-3.5 bg-gray-50 p-4 rounded-xl border border-gray-200/60">
                <div>
                  <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">FASILITAS ASAL</div>
                  <div className="font-bold text-gray-900 mt-0.5">{detailedShipment.source_name || '-'}</div>
                  <div className="text-xs text-gray-500">{detailedShipment.source_type}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">TUJUAN</div>
                  <div className="font-bold text-gray-900 mt-0.5">{detailedShipment.destination_name || detailedShipment.destination_type}</div>
                  <div className="text-xs text-gray-500">{detailedShipment.destination_type}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">TANGGAL</div>
                  <div className="font-semibold text-gray-800 mt-0.5">{new Date(detailedShipment.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">JENIS MUTASI</div>
                  <Badge variant="outline" className={detailedShipment.shipment_type === 'RETUR' ? 'bg-red-50 text-red-700 border-red-200 mt-0.5' : 'bg-blue-50 text-blue-700 border-blue-200 mt-0.5'}>
                    {detailedShipment.shipment_type || 'PENGIRIMAN'}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Rincian Produk Terkirim</h4>
                <div className="space-y-2">
                  {detailedShipment.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-200/80 shadow-xs">
                      <span className="font-semibold text-gray-800 text-sm">{item.product?.name || 'Produk'}</span>
                      <span className="font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-xs">{item.qty} pcs</span>
                    </div>
                  ))}
                  {!detailedShipment.items?.length && (
                    <div className="text-gray-400 italic text-xs text-center py-4">Tidak ada data produk.</div>
                  )}
                </div>
              </div>
              
              {detailedShipment.notes && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl">
                  <div className="text-xs font-bold text-amber-900 mb-1">Catatan Tambahan</div>
                  <p className="text-xs text-amber-800 leading-relaxed">{detailedShipment.notes}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50/60 flex justify-between items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const dest = detailedShipment.destination_name || detailedShipment.destination_type || 'Penerima';
                  const itemsList = detailedShipment.items?.map((it: any, idx: number) => 
                    `${idx + 1}. ${it.product?.name || 'Produk'}: ${it.qty} pcs`
                  ).join('\n') || '-';
                  const totalQty = detailedShipment.items?.reduce((sum: number, it: any) => sum + it.qty, 0) || 0;
                  
                  const text = `*SURAT JALAN & PENGIRIMAN CALIOFISH*\n` +
                    `📦 ID Pengiriman: #${detailedShipment.id.slice(0, 8)}\n` +
                    `🗓️ Tanggal: ${new Date(detailedShipment.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n` +
                    `🏢 Asal: ${detailedShipment.source_name || 'Gudang'}\n` +
                    `🎯 Tujuan: ${dest}\n` +
                    `📋 Kategori: ${detailedShipment.shipment_type || 'PENGIRIMAN'}\n` +
                    `----------------------------------------\n` +
                    `RINCIAN BARANG:\n${itemsList}\n` +
                    `----------------------------------------\n` +
                    `📦 TOTAL KUANTITAS: ${totalQty} pcs\n` +
                    `📝 Catatan: ${detailedShipment.notes || '-'}\n\n` +
                    `_Mohon konfirmasi jika barang sudah sampai dan sesuai. Terima kasih! 🙏_`;

                  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                  window.open(waUrl, '_blank');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>💬</span> Chat WA Surat Jalan
              </button>
              <button 
                onClick={() => setDetailedShipment(null)} 
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
