'use client';

import React, { useState } from 'react';
import { createKaryawan, updateKaryawan, deleteKaryawan } from '@/app/actions';

export function EmployeeManager({ employees }: { employees: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);

  const openModal = (employee?: any) => {
    if (employee) {
      setFormData(employee);
      setIsEditing(true);
    } else {
      setFormData({ status_aktif: true });
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
      await updateKaryawan(formData.id, {
        nama: formData.nama,
        posisi: formData.posisi,
        no_hp: formData.no_hp,
        status_aktif: formData.status_aktif
      });
    } else {
      await createKaryawan({
        nama: formData.nama,
        posisi: formData.posisi,
        no_hp: formData.no_hp,
        status_aktif: formData.status_aktif ?? true
      });
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus karyawan ini?')) {
      await deleteKaryawan(id);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b pb-2 mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">Database Karyawan</h2>
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm rounded-lg font-medium shadow transition-colors">
          + Tambah Karyawan
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Posisi</th>
              <th className="p-3">No. HP (WA)</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-3 font-bold">{e.nama}</td>
                <td className="p-3">{e.posisi || '-'}</td>
                <td className="p-3">{e.no_hp || '-'}</td>
                <td className="p-3">
                  <span style={{
                    background: e.status_aktif ? '#dcfce7' : '#f3f4f6',
                    color: e.status_aktif ? '#15803d' : '#4b5563',
                    padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: 12
                  }}>
                    {e.status_aktif ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openModal(e)} className="text-blue-600 hover:text-blue-800">Edit</button>
                  <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-800">Hapus</button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-8">
                  Belum ada data karyawan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">{isEditing ? 'Edit Karyawan' : 'Tambah Karyawan'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama</label>
                <input required type="text" className="w-full border rounded p-2" value={formData.nama || ''} onChange={e => setFormData({...formData, nama: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Posisi</label>
                <input type="text" className="w-full border rounded p-2" value={formData.posisi || ''} onChange={e => setFormData({...formData, posisi: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">No HP (Pastikan awalan 62)</label>
                <input type="text" className="w-full border rounded p-2" value={formData.no_hp || ''} onChange={e => setFormData({...formData, no_hp: e.target.value})} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="status" checked={formData.status_aktif} onChange={e => setFormData({...formData, status_aktif: e.target.checked})} />
                <label htmlFor="status" className="text-sm font-medium">Status Aktif</label>
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
