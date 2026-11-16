'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import {
  createDistribusiSample,
  updateDistribusiSample,
  deleteDistribusiSample,
} from '@/app/actions';

export default function DistribusiSamplePage() {
  const { data: reports, isLoading, mutate } = useSWR('/api/data/distribusi-sample');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    jenis_sample: '',
    total_produk: '',
    biaya_ekspedisi: '0',
  });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingItem(null);
    setForm({
      date: new Date().toISOString().split('T')[0],
      jenis_sample: '',
      total_produk: '',
      biaya_ekspedisi: '0',
    });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setForm({
      date: new Date(item.date).toISOString().split('T')[0],
      jenis_sample: item.jenis_sample || '',
      total_produk: String(item.total_produk ?? ''),
      biaya_ekspedisi: String(Number(item.biaya_ekspedisi ?? 0)),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jenis_sample.trim() || !form.total_produk) return;
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        jenis_sample: form.jenis_sample.trim(),
        total_produk: Number(form.total_produk),
        biaya_ekspedisi: Number(form.biaya_ekspedisi || 0),
      };
      if (editingItem) {
        await updateDistribusiSample(editingItem.id, payload);
      } else {
        await createDistribusiSample(payload);
      }
      setModalOpen(false);
      await mutate();
    } catch (err: any) {
      alert(err?.message || 'Gagal menyimpan distribusi sample');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus catatan distribusi sample ini?')) return;
    try {
      await deleteDistribusiSample(id);
      await mutate();
    } catch (err: any) {
      alert(err?.message || 'Gagal menghapus data');
    }
  };

  if (isLoading && !reports) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data distribusi sample...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const data = reports || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Distribusi Sample</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            + Input Distribusi Sample
          </button>
          <PdfExportButton targetId="sample-report" filename="distribusi-sample" />
        </div>
      </div>

      <div id="sample-report" className="space-y-6 bg-white p-4 rounded-xl">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>History Distribusi Sample Produk</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis Sample</TableHead>
                  <TableHead>Total Produk</TableHead>
                  <TableHead>Biaya Ekspedisi</TableHead>
                  <TableHead>Diinput Oleh</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>{new Date(r.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="font-medium">{r.jenis_sample}</TableCell>
                    <TableCell>{r.total_produk} pcs</TableCell>
                    <TableCell>Rp {Number(r.biaya_ekspedisi).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-gray-600">
                      {r.employee ? r.employee.nama : 'Sistem'}
                    </TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-4">Belum ada data distribusi sample</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Edit Distribusi Sample' : 'Input Distribusi Sample Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tanggal</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Jenis / Keterangan Sample</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Sample 20g Mix untuk KOL / Event"
                  value={form.jenis_sample}
                  onChange={(e) => setForm({ ...form, jenis_sample: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Total Produk (pcs)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.total_produk}
                    onChange={(e) => setForm({ ...form, total_produk: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Biaya Ekspedisi (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.biaya_ekspedisi}
                    onChange={(e) => setForm({ ...form, biaya_ekspedisi: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
