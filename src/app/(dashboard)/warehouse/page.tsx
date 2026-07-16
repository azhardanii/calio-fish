'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { Badge } from '@/components/ui/badge';
import { Building2, PackageMinus, MapPin, Edit, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { updateWarehouse } from '@/app/actions';

export default function WarehousePage() {
  const { data, isLoading, mutate } = useSWR('/api/data/warehouses');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data warehouse...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const warehouses = data?.warehouses || [];
  const totalShipments = data?.totalShipments || 0;
  const totalItemsSent = data?.totalItemsSent || 0;

  const openEditModal = (w: any) => {
    setFormData(w);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateWarehouse(formData.id, formData);
    mutate(); // Refresh SWR
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manajemen Gudang</h1>
          <p className="text-gray-500 mt-1">Status stok fisik dan lokasi fasilitas penyimpanan.</p>
        </div>
        <div className="flex space-x-3">
          <PdfExportButton targetId="warehouse-report" filename="laporan-warehouse" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={{ background: '#eff6ff', borderRadius: 12, padding: 20, border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>TOTAL RESI / PENGIRIMAN</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af', marginTop: 4 }}>{totalShipments}</div>
        </div>
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 20, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>TOTAL PRODUK KELUAR</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#15803d', marginTop: 4 }}>{totalItemsSent} pcs</div>
        </div>
      </div>

      <div id="warehouse-report" className="grid grid-cols-1 gap-6">
        {warehouses.map((w: any) => {
          const totalKerugian = w.stocks.reduce((acc: number, s: any) => acc + (s.returned_qty * Number(s.product.base_price)), 0);
          const mapQuery = w.address || w.name;
          return (
            <Card key={w.id} className="border-t-4 border-t-blue-600 shadow-md overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-3">
                <div className="lg:col-span-2 flex flex-col">
                  <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xl text-blue-900">
                        <Building2 className="text-blue-600" />
                        {w.name}
                        <Badge variant="outline" className="ml-2">{w.type}</Badge>
                      </CardTitle>
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {w.address || 'Alamat belum diatur'}
                      </div>
                    </div>
                    <button onClick={() => openEditModal(w)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                      <Edit className="w-5 h-5" />
                    </button>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4 flex-1">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {w.stocks.map((s: any) => (
                        <div key={s.id} className="p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                          <div className="text-sm font-medium text-gray-500">{s.product.name}</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">{s.quantity} <span className="text-sm font-normal text-gray-500">pcs</span></div>
                        </div>
                      ))}
                    </div>
                    {totalKerugian > 0 && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PackageMinus className="text-red-500 w-5 h-5" />
                          <div className="font-semibold text-red-800">Estimasi Kerugian (Retur)</div>
                        </div>
                        <div className="font-bold text-lg text-red-700">Rp {totalKerugian.toLocaleString('id-ID')}</div>
                      </div>
                    )}
                  </CardContent>
                </div>
                
                <div className="border-l border-gray-100 bg-gray-50 p-4 h-64 lg:h-auto">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    style={{ border: 0, borderRadius: 12 }}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`} 
                    allowFullScreen
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      
      <div className="mt-8 flex justify-center">
        <Link href="/pengiriman" className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-md">
          Lihat Semua Log Pengiriman <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Edit Warehouse</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Warehouse</label>
                <input required type="text" className="w-full border rounded p-2" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipe (Fasilitas)</label>
                <select required className="w-full border rounded p-2" value={formData.type || ''} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="FACTORY">FACTORY (Pabrik)</option>
                  <option value="STORAGE">STORAGE (Gudang Cabang)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alamat / Titik Maps</label>
                <textarea className="w-full border rounded p-2" rows={3} placeholder="Contoh: Jl. Sudirman No. 123, Banyuwangi" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})}></textarea>
                <p className="text-xs text-gray-500 mt-1">Alamat ini akan digunakan untuk titik Google Maps.</p>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
