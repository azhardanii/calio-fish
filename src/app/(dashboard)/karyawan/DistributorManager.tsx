'use client';

import React, { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { 
  Building2, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Phone, 
  Boxes, 
  Store, 
  MapPin, 
  X, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { createDistributor, updateDistributor, deleteKaryawan } from '@/app/actions';

interface DistributorManagerProps {
  employees: any[];
  currentUser?: any;
}

export function DistributorManager({ employees, currentUser }: DistributorManagerProps) {
  const allEmployees = Array.isArray(employees) ? employees : [];
  const distributors = useMemo(() => {
    return allEmployees.filter((e: any) => (e.role || '').toUpperCase() === 'DISTRIBUTOR');
  }, [allEmployees]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({
    nama: '',
    no_hp: '',
    wilayah: '',
    warehouse_name: '',
    address: ''
  });
  const [editFormData, setEditFormData] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isOwnerOrAdmin = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  const filteredDistributors = useMemo(() => {
    return distributors.filter((d: any) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = (d.nama || '').toLowerCase().includes(q);
      const matchHp = (d.no_hp || '').toLowerCase().includes(q);
      const matchWil = (d.wilayah || '').toLowerCase().includes(q);
      return matchName || matchHp || matchWil;
    });
  }, [distributors, searchQuery]);

  const openCreateModal = () => {
    if (!isOwnerOrAdmin) {
      alert('Akses ditolak: Hanya Admin atau Owner yang dapat mendaftarkan distributor.');
      return;
    }
    setFormData({
      nama: '',
      no_hp: '',
      wilayah: '',
      warehouse_name: '',
      address: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (dist: any) => {
    if (!isOwnerOrAdmin) {
      alert('Akses ditolak: Hanya Admin atau Owner yang dapat mengedit distributor.');
      return;
    }
    setEditFormData({
      id: dist.id,
      nama: dist.nama || '',
      no_hp: dist.no_hp || '',
      wilayah: dist.wilayah || '',
      status_aktif: dist.status_aktif !== false
    });
    setIsEditModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOrAdmin) return;
    if (!formData.nama.trim()) {
      alert('Nama distributor wajib diisi');
      return;
    }
    if (!formData.no_hp.trim()) {
      alert('Nomor HP/WhatsApp distributor wajib diisi untuk akses login OTP');
      return;
    }

    setSaving(true);
    try {
      await createDistributor(formData);
      await mutate('/api/data/employees');
      await mutate('/api/data/warehouses');
      setIsModalOpen(false);
      alert(`Distributor "${formData.nama}" dan fasilitas gudangnya berhasil didaftarkan ke sistem!`);
    } catch (err: any) {
      alert(err.message || 'Gagal mendaftarkan distributor');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOrAdmin) return;

    setSaving(true);
    try {
      await updateDistributor(editFormData.id, {
        nama: editFormData.nama,
        no_hp: editFormData.no_hp,
        wilayah: editFormData.wilayah,
        status_aktif: editFormData.status_aktif
      });
      await mutate('/api/data/employees');
      setIsEditModalOpen(false);
      alert('Data distributor berhasil diperbarui');
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui distributor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!isOwnerOrAdmin) return;
    if (!confirm(`Yakin ingin menghapus akun distributor "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteKaryawan(id);
      await mutate('/api/data/employees');
      await mutate('/api/data/warehouses');
      alert(`Distributor "${nama}" berhasil dihapus.`);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus distributor');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Actions */}
      <div className="bg-white rounded-2xl p-5 border border-purple-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Database Mitra Distributor</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
            Daftarkan akun distributor resmi ke dalam sistem. Distributor memiliki akses login mandiri via WhatsApp OTP, mengelola fasilitas gudang distributor, serta mendaftarkan outlet jaringan kemitraan mereka sendiri.
          </p>
        </div>

        {isOwnerOrAdmin && (
          <button
            onClick={openCreateModal}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Daftarkan Distributor Baru</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari distributor berdasarkan nama, no. hp, wilayah..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 font-semibold px-2">
          Total Terdaftar: <span className="font-bold text-purple-700">{filteredDistributors.length} Distributor</span>
        </div>
      </div>

      {/* Grid or Table */}
      {filteredDistributors.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-xs">
          <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-bold text-gray-800">Belum Ada Distributor</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
            {searchQuery 
              ? 'Tidak ada distributor yang cocok dengan pencarian Anda.' 
              : 'Belum ada akun distributor yang didaftarkan. Klik tombol di bawah untuk mendaftarkan distributor baru.'}
          </p>
          {isOwnerOrAdmin && !searchQuery && (
            <button
              onClick={openCreateModal}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Daftarkan Sekarang</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDistributors.map((d: any) => {
            const warehouses = d.distributor_warehouses || [];
            const outlets = d.distributor_outlets || [];
            const cleanHp = (d.no_hp || '').replace(/\D/g, '');
            const waPhone = cleanHp.startsWith('0') ? '62' + cleanHp.slice(1) : cleanHp;

            return (
              <div 
                key={d.id} 
                className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/90 hover:border-purple-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-gray-900">{d.nama}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status_aktif !== false 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                          {d.status_aktif !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>Wilayah: <b>{d.wilayah || 'Nasional / Belum Diatur'}</b></span>
                      </div>
                    </div>

                    <span className="bg-purple-50 text-purple-700 text-[10px] font-extrabold px-2 py-1 rounded-lg border border-purple-200 shrink-0">
                      DISTRIBUTOR
                    </span>
                  </div>

                  {/* Kontak No HP */}
                  <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-600 font-medium">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{d.no_hp || '-'}</span>
                    </div>
                    {d.no_hp && (
                      <a
                        href={`https://wa.me/${waPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition flex items-center gap-1"
                      >
                        Chat WA <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Fasilitas Gudang & Outlet Network */}
                  <div className="mt-3 grid grid-cols-2 gap-2 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100 text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                        <Boxes className="w-3 h-3 text-purple-600" /> Gudang
                      </div>
                      <div className="font-extrabold text-gray-900 mt-0.5 truncate">
                        {warehouses.length > 0 ? `${warehouses.length} Gudang` : 'Belum Ada'}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {warehouses[0]?.name || 'Tidak ada'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                        <Store className="w-3 h-3 text-blue-600" /> Outlet Mitra
                      </div>
                      <div className="font-extrabold text-gray-900 mt-0.5">
                        {outlets.length} Outlet
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Jaringan Kemitraan
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {isOwnerOrAdmin && (
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(d)}
                      className="px-2.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(d.id, d.nama)}
                      disabled={deletingId === d.id}
                      className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deletingId === d.id ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE DISTRIBUTOR MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-purple-50/50">
              <div>
                <h3 className="text-base font-black text-gray-900">Daftarkan Mitra Distributor Baru</h3>
                <p className="text-xs text-gray-500 mt-0.5">Akun akan dibuat dengan hak akses DISTRIBUTOR</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nama Distributor / Perusahaan Mitra *
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                  placeholder="Contoh: PT Sumber Pangan Makmur / Bpk. Hendra" 
                  value={formData.nama} 
                  onChange={e => setFormData({...formData, nama: e.target.value})} 
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nomor HP / WhatsApp (Untuk Login OTP) *
                </label>
                <input 
                  type="tel" 
                  required
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                  placeholder="Contoh: 081234567890" 
                  value={formData.no_hp} 
                  onChange={e => setFormData({...formData, no_hp: e.target.value})} 
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Nomor ini digunakan distributor untuk menerima kode OTP saat login web.
                </span>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Wilayah Distribusi
                </label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                  placeholder="Contoh: Malang Raya / Jawa Timur" 
                  value={formData.wilayah} 
                  onChange={e => setFormData({...formData, wilayah: e.target.value})} 
                />
              </div>

              <div className="pt-2 border-t border-gray-100">
                <span className="font-black text-gray-800 uppercase tracking-wider block mb-2">
                  Fasilitas Gudang Distributor (Otomatis Dibuat)
                </span>
                
                <div className="space-y-2">
                  <div>
                    <label className="block font-bold text-gray-600 uppercase tracking-wider mb-1">
                      Nama Fasilitas Gudang (Opsional)
                    </label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                      placeholder="Default: Gudang Distributor - [Nama]" 
                      value={formData.warehouse_name} 
                      onChange={e => setFormData({...formData, warehouse_name: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-600 uppercase tracking-wider mb-1">
                      Alamat Gudang / Depo
                    </label>
                    <textarea 
                      rows={2}
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                      placeholder="Contoh: Jl. Panglima Sudirman No. 45, Klojen" 
                      value={formData.address} 
                      onChange={e => setFormData({...formData, address: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  disabled={saving} 
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Mendaftarkan...' : '🚀 Simpan & Daftarkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DISTRIBUTOR MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-base font-black text-gray-900">Edit Data Distributor</h3>
                <p className="text-xs text-gray-500 mt-0.5">Perbarui informasi profil dan kontak distributor</p>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nama Distributor *
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                  value={editFormData.nama || ''} 
                  onChange={e => setEditFormData({...editFormData, nama: e.target.value})} 
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nomor HP / WhatsApp (Login OTP) *
                </label>
                <input 
                  type="tel" 
                  required
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                  value={editFormData.no_hp || ''} 
                  onChange={e => setEditFormData({...editFormData, no_hp: e.target.value})} 
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Wilayah Distribusi
                </label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                  value={editFormData.wilayah || ''} 
                  onChange={e => setEditFormData({...editFormData, wilayah: e.target.value})} 
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={editFormData.status_aktif}
                    onChange={e => setEditFormData({...editFormData, status_aktif: e.target.checked})}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-bold text-gray-800">Status Akun Aktif</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  disabled={saving} 
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
