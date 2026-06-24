import React from 'react';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { prisma } from '@/lib/prisma';
import { ProduksiClient } from './ProduksiClient';

export default async function ProduksiPage() {
  // Ambil data produksi, jika ada data pembersihan yang belum di-migrate, bisa dibiarkan atau di-query terpisah jika masih relevan
  const produksiList = await prisma.produksi.findMany({ orderBy: { date: 'desc' } });

  // Map Decimal -> Number so it can be serialized to Client Component
  const serializableData = produksiList.map((p) => ({
    id: p.id,
    date: p.date,
    kegiatan: p.kegiatan,
    bahan_baku: p.bahan_baku ? Number(p.bahan_baku) : null,
    bahan_jadi: p.bahan_jadi ? Number(p.bahan_jadi) : null,
    total_hasil_pcs: p.total_hasil_pcs,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Produksi</h1>
        <PdfExportButton targetId="produksi-report" filename="laporan-produksi" />
      </div>

      <div id="produksi-report" className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <ProduksiClient initialData={serializableData} />
      </div>
    </div>
  );
}
