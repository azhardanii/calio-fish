'use client';

import React, { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { 
  Store, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Phone, 
  Users, 
  Filter, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Building2,
  Factory,
  Shield,
  Crown,
  ExternalLink,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { createKaryawan, updateKaryawan, deleteKaryawan } from '@/app/actions';

interface EmployeeManagerProps {
  employees: any[];
  currentUser?: any;
  onAddNew?: () => void;
}

export function EmployeeManager({ employees, currentUser }: EmployeeManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([]);
  const [outletSearch, setOutletSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Fetch outlets for marketing assignment
  const { data: outletsData } = useSWR<any[]>('/api/data/outlets');
  const allOutlets = Array.isArray(outletsData) ? outletsData : [];

  const isOwnerOrAdmin = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  // Modal Handlers
  const openModal = (employee?: any) => {
    if (employee) {
      setFormData(employee);
      setIsEditing(true);
      const initialOutlets = employee.managed_outlets ? employee.managed_outlets.map((o: any) => o.id) : [];
      setSelectedOutlets(initialOutlets);
    } else {
      setFormData({ status_aktif: true, posisi: '' });
      setIsEditing(false);
      setSelectedOutlets([]);
    }
    setOutletSearch('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setFormData({});
    setSelectedOutlets([]);
    setOutletSearch('');
  };

  const isMarketing = (formData.posisi || '').toUpperCase().includes('MARKETING') || (formData.role || '').toUpperCase().includes('MARKETING');

  const toggleOutlet = (outletId: string) => {
    setSelectedOutlets(prev => 
      prev.includes(outletId) ? prev.filter(id => id !== outletId) : [...prev, outletId]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredOutletsModal.map(o => o.id);
    const newSet = new Set([...selectedOutlets, ...filteredIds]);
    setSelectedOutlets(Array.from(newSet));
  };

  const deselectAllFiltered = () => {
    const filteredIds = new Set(filteredOutletsModal.map(o => o.id));
    setSelectedOutlets(prev => prev.filter(id => !filteredIds.has(id)));
  };

  const filteredOutletsModal = allOutlets.filter(o => {
    if (!outletSearch.trim()) return true;
    const query = outletSearch.toLowerCase();
    return (
      (o.nama && o.nama.toLowerCase().includes(query)) ||
      (o.wilayah && o.wilayah.toLowerCase().includes(query)) ||
      (o.alamat && o.alamat.toLowerCase().includes(query))
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing) {
        await updateKaryawan(
          formData.id, 
          {
            nama: formData.nama,
            posisi: formData.posisi,
            no_hp: formData.no_hp,
            status_aktif: formData.status_aktif
          },
          isMarketing ? selectedOutlets : []
        );
      } else {
        await createKaryawan(
          {
            nama: formData.nama,
            posisi: formData.posisi,
            no_hp: formData.no_hp,
            status_aktif: formData.status_aktif ?? true
          },
          isMarketing ? selectedOutlets : []
        );
      }
      await Promise.all([
        mutate('/api/data/employees'),
        mutate('/api/data/outlets')
      ]);
      closeModal();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data karyawan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: any) => {
    if (deletingId) return;
    if (confirm(`Yakin ingin menghapus karyawan "${e.nama}"?\n\nSeluruh outlet yang dihandle oleh karyawan ini akan dialihkan ke status "Dikelola Pusat".`)) {
      setDeletingId(e.id);
      try {
        await deleteKaryawan(e.id);
        await Promise.all([
          mutate('/api/data/employees'),
          mutate('/api/data/outlets')
        ]);
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus karyawan');
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (emp.nama || '').toLowerCase().includes(q);
        const matchRole = (emp.role || emp.posisi || '').toLowerCase().includes(q);
        const matchPhone = (emp.no_hp || '').toLowerCase().includes(q);
        const matchOutlet = (emp.managed_outlets || []).some((o: any) => (o.nama || '').toLowerCase().includes(q));
        if (!matchName && !matchRole && !matchPhone && !matchOutlet) return false;
      }

      // Role Filter
      if (roleFilter !== 'ALL') {
        const role = (emp.role || emp.posisi || '').toUpperCase();
        if (roleFilter === 'MARKETING' && !role.includes('MARKETING')) return false;
        if (roleFilter === 'PRODUKSI' && !role.includes('PRODUKSI')) return false;
        if (roleFilter === 'ADMIN' && !role.includes('ADMIN')) return false;
        if (roleFilter === 'OWNER' && !role.includes('OWNER')) return false;
      }

      // Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE' && !emp.status_aktif) return false;
        if (statusFilter === 'INACTIVE' && emp.status_aktif) return false;
      }

      return true;
    });
  }, [employees, searchQuery, roleFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredEmployees.length / pageSize) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  // Helper for role badge styling
  const getRoleBadge = (roleStr: string) => {
    const r = (roleStr || '').toUpperCase();
    if (r.includes('MARKETING')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
          <Store className="w-3.5 h-3.5 text-blue-600" />
          <span>Marketing</span>
        </span>
      );
    }
    if (r.includes('PRODUKSI')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
          <Factory className="w-3.5 h-3.5 text-indigo-600" />
          <span>Produksi</span>
        </span>
      );
    }
    if (r.includes('ADMIN')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
          <Shield className="w-3.5 h-3.5 text-purple-600" />
          <span>Admin</span>
        </span>
      );
    }
    if (r.includes('OWNER')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
          <Crown className="w-3.5 h-3.5 text-amber-600" />
          <span>Owner</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        <span>{roleStr || 'Staff'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── TOOLBAR: SEARCH, FILTERS, & ADD BUTTON ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/90 shadow-xs">
        {/* Left: Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama, role, outlet, no hp..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Middle: Role & Status Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Semua Role</option>
            <option value="MARKETING">Marketing</option>
            <option value="PRODUKSI">Staff Produksi</option>
            <option value="ADMIN">Admin</option>
            <option value="OWNER">Owner</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Non-Aktif</option>
          </select>

          {/* Add Button */}
          {isOwnerOrAdmin && (
            <button
              onClick={() => openModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Karyawan</span>
            </button>
          )}
        </div>
      </div>

      {/* Result Count Info */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>
          Menampilkan <b>{paginatedEmployees.length}</b> dari <b>{filteredEmployees.length}</b> karyawan
          {(searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL') && ' (difilter)'}
        </span>
        {filteredEmployees.length > pageSize && (
          <span>Halaman {currentPage} dari {totalPages}</span>
        )}
      </div>

      {/* ── 1. DESKTOP VIEW: TABLE (hidden on mobile, visible on md+) ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">KARYAWAN</th>
                <th className="py-3.5 px-4">ROLE / POSISI</th>
                <th className="py-3.5 px-4">OUTLET DITUGASKAN</th>
                <th className="py-3.5 px-4">NO. HP (WHATSAPP)</th>
                <th className="py-3.5 px-4 text-center">STATUS</th>
                <th className="py-3.5 px-4 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEmployees.map((e) => {
                const eIsMarketing = (e.role || '').toUpperCase().includes('MARKETING') || (e.posisi || '').toUpperCase().includes('MARKETING');
                const handledOutlets = e.managed_outlets || [];
                const waNumber = (e.no_hp || '').replace(/\D/g, '');

                return (
                  <tr key={e.id} className="hover:bg-blue-50/30 transition-colors">
                    {/* Karyawan Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                          {e.nama ? e.nama.substring(0, 2).toUpperCase() : 'CF'}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 leading-tight">{e.nama}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5 font-mono">
                            {e.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="py-3.5 px-4">
                      {getRoleBadge(e.role || e.posisi)}
                    </td>

                    {/* Handled Outlets */}
                    <td className="py-3.5 px-4">
                      {eIsMarketing ? (
                        handledOutlets.length > 0 ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
                              <Store className="w-3 h-3 text-blue-600" />
                              <span>{handledOutlets.length} Outlet</span>
                            </span>
                            <div className="text-[11px] text-gray-500 line-clamp-1 max-w-xs" title={handledOutlets.map((o: any) => o.nama).join(', ')}>
                              {handledOutlets.map((o: any) => o.nama).slice(0, 2).join(', ')}
                              {handledOutlets.length > 2 ? ` +${handledOutlets.length - 2} lainnya` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 italic font-medium">
                            Belum ada outlet
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">-</span>
                      )}
                    </td>

                    {/* Contact (WhatsApp) */}
                    <td className="py-3.5 px-4">
                      {e.no_hp ? (
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                          title="Buka WhatsApp"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{e.no_hp}</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        e.status_aktif 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {e.status_aktif ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {isOwnerOrAdmin ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openModal(e)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Edit Karyawan"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            disabled={deletingId === e.id}
                            onClick={() => handleDelete(e)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-50"
                            title="Hapus Karyawan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">View only</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {paginatedEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <div className="font-semibold text-gray-600">Tidak ada data karyawan</div>
                    <div className="text-xs text-gray-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter Anda</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. MOBILE VIEW: RESPONSIVE CARDS (strictly visible on < md) ── */}
      <div className="block md:hidden space-y-3">
        {paginatedEmployees.map((e) => {
          const eIsMarketing = (e.role || '').toUpperCase().includes('MARKETING') || (e.posisi || '').toUpperCase().includes('MARKETING');
          const handledOutlets = e.managed_outlets || [];
          const waNumber = (e.no_hp || '').replace(/\D/g, '');

          return (
            <div 
              key={e.id} 
              className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-xs space-y-3"
            >
              {/* Header: Avatar, Name, Role, & Status */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
                    {e.nama ? e.nama.substring(0, 2).toUpperCase() : 'CF'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 text-sm truncate">{e.nama}</div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {getRoleBadge(e.role || e.posisi)}
                    </div>
                  </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                  e.status_aktif 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {e.status_aktif ? 'Aktif' : 'Non-Aktif'}
                </span>
              </div>

              {/* Handled Outlets (for marketing) */}
              {eIsMarketing && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-2.5 text-xs space-y-1">
                  <div className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Outlet Dihandle: {handledOutlets.length} Toko</span>
                  </div>
                  {handledOutlets.length > 0 ? (
                    <p className="text-[11px] text-blue-800/80 line-clamp-2 leading-relaxed">
                      {handledOutlets.map((o: any) => o.nama).join(', ')}
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-700 italic">Belum ada outlet ditugaskan</p>
                  )}
                </div>
              )}

              {/* Contact (WhatsApp) & Action Buttons */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                {e.no_hp ? (
                  <a
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </a>
                ) : (
                  <span className="text-xs text-gray-400 italic">No HP -</span>
                )}

                {isOwnerOrAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openModal(e)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      disabled={deletingId === e.id}
                      onClick={() => handleDelete(e)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deletingId === e.id ? '...' : 'Hapus'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {paginatedEmployees.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200/90 p-8 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <div className="font-semibold text-gray-600 text-sm">Tidak ada data karyawan</div>
            <div className="text-xs text-gray-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter Anda</div>
          </div>
        )}
      </div>

      {/* ── PAGINATION CONTROLS ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          <span className="text-xs font-semibold text-gray-600">
            Halaman {currentPage} dari {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <span>Selanjutnya</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── MODAL TAMBAH / EDIT KARYAWAN ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {isEditing ? '✏️ Edit Data Karyawan' : '👤 Tambah Karyawan Baru'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nama Lengkap *
                </label>
                <input 
                  required 
                  type="text" 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="Contoh: Ahmad Fauzi" 
                  value={formData.nama || ''} 
                  onChange={e => setFormData({...formData, nama: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Role / Divisi Kerja *
                </label>
                <select 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm bg-white font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  value={formData.posisi || ''} 
                  onChange={e => setFormData({...formData, posisi: e.target.value})}
                  required
                >
                  <option value="" disabled>Pilih Role...</option>
                  <option value="Marketing">Marketing (Penjualan Outlet, Booth, & Buyer)</option>
                  <option value="Staff Produksi">Staff Produksi (Pengolahan & Pengemasan)</option>
                  <option value="Admin">Admin (Operasional & Master Data)</option>
                  <option value="Owner">Owner (Manajemen Eksekutif)</option>
                </select>
              </div>

              {/* Outlet Assignment Section for Role Marketing */}
              {isMarketing && (
                <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-blue-600" />
                      <span>Penugasan Outlet Mitra</span>
                    </label>
                    <span className="text-xs bg-blue-600 text-white font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                      {selectedOutlets.length} Dipilih
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Staf marketing ini akan mengelola database, pengiriman, dan pelunasan outlet-outlet terpilih di bawah.
                  </p>

                  {/* Search box & Quick Actions */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Cari nama outlet atau wilayah..."
                        value={outletSearch}
                        onChange={(e) => setOutletSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                      <span>{filteredOutletsModal.length} dari {allOutlets.length} outlet</span>
                      <div className="space-x-2">
                        <button
                          type="button"
                          onClick={selectAllFiltered}
                          className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                        >
                          Pilih Semua
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={deselectAllFiltered}
                          className="text-gray-500 hover:text-gray-700 font-bold cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Outlets Checkbox List */}
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl bg-white divide-y divide-gray-100">
                    {filteredOutletsModal.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 italic">
                        {allOutlets.length === 0 
                          ? 'Belum ada data outlet. Tambahkan terlebih dahulu di menu Outlet.'
                          : 'Tidak ada outlet yang cocok.'}
                      </div>
                    ) : (
                      filteredOutletsModal.map((outlet) => {
                        const isChecked = selectedOutlets.includes(outlet.id);
                        const currentHandler = outlet.pengelola;
                        const isHandledByOther = currentHandler && currentHandler.id !== formData.id;

                        return (
                          <label
                            key={outlet.id}
                            className={`flex items-start gap-2.5 p-2.5 hover:bg-blue-50/40 cursor-pointer transition-colors ${
                              isChecked ? 'bg-blue-50/70' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleOutlet(outlet.id)}
                              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-900 flex items-center gap-1.5 flex-wrap">
                                <span>{outlet.nama}</span>
                                {outlet.wilayah && (
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded">
                                    {outlet.wilayah}
                                  </span>
                                )}
                              </div>
                              {outlet.alamat && (
                                <p className="text-[11px] text-gray-500 truncate mt-0.5">{outlet.alamat}</p>
                              )}
                              {isHandledByOther && (
                                <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                                  ⚠️ Pengelola saat ini: {currentHandler.nama}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nomor WhatsApp (Awalan 62) *
                </label>
                <input 
                  required
                  type="text" 
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  value={formData.no_hp || ''} 
                  onChange={e => setFormData({...formData, no_hp: e.target.value})} 
                  placeholder="Contoh: 6281234567890" 
                />
                <p className="text-[11px] text-gray-400 mt-1">Digunakan untuk login OTP dan notifikasi laporan presensi WA.</p>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input 
                  type="checkbox" 
                  id="status_karyawan" 
                  checked={formData.status_aktif ?? true} 
                  onChange={e => setFormData({...formData, status_aktif: e.target.checked})} 
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" 
                />
                <label htmlFor="status_karyawan" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Status Karyawan Aktif
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  disabled={saving} 
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
