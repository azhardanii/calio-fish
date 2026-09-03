'use client';

import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createKaryawan, updateKaryawan, deleteKaryawan } from '@/app/actions';
import { Store, Search, CheckSquare, Square } from 'lucide-react';

export function EmployeeManager({ employees, currentUser }: { employees: any[], currentUser?: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([]);
  const [outletSearch, setOutletSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch all outlets for assignment
  const { data: outletsData } = useSWR<any[]>('/api/data/outlets');
  const allOutlets = Array.isArray(outletsData) ? outletsData : [];

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
    const filteredIds = filteredOutlets.map(o => o.id);
    const newSet = new Set([...selectedOutlets, ...filteredIds]);
    setSelectedOutlets(Array.from(newSet));
  };

  const deselectAllFiltered = () => {
    const filteredIds = new Set(filteredOutlets.map(o => o.id));
    setSelectedOutlets(prev => prev.filter(id => !filteredIds.has(id)));
  };

  const filteredOutlets = allOutlets.filter(o => {
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

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    if (confirm('Yakin ingin menghapus karyawan ini? Seluruh outlet yang dihandle oleh karyawan ini akan dialihkan ke status tanpa pengelola.')) {
      setDeletingId(id);
      try {
        await deleteKaryawan(id);
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

  return (
    <>
      <div className="flex items-center justify-between pb-2 mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Database Karyawan</h2>
          <p className="text-xs text-gray-500 mt-1">Kelola data karyawan dan tentukan outlet yang ditugaskan untuk tim marketing.</p>
        </div>
        {currentUser?.role === 'OWNER' && (
          <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm rounded-lg font-medium shadow transition-colors cursor-pointer">
            + Tambah Karyawan
          </button>
        )}
      </div>

      <div className="overflow-x-auto mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Role / Posisi</TableHead>
              <TableHead>Outlet yang Dihandle</TableHead>
              <TableHead>No. HP (WA)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((e) => {
              const eIsMarketing = (e.role || '').toUpperCase().includes('MARKETING') || (e.posisi || '').toUpperCase().includes('MARKETING');
              const handledOutlets = e.managed_outlets || [];

              return (
                <TableRow key={e.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="font-bold">{e.nama}</TableCell>
                  <TableCell>
                    <span className="font-medium text-gray-900">{e.role || e.posisi || '-'}</span>
                  </TableCell>
                  <TableCell>
                    {eIsMarketing ? (
                      handledOutlets.length > 0 ? (
                        <div className="flex flex-col gap-1 max-w-xs">
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs font-semibold w-fit">
                            <Store size={12} />
                            {handledOutlets.length} Outlet Ditugaskan
                          </span>
                          <span className="text-xs text-gray-500 truncate" title={handledOutlets.map((o: any) => o.nama).join(', ')}>
                            {handledOutlets.map((o: any) => o.nama).slice(0, 3).join(', ')}
                            {handledOutlets.length > 3 ? ` +${handledOutlets.length - 3} lainnya` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 italic">
                          Belum ada outlet
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>{e.no_hp || '-'}</TableCell>
                  <TableCell>
                    <span style={{
                      background: e.status_aktif ? '#dcfce7' : '#f3f4f6',
                      color: e.status_aktif ? '#15803d' : '#4b5563',
                      padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: 12
                    }}>
                      {e.status_aktif ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {currentUser?.role === 'OWNER' ? (
                      <>
                        <button onClick={() => openModal(e)} className="text-blue-600 hover:text-blue-800 font-medium text-sm cursor-pointer">Edit</button>
                        <button 
                          disabled={deletingId === e.id} 
                          onClick={() => handleDelete(e.id)} 
                          className="text-red-600 hover:text-red-800 font-medium text-sm cursor-pointer disabled:opacity-50"
                        >
                          {deletingId === e.id ? 'Menghapus...' : 'Hapus'}
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-400 text-sm italic">Akses Terbatas</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  Belum ada data karyawan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditing ? 'Edit Karyawan' : 'Tambah Karyawan'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama</label>
                <input required type="text" className="w-full border rounded p-2 text-sm" value={formData.nama || ''} onChange={e => setFormData({...formData, nama: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Posisi / Role</label>
                <select 
                  className="w-full border rounded p-2 text-sm" 
                  value={formData.posisi || ''} 
                  onChange={e => setFormData({...formData, posisi: e.target.value})}
                  required
                >
                  <option value="" disabled>Pilih Role...</option>
                  <option value="Owner">Owner</option>
                  <option value="Admin">Admin</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Staff Produksi">Staff Produksi</option>
                </select>
              </div>

              {/* Outlet Assignment Section for Role Marketing */}
              {isMarketing && (
                <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-blue-900 flex items-center gap-1.5">
                      <Store size={16} className="text-blue-600" />
                      Pilih Outlet yang Dihandle
                    </label>
                    <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                      {selectedOutlets.length} Dipilih
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Marketing ini hanya akan melihat dan bisa menginput data/laporan ke outlet yang dipilihkan di bawah ini.
                  </p>

                  {/* Search box & Quick Actions */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Cari outlet atau wilayah..."
                        value={outletSearch}
                        onChange={(e) => setOutletSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
                      <span>Menampilkan {filteredOutlets.length} dari {allOutlets.length} outlet</span>
                      <div className="space-x-2">
                        <button
                          type="button"
                          onClick={selectAllFiltered}
                          className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                        >
                          Pilih Semua
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={deselectAllFiltered}
                          className="text-gray-500 hover:text-gray-700 font-medium cursor-pointer"
                        >
                          Hapus Pilihan
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Outlets Checkbox List */}
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
                    {filteredOutlets.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-500 italic">
                        {allOutlets.length === 0 
                          ? 'Belum ada data outlet di sistem. Silakan tambahkan outlet terlebih dahulu di menu Outlet.'
                          : 'Tidak ada outlet yang cocok dengan pencarian.'}
                      </div>
                    ) : (
                      filteredOutlets.map((outlet) => {
                        const isChecked = selectedOutlets.includes(outlet.id);
                        const currentHandler = outlet.pengelola;
                        const isHandledByOther = currentHandler && currentHandler.id !== formData.id;

                        return (
                          <label
                            key={outlet.id}
                            className={`flex items-start gap-2.5 p-2.5 hover:bg-blue-50/40 cursor-pointer transition-colors ${
                              isChecked ? 'bg-blue-50/60' : ''
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
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-normal">
                                    {outlet.wilayah}
                                  </span>
                                )}
                              </div>
                              {outlet.alamat && (
                                <p className="text-[11px] text-gray-500 truncate mt-0.5">{outlet.alamat}</p>
                              )}
                              {isHandledByOther && (
                                <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                                  ⚠️ Saat ini dihandle: {currentHandler.nama}
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
                <label className="block text-sm font-medium mb-1">No HP (Pastikan awalan 62)</label>
                <input type="text" className="w-full border rounded p-2 text-sm" value={formData.no_hp || ''} onChange={e => setFormData({...formData, no_hp: e.target.value})} placeholder="628123456789" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="status" checked={formData.status_aktif} onChange={e => setFormData({...formData, status_aktif: e.target.checked})} className="cursor-pointer" />
                <label htmlFor="status" className="text-sm font-medium cursor-pointer">Status Aktif</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={closeModal} disabled={saving} className="px-4 py-2 border rounded text-sm hover:bg-gray-50 cursor-pointer">Batal</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-medium cursor-pointer flex items-center gap-1.5">
                  {saving ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
