"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Outlet } from '@prisma/client';
import { updateOutletInput } from './actions';

export default function OutletInputForm({ outlets }: { outlets: Outlet[] }) {
  const [outletId, setOutletId] = useState('');
  const [orderBaru, setOrderBaru] = useState<number>(0);
  const [tagihanBaru, setTagihanBaru] = useState<number>(0);
  const [payment, setPayment] = useState<number>(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletId) {
      setMessage({ type: 'error', text: 'Pilih Outlet!' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await updateOutletInput(outletId, { orderBaru, tagihanBaru, payment });
      if (res.success) {
        setMessage({ type: 'success', text: 'Data Outlet berhasil diperbarui!' });
        setOutletId('');
        setOrderBaru(0);
        setTagihanBaru(0);
        setPayment(0);
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
        <label className="text-sm font-medium text-gray-700">Pilih Outlet</label>
        <select value={outletId} onChange={e => setOutletId(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg">
          <option value="">-- Pilih Outlet --</option>
          {outlets.map(o => <option key={o.id} value={o.id}>{o.nama} (Sisa Tagihan: Rp {Number(o.sisa_tagihan).toLocaleString('id-ID')})</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Order Baru (pcs)</label>
          <input type="number" min="0" value={orderBaru} onChange={e => setOrderBaru(parseInt(e.target.value) || 0)} className="w-full p-2.5 border border-gray-300 rounded-lg" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Penambahan Tagihan (Rp)</label>
          <input type="number" min="0" value={tagihanBaru} onChange={e => setTagihanBaru(parseInt(e.target.value) || 0)} className="w-full p-2.5 border border-gray-300 rounded-lg" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Pembayaran Diterima / Payment (Rp)</label>
        <input type="number" min="0" value={payment} onChange={e => setPayment(parseInt(e.target.value) || 0)} className="w-full p-2.5 border border-gray-300 rounded-lg" />
        <p className="text-xs text-gray-500">Nilai ini akan memotong Sisa Tagihan outlet saat ini.</p>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg">
        {isSubmitting ? 'Menyimpan...' : 'Update Data Outlet'}
      </Button>
    </form>
  );
}
