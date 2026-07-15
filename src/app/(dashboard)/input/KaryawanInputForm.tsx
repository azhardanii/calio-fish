"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Employee } from '@prisma/client';
import { submitPresensiInput } from './actions';

export default function KaryawanInputForm({ employees }: { employees: Employee[] }) {
  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState('HADIR');
  const [alasan, setAlasan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setMessage({ type: 'error', text: 'Pilih karyawan!' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await submitPresensiInput(employeeId, status, alasan);
      if (res.success) {
        setMessage({ type: 'success', text: 'Presensi berhasil dicatat!' });
        setEmployeeId('');
        setAlasan('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Terjadi kesalahan' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Gagal mengirim data' });
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Pilih Karyawan</label>
        <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg">
          <option value="">-- Pilih Karyawan --</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.nama} - {e.posisi}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Status Kehadiran</label>
        <div className="flex space-x-4">
          {['HADIR', 'SAKIT', 'IZIN', 'ALPA'].map(s => (
            <label key={s} className="flex items-center space-x-2 cursor-pointer">
              <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="text-blue-600 focus:ring-blue-500 w-4 h-4" />
              <span className="text-gray-700 text-sm">{s}</span>
            </label>
          ))}
        </div>
      </div>

      {status !== 'HADIR' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Keterangan / Alasan</label>
          <input type="text" value={alasan} onChange={e => setAlasan(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="Wajib diisi jika tidak hadir" required />
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg">
        {isSubmitting ? 'Menyimpan...' : 'Submit Presensi'}
      </Button>
    </form>
  );
}
