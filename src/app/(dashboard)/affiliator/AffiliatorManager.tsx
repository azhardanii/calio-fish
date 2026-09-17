'use client';

import React, { useState, useMemo } from 'react';
import { createAffiliator, updateAffiliator, deleteAffiliator, sendAffiliateSample } from '@/app/actions';
import { formatCurrency } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

function formatRp(val: number) {
  return formatCurrency(val);
}

export function AffiliatorManager({
  affiliators,
  products,
  warehouses,
  dateRange,
  mutate,
}: {
  affiliators: any[];
  products: any[];
  warehouses: any[];
  dateRange?: DateRange;
  mutate: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAffiliateModalOpen, setIsAffiliateModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);

  // Send Sample Modal State
  const [isSendSampleModalOpen, setIsSendSampleModalOpen] = useState(false);
  const [selectedAffiliateForSample, setSelectedAffiliateForSample] = useState<any>(null);

  // Filtered affiliators by search
  const filteredAffiliators = useMemo(() => {
    if (!searchTerm) return affiliators;
    const q = searchTerm.toLowerCase();
    return affiliators.filter(
      (a: any) =>
        a.nama?.toLowerCase().includes(q) ||
        a.akun_medsos?.toLowerCase().includes(q) ||
        a.jenis_postingan?.toLowerCase().includes(q) ||
        a.media_upload?.toLowerCase().includes(q) ||
        a.alamat?.toLowerCase().includes(q)
    );
  }, [affiliators, searchTerm]);

  // Summary Metrics calculated from the filtered date shipments
  const metrics = useMemo(() => {
    let totalSamplePcs = 0;
    let totalSampleValuation = 0;
    let totalShipmentsCount = 0;
    let totalRatecard = 0;

    for (const aff of affiliators) {
      if (aff.ratecard) totalRatecard += Number(aff.ratecard);
      const shipments = aff.shipments || [];
      totalShipmentsCount += shipments.length;

      for (const ship of shipments) {
        for (const it of ship.items || []) {
          const qty = Number(it.qty) || 0;
          totalSamplePcs += qty;
          const basePrice = Number(it.product?.base_price || 0);
          totalSampleValuation += qty * basePrice;
        }
      }
    }

    return {
      totalAffiliators: affiliators.length,
      totalSamplePcs,
      totalSampleValuation,
      totalShipmentsCount,
      totalRatecard,
    };
  }, [affiliators]);

  const openAffiliateModal = (affiliator?: any) => {
    if (affiliator) {
      setFormData(affiliator);
      setIsEditing(true);
    } else {
      setFormData({});
      setIsEditing(false);
    }
    setIsAffiliateModalOpen(true);
  };

  const closeAffiliateModal = () => {
    setIsAffiliateModalOpen(false);
    setFormData({});
  };

  const handleAffiliateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateAffiliator(formData.id, formData);
      } else {
        await createAffiliator(formData);
      }
      mutate();
      closeAffiliateModal();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan affiliator');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Yakin ingin menghapus affiliator "${name}"?`)) {
      try {
        await deleteAffiliator(id);
        mutate();
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus affiliator');
      }
    }
  };

  const openSendSampleModal = (affiliate?: any) => {
    setSelectedAffiliateForSample(affiliate || (affiliators.length > 0 ? affiliators[0] : null));
    setIsSendSampleModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Affiliator</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl text-base">👥</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.totalAffiliators}</div>
          <div className="text-xs text-slate-500 mt-1">Mitra KOL terdaftar aktif</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Sample Terkirim</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl text-base">📦</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{metrics.totalSamplePcs} pcs</div>
          <div className="text-xs text-slate-500 mt-1">{metrics.totalShipmentsCount} ekspedisi periode ini</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Valuasi Sample Keluar</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl text-base">💰</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{formatRp(metrics.totalSampleValuation)}</div>
          <div className="text-xs text-slate-500 mt-1">Terpotong dari stok gudang pusat</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Ratecard</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-base">⭐</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600">{formatRp(metrics.totalRatecard)}</div>
          <div className="text-xs text-slate-500 mt-1">Estimasi biaya endorsement</div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama, medsos, media upload, alamat..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => openSendSampleModal()}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all"
          >
            <span>📦</span> Kirim Sample / Produk
          </button>
          <button
            type="button"
            onClick={() => openAffiliateModal()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all"
          >
            <span>+</span> Tambah Affiliator
          </button>
        </div>
      </div>

      {/* Affiliates List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Daftar Affiliator &amp; Riwayat Sample ({filteredAffiliators.length})
          </h2>
          <span className="text-xs text-slate-500">
            Filter: {dateRange?.from?.toLocaleDateString('id-ID')} - {dateRange?.to?.toLocaleDateString('id-ID')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-600 uppercase text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="p-3.5 pl-5">Nama &amp; Medsos</th>
                <th className="p-3.5">Kontak</th>
                <th className="p-3.5">Jenis &amp; Media</th>
                <th className="p-3.5">Ratecard</th>
                <th className="p-3.5">Sample Periode Ini</th>
                <th className="p-3.5">Link Unggahan</th>
                <th className="p-3.5 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAffiliators.map((r: any) => {
                const shipments = r.shipments || [];
                const totalPcsForAff = shipments.reduce((sum: number, sh: any) => {
                  return sum + (sh.items || []).reduce((s: number, it: any) => s + (Number(it.qty) || 0), 0);
                }, 0);

                // Group items by product name
                const productSummaryMap: Record<string, number> = {};
                for (const sh of shipments) {
                  for (const it of sh.items || []) {
                    const name = it.product?.short_name || it.product?.name || 'Produk';
                    productSummaryMap[name] = (productSummaryMap[name] || 0) + (Number(it.qty) || 0);
                  }
                }
                const summaryEntries = Object.entries(productSummaryMap);

                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 pl-5">
                      <div className="font-bold text-slate-900">{r.nama}</div>
                      <div className="text-xs font-semibold text-blue-600">{r.akun_medsos || '-'}</div>
                      {r.alamat && (
                        <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5" title={r.alamat}>
                          📍 {r.alamat}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-600 font-mono text-xs">
                      {r.no_hp ? (
                        <a
                          href={`https://wa.me/${r.no_hp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-green-600 hover:underline flex items-center gap-1"
                        >
                          <span>💬</span> {r.no_hp}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                        {r.jenis_postingan || 'Endorsement'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{r.media_upload || '-'}</div>
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {r.ratecard ? formatRp(Number(r.ratecard)) : '-'}
                    </td>
                    <td className="p-3.5">
                      {totalPcsForAff > 0 ? (
                        <div>
                          <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-bold">
                            <span>📦</span> {totalPcsForAff} pcs
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-1">
                            {summaryEntries.slice(0, 3).map(([pName, qty]) => (
                              <span key={pName} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {pName}: {qty}
                              </span>
                            ))}
                            {summaryEntries.length > 3 && (
                              <span className="text-slate-400">+{summaryEntries.length - 3} lainnya</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Belum ada pengiriman</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {r.link_unggahan ? (
                        <a
                          href={r.link_unggahan}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <span>🔗</span> Buka Konten
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openSendSampleModal(r)}
                          title="Kirim Sample ke Affiliator ini"
                          className="p-1.5 text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                        >
                          📦 Kirim
                        </button>
                        <button
                          type="button"
                          onClick={() => openAffiliateModal(r)}
                          className="p-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id, r.nama)}
                          className="p-1.5 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredAffiliators.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-12">
                    Tidak ada data affiliator yang sesuai dengan pencarian atau filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: KIRIM SAMPLE / PRODUK KE AFFILIATE */}
      {isSendSampleModalOpen && (
        <SendSampleModal
          affiliators={affiliators}
          products={products}
          warehouses={warehouses}
          initialAffiliate={selectedAffiliateForSample}
          onClose={() => setIsSendSampleModalOpen(false)}
          onSuccess={() => {
            mutate();
            setIsSendSampleModalOpen(false);
          }}
        />
      )}

      {/* MODAL: TAMBAH / EDIT AFFILIATOR */}
      {isAffiliateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {isEditing ? '✏️ Edit Data Affiliator' : '✨ Tambah Affiliator Baru'}
              </h3>
              <button
                type="button"
                onClick={closeAffiliateModal}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAffiliateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap / Panggilan *</label>
                  <input
                    required
                    type="text"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Contoh: Rina Nose"
                    value={formData.nama || ''}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Akun Media Sosial (@username) *</label>
                  <input
                    required
                    type="text"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Contoh: @rinanose_official"
                    value={formData.akun_medsos || ''}
                    onChange={(e) => setFormData({ ...formData, akun_medsos: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Contoh: 08123456789"
                    value={formData.no_hp || ''}
                    onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Postingan</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Contoh: Review, Mukbang, Live"
                    value={formData.jenis_postingan || ''}
                    onChange={(e) => setFormData({ ...formData, jenis_postingan: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Media Upload</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Contoh: TikTok, Instagram Reels"
                    value={formData.media_upload || ''}
                    onChange={(e) => setFormData({ ...formData, media_upload: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ratecard (Rp)</label>
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0 jika barter sample"
                    value={formData.ratecard || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ratecard: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Link Unggahan / Bukti Post</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://tiktok.com/@..."
                  value={formData.link_unggahan || ''}
                  onChange={(e) => setFormData({ ...formData, link_unggahan: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Pengiriman Sample (Lengkap)</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Jl. ..., RT/RW, Kelurahan, Kecamatan, Kota, Kode Pos"
                  value={formData.alamat || ''}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeAffiliateModal}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition-all"
                >
                  Simpan Affiliator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MODAL: KIRIM SAMPLE / PRODUK KE AFFILIATE ───────────────────────
function SendSampleModal({
  affiliators,
  products,
  warehouses,
  initialAffiliate,
  onClose,
  onSuccess,
}: {
  affiliators: any[];
  products: any[];
  warehouses: any[];
  initialAffiliate?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const centralWarehouse =
    warehouses.find((w: any) => w.type === 'FACTORY' || w.name?.toLowerCase().includes('banyuwangi')) ||
    warehouses[0];

  const [affiliateId, setAffiliateId] = useState(initialAffiliate?.id || (affiliators[0]?.id || ''));
  const [warehouseId, setWarehouseId] = useState(centralWarehouse?.id || '');
  const [items, setItems] = useState<{ productId: string; qty: number }[]>([
    { productId: products[0]?.id || '', qty: 1 },
  ]);
  const [biayaEkspedisi, setBiayaEkspedisi] = useState<number>(0);
  const [notes, setNotes] = useState('Sample produk untuk endorsement/konten affiliate');
  const [submitting, setSubmitting] = useState(false);

  const selectedAffiliate = affiliators.find((a: any) => a.id === affiliateId);
  const selectedWarehouse = warehouses.find((w: any) => w.id === warehouseId);

  const handleAddItem = () => {
    setItems([...items, { productId: products[0]?.id || '', qty: 1 }]);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: string, val: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: val };
    setItems(updated);
  };

  // Get available stock in selected warehouse for a product
  const getAvailableStockInWarehouse = (productId: string) => {
    if (!selectedWarehouse || !selectedWarehouse.stocks) {
      const prod = products.find((p: any) => p.id === productId);
      return prod?.stok || 0;
    }
    const ws = selectedWarehouse.stocks.find((s: any) => s.product_id === productId);
    return ws ? ws.quantity : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affiliateId) {
      alert('Pilih affiliator tujuan!');
      return;
    }
    if (!warehouseId) {
      alert('Pilih gudang asal pengiriman!');
      return;
    }
    if (items.some((it) => !it.productId || it.qty <= 0)) {
      alert('Pastikan semua produk dipilih dan kuantitas minimal 1!');
      return;
    }

    setSubmitting(true);
    try {
      const res = await sendAffiliateSample({
        affiliateId,
        warehouseId,
        items,
        notes,
        biayaEkspedisi: Number(biayaEkspedisi) || 0,
      });

      if (!res.success) {
        throw new Error(res.error || 'Gagal mengirim sample');
      }

      alert(
        `✅ Berhasil! Pengiriman sample ke ${selectedAffiliate?.nama || 'Affiliate'} telah tercatat dan memotong stok gudang ${selectedWarehouse?.name || 'Pusat'}.`
      );
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat memproses pengiriman sample.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[75] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 border-b pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">📦 Kirim Sample / Produk ke Affiliate</h3>
            <p className="text-xs text-slate-500">Stok fisik otomatis terpotong langsung dari gudang pusat</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pilih Affiliator */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Affiliator Penerima *</label>
            <select
              value={affiliateId}
              onChange={(e) => setAffiliateId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              {affiliators.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.nama} ({a.akun_medsos || 'Tanpa Medsos'}) {a.no_hp ? `- ${a.no_hp}` : ''}
                </option>
              ))}
            </select>
            {selectedAffiliate?.alamat && (
              <p className="text-[11px] text-slate-500 mt-1">📍 Alamat: {selectedAffiliate.alamat}</p>
            )}
          </div>

          {/* Pilih Gudang Pengirim */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Gudang Asal Pengirim *</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.type === 'FACTORY' || w.type === 'STORAGE' ? '⭐ (Gudang Pusat)' : `(${w.type})`}
                </option>
              ))}
            </select>
          </div>

          {/* Rincian Produk Sample */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">Daftar Produk Sample *</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                + Tambah Varian
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((it, idx) => {
                const avail = getAvailableStockInWarehouse(it.productId);
                return (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="flex-1">
                      <select
                        value={it.productId}
                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      >
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                        <span>Tersedia di {selectedWarehouse?.name || 'Gudang'}:</span>
                        <span className={`font-bold ${avail > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {avail} pcs
                        </span>
                      </div>
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        max={avail > 0 ? avail : 9999}
                        value={it.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', Math.max(1, Number(e.target.value)))}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs text-center font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                      <div className="text-[10px] text-center text-slate-400 mt-1">Kuantitas</div>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1.5 text-sm"
                        title="Hapus baris"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Biaya Ekspedisi (Rp, Opsional)</label>
              <input
                type="number"
                value={biayaEkspedisi || ''}
                onChange={(e) => setBiayaEkspedisi(Number(e.target.value))}
                placeholder="0"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Pengiriman</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : '🚀 Konfirmasi & Potong Stok Gudang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
