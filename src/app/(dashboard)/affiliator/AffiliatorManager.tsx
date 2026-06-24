'use client';

import React, { useState } from 'react';
import { createAffiliator, updateAffiliator, deleteAffiliator } from '@/app/actions';

export function AffiliatorManager({ affiliators }: { affiliators: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);

  const openModal = (affiliator?: any) => {
    if (affiliator) {
      setFormData(affiliator);
      setIsEditing(true);
    } else {
      setFormData({});
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      await updateAffiliator(formData.id, formData);
    } else {
      await createAffiliator(formData);
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus affiliator ini?')) {
      await deleteAffiliator(id);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Daftar Affiliator ({affiliators.length})</h2>
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition-colors">
          + Tambah Affiliator
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Akun Medsos</th>
              <th className="p-3">No HP</th>
              <th className="p-3">Jenis Postingan</th>
              <th className="p-3">Media</th>
              <th className="p-3">Ratecard</th>
              <th className="p-3">Link</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {affiliators.map((r) => (
              <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-3 font-bold">{r.nama}</td>
                <td className="p-3" style={{ color: '#3b82f6' }}>{r.akun_medsos}</td>
                <td className="p-3">{r.no_hp || '-'}</td>
                <td className="p-3">{r.jenis_postingan || '-'}</td>
                <td className="p-3">{r.media_upload || '-'}</td>
                <td className="p-3">{r.ratecard ? `Rp ${Number(r.ratecard).toLocaleString('id-ID')}` : '-'}</td>
                <td className="p-3">
                  {r.link_unggahan ? <a href={r.link_unggahan} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Lihat</a> : '-'}
                </td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openModal(r)} className="text-blue-600 hover:text-blue-800">Edit</button>
                  <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:text-red-800">Hapus</button>
                </td>
              </tr>
            ))}
            {affiliators.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-gray-500 py-8">Belum ada data affiliator.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditing ? 'Edit Affiliator' : 'Tambah Affiliator'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nama</label>
                  <input required type="text" className="w-full border rounded p-2" value={formData.nama || ''} onChange={e => setFormData({...formData, nama: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Akun Medsos</label>
                  <input required type="text" className="w-full border rounded p-2" value={formData.akun_medsos || ''} onChange={e => setFormData({...formData, akun_medsos: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">No HP</label>
                  <input type="text" className="w-full border rounded p-2" value={formData.no_hp || ''} onChange={e => setFormData({...formData, no_hp: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Jenis Postingan</label>
                  <input type="text" className="w-full border rounded p-2" placeholder="Cth: Review, Unboxing" value={formData.jenis_postingan || ''} onChange={e => setFormData({...formData, jenis_postingan: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Media Upload</label>
                  <input type="text" className="w-full border rounded p-2" placeholder="Cth: TikTok, Instagram" value={formData.media_upload || ''} onChange={e => setFormData({...formData, media_upload: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ratecard (Rp)</label>
                  <input type="number" className="w-full border rounded p-2" value={formData.ratecard || ''} onChange={e => setFormData({...formData, ratecard: e.target.value ? Number(e.target.value) : null})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Link Unggahan</label>
                <input type="text" className="w-full border rounded p-2" value={formData.link_unggahan || ''} onChange={e => setFormData({...formData, link_unggahan: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alamat (Opsional)</label>
                <textarea className="w-full border rounded p-2" value={formData.alamat || ''} onChange={e => setFormData({...formData, alamat: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded hover:bg-gray-50">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
