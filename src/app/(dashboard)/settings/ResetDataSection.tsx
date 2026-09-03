'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Trash2, CheckCircle2, XCircle, RefreshCw, X } from 'lucide-react';

export function ResetDataSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultSummary, setResultSummary] = useState<any>(null);
  const [error, setError] = useState('');

  const isConfirmed = confirmationInput.trim() === 'RESET DATA';

  const handleReset = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'RESET DATA' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mereset data');
      }

      setResultSummary(data.summary);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setIsOpen(false);
    setConfirmationInput('');
    setResultSummary(null);
    setError('');
  };

  return (
    <>
      <Card className="border-red-200 bg-red-50/30 overflow-hidden shadow-sm">
        <CardHeader className="border-b border-red-100 bg-red-50/60 pb-3">
          <CardTitle className="text-red-700 flex items-center gap-2 text-lg">
            <AlertTriangle size={20} className="text-red-600" />
            Zona Bahaya: Reset Data Operasional
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Fitur ini digunakan untuk <strong>mengosongkan seluruh stok operasional</strong> (stok outlet dan gudang menjadi 0) serta membersihkan riwayat pengiriman, log produksi, dan laporan marketing.
          </p>

          <div className="bg-white border border-red-100 rounded-xl p-4 text-xs text-gray-600 space-y-1.5">
            <div className="font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600" />
              Data yang Tetap Aman & Tidak Dihapus:
            </div>
            <p>✓ Database Akun Karyawan & Presensi</p>
            <p>✓ Data Master Outlet, Alamat, dan Pengelola</p>
            <p>✓ Riwayat Transaksi Tagihan & Pelunasan Outlet (Sisa Tagihan tidak hilang)</p>
            <p>✓ Pengaturan Target Sistem & Integrasi WhatsApp</p>
            <p>✓ Master Data Produk & Master Gudang (hanya stoknya di-set 0)</p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Trash2 size={16} />
              Reset Data Operasional...
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-red-50/50">
              <div className="flex items-center gap-2.5 text-red-700 font-bold text-lg">
                <AlertTriangle size={22} className="text-red-600" />
                Konfirmasi Reset Data
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {resultSummary ? (
                <div className="space-y-4 text-center py-2">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Reset Berhasil Selesai!</h3>
                    <p className="text-sm text-gray-500 mt-1">Seluruh data operasional telah berhasil dibersihkan.</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 text-left text-xs text-gray-700 space-y-1.5 border border-gray-100 max-h-48 overflow-y-auto">
                    <p>• Stok Outlet di-set 0: <strong>{resultSummary.outletStocksReset} baris produk</strong></p>
                    <p>• Stok Gudang di-set 0: <strong>{resultSummary.warehouseStocksReset} baris gudang</strong></p>
                    <p>• Stok Produk di-set 0: <strong>{resultSummary.productsStockReset} produk</strong></p>
                    <p>• Riwayat Pengiriman Dihapus: <strong>{resultSummary.outboundShipmentsDeleted} shipment</strong></p>
                    <p>• Logistik Item Dihapus: <strong>{resultSummary.outboundItemsDeleted} item</strong></p>
                    <p>• Catatan Produksi Dihapus: <strong>{resultSummary.produksiDeleted} record</strong></p>
                    <p>• Log Stok Bahan Dihapus: <strong>{resultSummary.stokBahanDeleted} record</strong></p>
                    <p>• Laporan Marketing Offline Dihapus: <strong>{resultSummary.marketingOfflineDeleted} record</strong></p>
                    <p>• Laporan Marketing Online Dihapus: <strong>{resultSummary.marketingOnlineDeleted} record</strong></p>
                    <p>• Log Mutasi Stok Dihapus: <strong>{resultSummary.stockTransactionsDeleted} transaksi</strong></p>
                    <p>• Sampel & KOL Dihapus: <strong>{(resultSummary.sampleDeleted || 0) + (resultSummary.jadwalKolDeleted || 0)} record</strong></p>
                  </div>

                  <button
                    onClick={() => {
                      handleClose();
                      window.location.reload();
                    }}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Muat Ulang Halaman (Refresh)
                  </button>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                      <XCircle size={16} className="shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="text-sm text-gray-600 leading-relaxed">
                    Tindakan ini akan <strong>mengosongkan stok</strong> dan <strong>menghapus data riwayat operasional</strong>. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 space-y-1">
                    <div className="font-semibold text-red-900 mb-1">Akan di-reset / dihapus:</div>
                    <p>• Stok di seluruh outlet & gudang menjadi <strong>0</strong></p>
                    <p>• Riwayat pengiriman, surat jalan, dan mutasi stok</p>
                    <p>• Laporan produksi harian & log bahan baku</p>
                    <p>• Laporan omset marketing harian (offline & online)</p>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 space-y-0.5">
                    <div className="font-semibold text-emerald-900 mb-0.5">Aman (Tidak disentuh):</div>
                    <p>✓ Akun Karyawan, Database Outlet, Tagihan/Pelunasan, & Pengaturan Sistem</p>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-semibold text-gray-700 block">
                      Ketik <span className="font-mono text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200">RESET DATA</span> untuk mengonfirmasi:
                    </label>
                    <input
                      type="text"
                      placeholder="RESET DATA"
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                      disabled={loading}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-mono"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={!isConfirmed || loading}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all shadow-sm ${
                        isConfirmed && !loading
                          ? 'bg-red-600 hover:bg-red-700 active:scale-95 cursor-pointer'
                          : 'bg-gray-300 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          Mereset Data...
                        </>
                      ) : (
                        <>
                          <Trash2 size={15} />
                          Ya, Reset Data Sekarang
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
