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
  distributors?: any[];
}

export default function WarehouseInputForm({ outlets, affiliates, products, distributors = [] }: Props) {
  const [destinationType, setDestinationType] = useState('Distributor');
  const [destinationName, setDestinationName] = useState('');
  const [outletId, setOutletId] = useState('');
  const [affiliateId, setAffiliateId] = useState('');
  const [distributorId, setDistributorId] = useState('');
  const [lastManifest, setLastManifest] = useState<string | null>(null);
  const [distributorPhone, setDistributorPhone] = useState('');
  
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
    if (destinationType === 'Distributor' && !distributorId) {
      setMessage({ type: 'error', text: 'Pilih Mitra Distributor!' });
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

    const selectedDist = distributors.find((d: any) => d.id === distributorId);
    const resolvedDestName = destinationType === 'Distributor' 
      ? (selectedDist?.nama || 'Distributor')
      : destinationName;

    try {
      const res = await submitWarehouseInput({
        destinationType,
        destinationName: resolvedDestName,
        outletId,
        affiliateId,
        items
      });
      
      if (res.success) {
        const productSummary = items.map(it => {
          const prod = products.find(p => p.id === it.productId);
          return `• ${prod?.name || 'Produk'}: ${it.qty} pcs`;
        }).join('\n');
        const totalPcs = items.reduce((sum, i) => sum + i.qty, 0);

        const manifest = `*SURAT JALAN & PENGIRIMAN CALIOFISH*\n` +
          `🗓️ Tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n` +
          `🎯 Tujuan: ${resolvedDestName} (${destinationType})\n` +
          `----------------------------------------\n` +
          `RINCIAN BARANG:\n${productSummary}\n` +
          `----------------------------------------\n` +
          `📦 TOTAL: ${totalPcs} pcs\n\n` +
          `_Mohon konfirmasi jika barang sudah diterima dengan baik. Terima kasih! 🙏_`;

        setLastManifest(manifest);
        setDistributorPhone(selectedDist?.no_hp || '');
        setMessage({ type: 'success', text: `Data pengiriman ke ${resolvedDestName} berhasil disimpan dan stok dipotong!` });
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
        <div className={`p-4 rounded-xl space-y-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <div className="font-semibold">{message.text}</div>
          {message.type === 'success' && lastManifest && (
            <div className="pt-2 border-t border-emerald-200 flex items-center gap-2 flex-wrap">
              <a
                href={`https://wa.me/${distributorPhone ? distributorPhone.replace(/\D/g, '').replace(/^0/, '62') : ''}?text=${encodeURIComponent(lastManifest)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              >
                <span>💬</span> Chat WA Pengiriman ke {destinationType === 'Distributor' ? 'Distributor' : 'Penerima'}
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(lastManifest);
                  alert('Surat jalan berhasil disalin ke clipboard!');
                }}
                className="inline-flex items-center gap-1 px-3 py-2 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-100/50"
              >
                📋 Salin Surat Jalan
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Jenis Tujuan</label>
          <select 
            value={destinationType} 
            onChange={e => setDestinationType(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="Distributor">🚚 Mitra Distributor</option>
            <option value="Outlet">🏪 Mitra Outlet</option>
            <option value="E-Commerce">🛒 E-Commerce (Shopee/TikTok)</option>
            <option value="Affiliate">🌟 Affiliator</option>
            <option value="Influencer">📸 Influencer</option>
            <option value="Sample">🎁 Sample / Lainnya</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Tujuan Spesifik</label>
          {destinationType === 'Distributor' ? (
            <select 
              value={distributorId} 
              onChange={e => setDistributorId(e.target.value)} 
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">-- Pilih Mitra Distributor --</option>
              {distributors.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.nama} {d.wilayah ? `(${d.wilayah})` : ''} {d.no_hp ? `- ${d.no_hp}` : ''}
                </option>
              ))}
            </select>
          ) : destinationType === 'Outlet' ? (
            <select value={outletId} onChange={e => setOutletId(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white">
              <option value="">-- Pilih Outlet --</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.nama}</option>)}
            </select>
          ) : destinationType === 'Affiliate' ? (
            <select value={affiliateId} onChange={e => setAffiliateId(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white">
              <option value="">-- Pilih Affiliator --</option>
              {affiliates.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
            </select>
          ) : (
            <input 
              type="text" 
              placeholder={destinationType === 'E-Commerce' ? "Contoh: Shopee Official" : "Nama Tujuan"}
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
