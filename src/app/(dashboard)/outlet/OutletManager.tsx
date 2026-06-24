'use client';

import React, { useState } from 'react';
import { createOutlet, updateOutlet, deleteOutlet } from '@/app/actions';

export function OutletManager({ outlets }: { outlets: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);

  const openModal = (outlet?: any) => {
    if (outlet) {
      setFormData(outlet);
      setIsEditing(true);
    } else {
      setFormData({ status: 'Konsinyasi', order_baru: 0, sisa_stok: 0, tagihan: 0, payment: 0, sisa_tagihan: 0 });
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
      await updateOutlet(formData.id, formData);
    } else {
      await createOutlet(formData);
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus outlet ini?')) {
      await deleteOutlet(id);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Daftar Outlet ({outlets.length})</h2>
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition-colors">
          + Tambah Outlet
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3">Nama Outlet</th>
              <th className="p-3">Kontak & Alamat</th>
              <th className="p-3">Status</th>
              <th className="p-3">Sisa Stok</th>
              <th className="p-3">Sisa Tagihan</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => (
              <tr key={o.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-3 font-bold">{o.nama}</td>
                <td className="p-3">
                  <div className="text-sm">{o.tlp || '-'}</div>
                  <div className="text-xs text-gray-500">{o.alamat || '-'}</div>
                </td>
                <td className="p-3">
                  {o.status && (
                    <span style={{
                      background: o.status.toLowerCase() === 'top' ? '#fef3c7' : '#dcfce7',
                      color: o.status.toLowerCase() === 'top' ? '#92400e' : '#15803d',
                      padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: 12, textTransform: 'uppercase'
                    }}>
                      {o.status}
                    </span>
                  )}
                </td>
                <td className="p-3">{o.sisa_stok} pcs</td>
                <td className="p-3" style={{ color: Number(o.sisa_tagihan) > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  Rp {Number(o.sisa_tagihan).toLocaleString('id-ID')}
                </td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openModal(o)} className="text-blue-600 hover:text-blue-800">Edit</button>
                  <button onClick={() => handleDelete(o.id)} className="text-red-600 hover:text-red-800">Hapus</button>
                </td>
              </tr>
            ))}
            {outlets.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-8">
                  Belum ada data outlet. Silakan tambah data baru.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditing ? 'Edit Outlet' : 'Tambah Outlet'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Outlet</label>
                <input required type="text" className="w-full border rounded p-2" value={formData.nama || ''} onChange={e => setFormData({...formData, nama: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select className="w-full border rounded p-2" value={formData.status || 'Konsinyasi'} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="Konsinyasi">Konsinyasi</option>
                    <option value="TOP">TOP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">No Telp</label>
                  <input type="text" className="w-full border rounded p-2" value={formData.tlp || ''} onChange={e => setFormData({...formData, tlp: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alamat</label>
                <textarea className="w-full border rounded p-2" value={formData.alamat || ''} onChange={e => setFormData({...formData, alamat: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Sisa Stok (pcs)</label>
                  <input type="number" className="w-full border rounded p-2" value={formData.sisa_stok || 0} onChange={e => setFormData({...formData, sisa_stok: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sisa Tagihan (Rp)</label>
                  <input type="number" className="w-full border rounded p-2" value={formData.sisa_tagihan || 0} onChange={e => setFormData({...formData, sisa_tagihan: Number(e.target.value)})} />
                </div>
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
