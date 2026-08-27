'use client';

import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createKaryawan, updateKaryawan, deleteKaryawan } from '@/app/actions';
import { mutate } from 'swr';

export function EmployeeManager({ employees, currentUser }: { employees: any[], currentUser?: any }) {
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
    mutate('/api/data/employees');
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus karyawan ini?')) {
      await deleteKaryawan(id);
      mutate('/api/data/employees');
    }
  };

  return (
    <>
      <div className="flex items-center justify-between pb-2 mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">Database Karyawan</h2>
        {currentUser?.role === 'OWNER' && (
          <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm rounded-lg font-medium shadow transition-colors">
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
              <TableHead>No. HP (WA)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((e) => (
              <TableRow key={e.id} className="hover:bg-gray-50 transition-colors">
                <TableCell className="font-bold">{e.nama}</TableCell>
                <TableCell>{e.role || e.posisi || '-'}</TableCell>
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
                      <button onClick={() => openModal(e)} className="text-blue-600 hover:text-blue-800">Edit</button>
                      <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-800">Hapus</button>
                    </>
                  ) : (
                    <span className="text-gray-400 text-sm italic">Akses Terbatas</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  Belum ada data karyawan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
                <label className="block text-sm font-medium mb-1">Posisi / Role</label>
                <select 
                  className="w-full border rounded p-2" 
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
