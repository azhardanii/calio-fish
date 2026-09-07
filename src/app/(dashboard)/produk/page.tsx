'use client';

import React from 'react';
import useSWR from 'swr';
import { ProductManager } from './ProductManager';
import { Card, CardContent } from '@/components/ui/card';
import { PdfExportButton } from '@/components/ui/PdfExportButton';

export default function ProductPage() {
  const { data, isLoading } = useSWR('/api/data/products');

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data produk...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const products = data?.products || [];
  const transactions = data?.transactions || [];

  const serializedProducts = products.map((p: any) => ({
    ...p,
    base_price: Number(p.base_price),
  }));

  const activeProducts = serializedProducts.filter((p: any) => p.is_active);
  const inactiveProducts = serializedProducts.filter((p: any) => !p.is_active);
  const avgPrice = serializedProducts.length > 0
    ? Math.round(serializedProducts.reduce((sum: number, p: any) => sum + p.base_price, 0) / serializedProducts.length)
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Database Master Produk</h1>
          <p className="text-sm text-gray-500 mt-1">Katalog master SKU, singkatan, harga dasar referensi, dan riwayat mutasi produk.</p>
        </div>
        <PdfExportButton targetId="product-report" filename="product-database" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
          <div className="text-sm text-blue-600 font-semibold mb-1">TOTAL MASTER SKU</div>
          <div className="text-3xl font-bold text-blue-900">{serializedProducts.length} <span className="text-sm font-normal text-blue-700">varian</span></div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
          <div className="text-sm text-emerald-600 font-semibold mb-1">SKU AKTIF DIJUAL</div>
          <div className="text-3xl font-bold text-emerald-900">{activeProducts.length} <span className="text-sm font-normal text-emerald-700">produk ({inactiveProducts.length} nonaktif)</span></div>
        </div>
        <div className="bg-purple-50 rounded-xl p-5 border border-purple-100">
          <div className="text-sm text-purple-600 font-semibold mb-1">RATA-RATA HARGA DASAR</div>
          <div className="text-3xl font-bold text-purple-900">Rp {avgPrice.toLocaleString('id-ID')}</div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-900 text-sm">
        <span className="text-xl">📦</span>
        <div>
          <b>Informasi Manajemen Stok Fisik:</b> Kuantitas stok fisik barang aktual dikelola dan dipantau per fasilitas penyimpanan (Gudang Pusat, Pabrik, Gudang Cabang, dan Gudang Distributor) di menu <b>Gudang / Warehouse</b> agar tidak terjadi kerancuan alur barang.
        </div>
      </div>

      <div id="product-report" className="bg-white p-4 rounded-xl">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardContent className="pt-6">
            <ProductManager products={serializedProducts} transactions={transactions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
