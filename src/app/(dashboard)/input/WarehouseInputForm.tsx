"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Product, Outlet, Affiliate } from '@prisma/client';
import { submitWarehouseInput } from './actions';
import { PlusCircle, Trash2 } from 'lucide-react';

interface Props {
  outlets: Outlet[];
  affiliates: Affiliate[];
  products: Product[];
}

export default function WarehouseInputForm({ outlets, affiliates, products }: Props) {
  const [destinationType, setDestinationType] = useState('E-Commerce');
  const [destinationName, setDestinationName] = useState('');
  const [outletId, setOutletId] = useState('');
  const [affiliateId, setAffiliateId] = useState('');
  
  const [items, setItems] = useState([{ productId: '', qty: 1 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleAddItem = () => setItems([...items, { productId: '', qty: 1 }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  
  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    
    // Validate
    if (items.some(i => !i.productId || i.qty <= 0)) {
      setMessage({ type: 'error', text: 'Pastikan semua produk dipilih dan qty valid!' });
      setIsSubmitting(false);
      return;
    }

    if (destinationType === 'Outlet' && !outletId) {
      setMessage({ type: 'error', text: 'Pilih Outlet!' });
      setIsSubmitting(false); return;
    }
    if (destinationType === 'Affiliate' && !affiliateId) {
      setMessage({ type: 'error', text: 'Pilih Affiliator!' });
      setIsSubmitting(false); return;
    }
    if (['E-Commerce', 'Influencer', 'Sample'].includes(destinationType) && !destinationName) {
      setMessage({ type: 'error', text: 'Nama tujuan / platform tidak boleh kosong!' });
      setIsSubmitting(false); return;
    }

    try {
      const res = await submitWarehouseInput({
        destinationType,
        destinationName,
        outletId,
        affiliateId,
        items
      });
      
      if (res.success) {
        setMessage({ type: 'success', text: 'Data pengiriman berhasil disimpan dan stok dipotong!' });
        setItems([{ productId: '', qty: 1 }]);
        setDestinationName('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Terjadi kesalahan' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Gagal mengirim data' });
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Jenis Tujuan</label>
          <select 
            value={destinationType} 
            onChange={e => setDestinationType(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="E-Commerce">E-Commerce (Shopee/TikTok)</option>
            <option value="Outlet">Mitra Outlet</option>
            <option value="Affiliate">Affiliator</option>
            <option value="Influencer">Influencer</option>
            <option value="Sample">Sample / Lainnya</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Tujuan Spesifik</label>
          {destinationType === 'Outlet' ? (
            <select value={outletId} onChange={e => setOutletId(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
              <option value="">-- Pilih Outlet --</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.nama}</option>)}
            </select>
          ) : destinationType === 'Affiliate' ? (
            <select value={affiliateId} onChange={e => setAffiliateId(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
              <option value="">-- Pilih Affiliator --</option>
              {affiliates.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
            </select>
          ) : (
            <input 
              type="text" 
              placeholder={destinationType === 'E-Commerce' ? "Contoh: Shopee" : "Nama Tujuan"}
              value={destinationName} 
              onChange={e => setDestinationName(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Detail Barang (Produk Keluar)</h3>
          <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
            <PlusCircle className="w-4 h-4 mr-2" /> Tambah Barang
          </Button>
        </div>
        
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-gray-700">Produk</label>
              <select 
                value={item.productId} 
                onChange={e => updateItem(idx, 'productId', e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg"
              >
                <option value="">-- Pilih Produk --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Sisa: {p.stok})</option>)}
              </select>
            </div>
            <div className="w-32 space-y-2">
              <label className="text-sm font-medium text-gray-700">Qty (pcs)</label>
              <input 
                type="number" min="1" 
                value={item.qty} 
                onChange={e => updateItem(idx, 'qty', parseInt(e.target.value) || 0)}
                className="w-full p-2.5 border border-gray-300 rounded-lg"
              />
            </div>
            <Button type="button" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2.5" onClick={() => handleRemoveItem(idx)}>
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-medium shadow-sm">
          {isSubmitting ? 'Menyimpan...' : 'Simpan Laporan Pengiriman'}
        </Button>
      </div>
    </form>
  );
}
