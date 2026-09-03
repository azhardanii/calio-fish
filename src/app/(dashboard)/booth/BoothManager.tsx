'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { formatCurrency } from '@/lib/utils';
import {
  createEventBooth,
  updateEventBooth,
  createBoothBundle,
  deleteBoothBundle,
  transferStockToBooth,
  recordBoothSale,
  completeEventBooth,
} from '@/app/actions';

function formatRp(val: number) {
  return formatCurrency(val);
}

// ─── MODAL: BUKA BOOTH BARU ─────────────────────────────────────────
function CreateBoothModal({
  employees,
  onClose,
  onSaved,
}: {
  employees: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nama, setNama] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState(new Date().toISOString().split('T')[0]);
  const [tanggalSelesai, setTanggalSelesai] = useState(new Date().toISOString().split('T')[0]);
  const [picId, setPicId] = useState(employees[0]?.id || '');
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) { alert('Nama event/booth wajib diisi'); return; }
    if (!tanggalMulai || !tanggalSelesai) { alert('Tanggal mulai dan selesai wajib diisi'); return; }

    setSaving(true);
    try {
      await createEventBooth({
        nama: nama.trim(),
        lokasi: lokasi.trim() || undefined,
        tanggal_mulai: tanggalMulai,
        tanggal_selesai: tanggalSelesai,
        pic_id: picId || undefined,
        catatan: catatan.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>🎪 Buka Event / Booth Baru</h3>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#64748b' }}>Tambah agenda pameran, booth, atau bazar insidental</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Nama Event / Booth *</label>
            <input
              value={nama}
              onChange={e => setNama(e.target.value)}
              placeholder="Contoh: Pameran Kuliner Jatim Expo 2026"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Lokasi Booth</label>
            <input
              value={lokasi}
              onChange={e => setLokasi(e.target.value)}
              placeholder="Contoh: Grand City Convex Surabaya (Booth B-12)"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Tanggal Mulai *</label>
              <input
                type="date"
                value={tanggalMulai}
                onChange={e => setTanggalMulai(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Tanggal Selesai *</label>
              <input
                type="date"
                value={tanggalSelesai}
                onChange={e => setTanggalSelesai(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>PIC Marketing / Penanggung Jawab</label>
            <select
              value={picId}
              onChange={e => setPicId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
            >
              <option value="">Pilih Karyawan PIC...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nama} ({emp.role || emp.posisi || 'Staff'})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Catatan / Keterangan</label>
            <textarea
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              placeholder="Catatan tambahan sewa booth, fasilitas, dsb."
              rows={2}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>Batal</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Menyimpan...' : '🚀 Buka Booth'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MODAL: TRANSFER STOK DARI GUDANG ──────────────────────────────
function TransferStockModal({
  booth,
  warehouses,
  products,
  onClose,
  onSaved,
}: {
  booth: any;
  warehouses: any[];
  products: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [items, setItems] = useState<{ product_id: string; qty: number }[]>([
    { product_id: products[0]?.id || '', qty: 10 }
  ]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedWarehouse = warehouses.find(w => w.id === warehouseId);

  const addItem = () => {
    setItems([...items, { product_id: products[0]?.id || '', qty: 10 }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, val: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    setItems(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) { alert('Pilih gudang asal'); return; }
    if (items.some(it => it.qty <= 0)) { alert('Qty produk harus lebih dari 0'); return; }

    setSaving(true);
    try {
      await transferStockToBooth(warehouseId, booth.id, items, notes);
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>📦 Kirim Stok ke Booth</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Transfer stok fisik dari gudang menuju booth: <b>{booth.nama}</b></p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Gudang Asal *</label>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Daftar Produk yang Dikirim *</label>
              <button type="button" onClick={addItem} style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>+ Tambah Produk</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it, idx) => {
                const wsStock = selectedWarehouse?.stocks?.find((s: any) => s.product_id === it.product_id)?.quantity || 0;
                return (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={it.product_id}
                      onChange={e => updateItem(idx, 'product_id', e.target.value)}
                      style={{ flex: 2, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, background: '#fff' }}
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                        placeholder="Qty"
                      />
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#94a3b8' }}>tersedia: {wsStock}</span>
                    </div>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} style={{ color: '#dc2626', background: '#fef2f2', border: 'none', borderRadius: 8, padding: '8px', cursor: 'pointer' }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Catatan Pengiriman</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contoh: Kirim via driver internal Budi"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>Batal</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Memproses...' : '🚀 Kirim ke Booth'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MODAL: BUAT PAKET BUNDLING ────────────────────────────────────
function CreateBundleModal({
  booth,
  products,
  onClose,
  onSaved,
}: {
  booth: any;
  products: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nama, setNama] = useState('');
  const [sku, setSku] = useState('');
  const [hargaJual, setHargaJual] = useState(50000);
  const [items, setItems] = useState<{ product_id: string; qty: number }[]>([
    { product_id: products[0]?.id || '', qty: 2 },
    { product_id: products[1]?.id || products[0]?.id || '', qty: 1 },
  ]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems([...items, { product_id: products[0]?.id || '', qty: 1 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, val: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    setItems(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) { alert('Nama paket wajib diisi'); return; }
    if (hargaJual <= 0) { alert('Harga jual harus lebih dari 0'); return; }
    if (items.some(it => it.qty <= 0)) { alert('Jumlah produk per paket harus lebih dari 0'); return; }

    setSaving(true);
    try {
      await createBoothBundle(booth.id, {
        nama: nama.trim(),
        sku: sku.trim() || undefined,
        harga_jual: hargaJual,
        items,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>🏷️ Buat Paket Bundling / SKU Booth</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Atur paket penjualan khusus dengan harga promo untuk booth ini</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Nama Paket Bundling *</label>
            <input
              value={nama}
              onChange={e => setNama(e.target.value)}
              placeholder="Contoh: Paket Hemat 3in1 (2 FS + 1 Abon)"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Custom SKU (opsional)</label>
              <input
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="BNDL-EXPO-01"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Harga Jual Paket (Rp) *</label>
              <input
                type="number"
                value={hargaJual || ''}
                onChange={e => setHargaJual(Number(e.target.value))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                required
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Komposisi Produk Penyusun *</label>
              <button type="button" onClick={addItem} style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>+ Tambah Komponen</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={it.product_id}
                    onChange={e => updateItem(idx, 'product_id', e.target.value)}
                    style={{ flex: 2, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, background: '#fff' }}
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      min="1"
                      value={it.qty}
                      onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>pcs</span>
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} style={{ color: '#dc2626', background: '#fef2f2', border: 'none', borderRadius: 8, padding: '8px', cursor: 'pointer' }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>Batal</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Menyimpan...' : '💾 Simpan Paket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MODAL: CATAT PENJUALAN KASIR ──────────────────────────────────
function RecordSaleModal({
  booth,
  onClose,
  onSaved,
}: {
  booth: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saleType, setSaleType] = useState<'bundle' | 'product'>('bundle');
  const [selectedBundleId, setSelectedBundleId] = useState(booth.bundles[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState(booth.stocks[0]?.product_id || '');
  const [qty, setQty] = useState(1);
  const [metode, setMetode] = useState('TUNAI');
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  const activeBundle = booth.bundles.find((b: any) => b.id === selectedBundleId);
  const activeStock = booth.stocks.find((s: any) => s.product_id === selectedProductId);

  const unitPrice = saleType === 'bundle'
    ? (activeBundle ? Number(activeBundle.harga_jual) : 0)
    : (activeStock ? Number(activeStock.product.base_price) : 0);

  const itemName = saleType === 'bundle'
    ? (activeBundle ? activeBundle.nama : 'Paket')
    : (activeStock ? activeStock.product.name : 'Produk');

  const totalPrice = qty * unitPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0) { alert('Qty harus lebih dari 0'); return; }

    setSaving(true);
    try {
      await recordBoothSale(booth.id, {
        bundle_id: saleType === 'bundle' ? selectedBundleId : undefined,
        product_id: saleType === 'product' ? selectedProductId : undefined,
        item_name: itemName,
        qty,
        unit_price: unitPrice,
        metode_pembayaran: metode,
        catatan: catatan.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>💰 Catat Penjualan Booth</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Input penjualan langsung di kasir booth: <b>{booth.nama}</b></p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Tipe Penjualan */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setSaleType('bundle')}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: saleType === 'bundle' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                background: saleType === 'bundle' ? '#eff6ff' : '#fff',
                color: saleType === 'bundle' ? '#1d4ed8' : '#64748b'
              }}
            >
              🏷️ Paket Bundling
            </button>
            <button
              type="button"
              onClick={() => setSaleType('product')}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: saleType === 'product' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                background: saleType === 'product' ? '#eff6ff' : '#fff',
                color: saleType === 'product' ? '#1d4ed8' : '#64748b'
              }}
            >
              🥫 Produk Satuan
            </button>
          </div>

          {saleType === 'bundle' ? (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Pilih Paket Bundling *</label>
              {booth.bundles.length === 0 ? (
                <div style={{ fontSize: 12, color: '#dc2626', padding: '8px', background: '#fef2f2', borderRadius: 8 }}>
                  Belum ada paket bundling yang dibuat. Silakan buat paket bundling terlebih dahulu di tab &quot;Paket &amp; Bundling&quot;.
                </div>
              ) : (
                <select
                  value={selectedBundleId}
                  onChange={e => setSelectedBundleId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                >
                  {booth.bundles.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.nama} — {formatRp(Number(b.harga_jual))}</option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Pilih Produk Fisik Booth *</label>
              {booth.stocks.length === 0 ? (
                <div style={{ fontSize: 12, color: '#dc2626', padding: '8px', background: '#fef2f2', borderRadius: 8 }}>
                  Belum ada stok fisik di booth. Silakan transfer stok dari gudang terlebih dahulu.
                </div>
              ) : (
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                >
                  {booth.stocks.map((s: any) => (
                    <option key={s.product_id} value={s.product_id}>{s.product.name} (Stok: {s.quantity}) — {formatRp(Number(s.product.base_price))}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Qty Terjual *</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={e => setQty(Number(e.target.value))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Metode Bayar</label>
              <select
                value={metode}
                onChange={e => setMetode(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
              >
                <option value="TUNAI">💵 Tunai / Cash</option>
                <option value="QRIS">📱 QRIS</option>
                <option value="TRANSFER">🏦 Transfer Bank</option>
              </select>
            </div>
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Total Pembayaran:</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#15803d' }}>{formatRp(totalPrice)}</span>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Catatan Transaksi (opsional)</label>
            <input
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              placeholder="Contoh: Pembeli rombongan guru"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>Batal</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Menyimpan...' : '✅ Simpan Penjualan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MODAL: SELESAIKAN BOOTH & PENGEMBALIAN SISA STOK ───────────────
function CompleteBoothModal({
  booth,
  warehouses,
  onClose,
  onSaved,
}: {
  booth: any;
  warehouses: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [targetWarehouseId, setTargetWarehouseId] = useState(warehouses[0]?.id || '');
  const [notes, setNotes] = useState('Event selesai, seluruh sisa stok fisik dikembalikan ke gudang');
  const [saving, setSaving] = useState(false);

  const remainingStocks = booth.stocks.filter((s: any) => s.quantity > 0);
  const totalRemainingPcs = remainingStocks.reduce((sum: number, s: any) => sum + s.quantity, 0);

  const handleComplete = async () => {
    if (!targetWarehouseId) { alert('Pilih gudang tujuan pengembalian'); return; }
    if (!confirm(`Konfirmasi penutupan event "${booth.nama}"?\n\nSisa stok (${totalRemainingPcs} pcs) akan langsung dikembalikan ke stok aktif gudang tujuan dan siap dijual kembali.`)) {
      return;
    }

    setSaving(true);
    try {
      await completeEventBooth(booth.id, targetWarehouseId, notes);
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>🏁 Selesaikan Event &amp; Pengembalian Sisa Stok</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Tutup status booth <b>{booth.nama}</b> dan kembalikan sisa produk ke gudang</p>

        {/* Highlight perbedaan pengembalian vs retur */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span>💡</span> Pengembalian Sisa Layak Jual (Bukan Retur)
          </div>
          <div style={{ fontSize: 12, color: '#15803d', lineHeight: 1.4 }}>
            Produk sisa booth ini berstatus <b>bagus &amp; layak jual</b>. Kuantitas akan otomatis dikembalikan ke <b>stok aktif</b> di gudang tujuan dan dapat segera didistribusikan / dijual kembali.
          </div>
        </div>

        {/* Ringkasan Keuangan */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5, marginBottom: 8 }}>REKONSILIASI PENJUALAN BOOTH</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: '#64748b' }}>Total Penjualan:</span>
            <span style={{ fontWeight: 800, color: '#15803d' }}>{formatRp(Number(booth.total_penjualan))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: '#64748b' }}>Kas Masuk Disetor:</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatRp(Number(booth.kas_masuk))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>Sisa Fisik Kembali:</span>
            <span style={{ fontWeight: 800, color: '#2563eb' }}>{totalRemainingPcs} pcs</span>
          </div>
        </div>

        {/* Daftar Sisa Fisik */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Rincian Sisa Produk ({remainingStocks.length} SKU):</div>
          {remainingStocks.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Seluruh produk habis terjual (0 sisa).</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b' }}>PRODUK</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b' }}>SISA</th>
                  </tr>
                </thead>
                <tbody>
                  {remainingStocks.map((s: any) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0f172a' }}>{s.product.name}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>{s.quantity} pcs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pilih Gudang Tujuan */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Gudang Tujuan Pengembalian *</label>
          <select
            value={targetWarehouseId}
            onChange={e => setTargetWarehouseId(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Catatan Penutupan</label>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>Batal</button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={saving}
            style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Memproses...' : '🏁 Tutup & Kembalikan Sisa'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DETAIL DRAWER / VIEW BOOTH ─────────────────────────────────────
function BoothDetailView({
  booth,
  warehouses,
  products,
  onClose,
  onRefresh,
}: {
  booth: any;
  warehouses: any[];
  products: any[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'stok' | 'bundles' | 'kasir' | 'sop'>('stok');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const totalStockPcs = booth.stocks.reduce((sum: number, s: any) => sum + s.quantity, 0);
  const totalSalesPcs = booth.sales.reduce((sum: number, s: any) => sum + s.qty, 0);
  const isAktif = booth.status === 'AKTIF';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 24, maxWidth: 900, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        
        {/* Header Drawer */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: isAktif ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : 'linear-gradient(135deg, #f8fafc, #f1f5f9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>🎪 {booth.nama}</h2>
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: isAktif ? '#dcfce7' : '#e2e8f0',
                color: isAktif ? '#15803d' : '#475569',
                border: isAktif ? '1px solid #86efac' : '1px solid #cbd5e1'
              }}>
                {isAktif ? '🟢 AKTIF' : '⚪ SELESAI'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              📍 {booth.lokasi || 'Tanpa Lokasi'} &nbsp;|&nbsp; 🗓️ {new Date(booth.tanggal_mulai).toLocaleDateString('id-ID')} s/d {new Date(booth.tanggal_selesai).toLocaleDateString('id-ID')} &nbsp;|&nbsp; 👤 PIC: <b>{booth.pic?.nama || 'Belum ditentukan'}</b>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isAktif && (
              <button
                onClick={() => setShowCompleteModal(true)}
                style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                🏁 Selesaikan Event
              </button>
            )}
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748b' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Quick KPI Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: '14px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>TOTAL OMSET</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#15803d' }}>{formatRp(Number(booth.total_penjualan))}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>KAS MASUK</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{formatRp(Number(booth.kas_masuk))}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>SISA STOK FISIK</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#2563eb' }}>{totalStockPcs} pcs</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>ITEM TERJUAL</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#7c3aed' }}>{totalSalesPcs} item</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 24px', background: '#fafafa', gap: 4, overflowX: 'auto' }}>
          {[
            { id: 'stok', label: `📦 Stok Fisik Booth (${booth.stocks.length})` },
            { id: 'bundles', label: `🏷️ Paket Bundling (${booth.bundles.length})` },
            { id: 'kasir', label: `💰 Kasir & Riwayat Penjualan (${booth.sales.length})` },
            { id: 'sop', label: '📱 Template Format WA' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                padding: '12px 16px', border: 'none', background: 'none', fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? '#2563eb' : '#64748b', borderBottom: activeTab === t.id ? '3px solid #2563eb' : '3px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
          
          {/* TAB 1: STOK BOOTH */}
          {activeTab === 'stok' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Stok Fisik Standby di Booth</h4>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Stok produk yang telah diterima dan siap dijual di booth</p>
                </div>
                {isAktif && (
                  <button
                    onClick={() => setShowTransferModal(true)}
                    style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    📦 + Tambah Stok dari Gudang
                  </button>
                )}
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontSize: 11, fontWeight: 700 }}>PRODUK</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontSize: 11, fontWeight: 700 }}>SKU</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontSize: 11, fontWeight: 700 }}>KATEGORI</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', color: '#475569', fontSize: 11, fontWeight: 700 }}>HARGA SATUAN</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', color: '#475569', fontSize: 11, fontWeight: 700 }}>STOK BOOTH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booth.stocks.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Belum ada stok fisik di booth ini. Silakan klik &quot;+ Tambah Stok dari Gudang&quot;.</td></tr>
                    ) : booth.stocks.map((s: any) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{s.product.name}</td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.product.sku}</td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.product.category}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{formatRp(Number(s.product.base_price))}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: s.quantity > 0 ? '#15803d' : '#dc2626' }}>
                          {s.quantity} pcs
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PAKET BUNDLING */}
          {activeTab === 'bundles' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Paket Bundling &amp; SKU Khusus Pameran</h4>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Paket promosi khusus event ini. Saat bundle terjual, stok fisik produk penyusun otomatis terpotong.</p>
                </div>
                {isAktif && (
                  <button
                    onClick={() => setShowBundleModal(true)}
                    style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    🏷️ + Buat Paket Bundle
                  </button>
                )}
              </div>

              {booth.bundles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: 16, color: '#94a3b8', fontSize: 13 }}>
                  Belum ada paket bundling yang dibuat. Klik tombol &quot;+ Buat Paket Bundle&quot; untuk membuat paket hemat 3in1 dsb.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {booth.bundles.map((b: any) => (
                    <div key={b.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{b.nama}</div>
                          {b.sku && <div style={{ fontSize: 11, color: '#94a3b8' }}>SKU: {b.sku}</div>}
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed' }}>{formatRp(Number(b.harga_jual))}</span>
                      </div>

                      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>KOMPOSISI PRODUK:</div>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#334155' }}>
                          {b.items.map((it: any) => (
                            <li key={it.id}>
                              <b>{it.qty}x</b> {it.product.name}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {isAktif && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                          <button
                            onClick={async () => {
                              if (confirm(`Hapus bundle "${b.nama}"?`)) {
                                await deleteBoothBundle(b.id);
                                onRefresh();
                              }
                            }}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                          >
                            🗑️ Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: KASIR & PENJUALAN */}
          {activeTab === 'kasir' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Riwayat Transaksi Penjualan</h4>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Total transaksi tercatat: {booth.sales.length} kali</p>
                </div>
                {isAktif && (
                  <button
                    onClick={() => setShowSaleModal(true)}
                    style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    💰 + Catat Penjualan Kasir
                  </button>
                )}
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontSize: 11, fontWeight: 700 }}>WAKTU</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontSize: 11, fontWeight: 700 }}>ITEM / PAKET</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', color: '#475569', fontSize: 11, fontWeight: 700 }}>QTY</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', color: '#475569', fontSize: 11, fontWeight: 700 }}>TOTAL RP</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', color: '#475569', fontSize: 11, fontWeight: 700 }}>METODE</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontSize: 11, fontWeight: 700 }}>CATATAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booth.sales.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Belum ada penjualan di booth ini. Klik tombol &quot;+ Catat Penjualan Kasir&quot;.</td></tr>
                    ) : booth.sales.map((sl: any) => (
                      <tr key={sl.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>{new Date(sl.date).toLocaleString('id-ID')}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{sl.item_name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{sl.qty}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#15803d' }}>{formatRp(Number(sl.total_price))}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: sl.metode_pembayaran === 'QRIS' ? '#ede9fe' : sl.metode_pembayaran === 'TRANSFER' ? '#e0f2fe' : '#dcfce7',
                            color: sl.metode_pembayaran === 'QRIS' ? '#7c3aed' : sl.metode_pembayaran === 'TRANSFER' ? '#0284c7' : '#15803d',
                          }}>
                            {sl.metode_pembayaran}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{sl.catatan || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PANDUAN WA */}
          {activeTab === 'sop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>📱 Template Format WhatsApp untuk Booth</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Karyawan di lapangan dapat melaporkan logistik dan penjualan via WhatsApp bot Calio</p>
              </div>

              {/* Template 1 */}
              <div style={{ background: '#f8fafc', borderRadius: 14, padding: 16, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>1. Pengiriman Stok dari Gudang ke Booth:</div>
                <pre style={{ background: '#fff', padding: 12, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 12, margin: 0, overflowX: 'auto', fontFamily: 'monospace' }}>
{`KIRIM BARANG
DARI: Gudang Malang
KE: ${booth.nama}
BARANG:
- FS Ori: 50
- FS SM: 30
- Abon: 20`}
                </pre>
              </div>

              {/* Template 2 */}
              <div style={{ background: '#f8fafc', borderRadius: 14, padding: 16, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>2. Laporan Penjualan Harian Booth:</div>
                <pre style={{ background: '#fff', padding: 12, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 12, margin: 0, overflowX: 'auto', fontFamily: 'monospace' }}>
{`LAPORAN PENJUALAN BOOTH: ${booth.nama}
TANGGAL: ${new Date().toISOString().split('T')[0]}
TERJUAL:
- Paket Hemat: 15
- FS Ori: 10
TOTAL OMSET: 1050000
METODE: QRIS`}
                </pre>
              </div>

              {/* Template 3 */}
              <div style={{ background: '#f8fafc', borderRadius: 14, padding: 16, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>3. Pengembalian Sisa Stok Layak Jual ke Gudang (Bukan Retur):</div>
                <pre style={{ background: '#fff', padding: 12, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 12, margin: 0, overflowX: 'auto', fontFamily: 'monospace' }}>
{`PENGEMBALIAN DARI: ${booth.nama}
KE GUDANG: Gudang Malang
BARANG:
- FS Ori: 15
- Abon: 5
KETERANGAN: Sisa booth pameran selesai`}
                </pre>
              </div>
            </div>
          )}

        </div>
      </div>

      {showTransferModal && (
        <TransferStockModal
          booth={booth}
          warehouses={warehouses}
          products={products}
          onClose={() => setShowTransferModal(false)}
          onSaved={onRefresh}
        />
      )}

      {showBundleModal && (
        <CreateBundleModal
          booth={booth}
          products={products}
          onClose={() => setShowBundleModal(false)}
          onSaved={onRefresh}
        />
      )}

      {showSaleModal && (
        <RecordSaleModal
          booth={booth}
          onClose={() => setShowSaleModal(false)}
          onSaved={onRefresh}
        />
      )}

      {showCompleteModal && (
        <CompleteBoothModal
          booth={booth}
          warehouses={warehouses}
          onClose={() => setShowCompleteModal(false)}
          onSaved={() => {
            onRefresh();
            onClose();
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN BOOTH MANAGER COMPONENT
// ═══════════════════════════════════════════════════════════
export function BoothManager() {
  const { data, isLoading, error, mutate } = useSWR('/api/data/booths');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState<any>(null);

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data Event &amp; Booth...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', background: '#fef2f2', borderRadius: 16, margin: '24px 0' }}>
        <h3 style={{ color: '#b91c1c', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Gagal Memuat Data Event &amp; Booth</h3>
        <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>Terjadi kesalahan saat memuat data. Silakan muat ulang (F5).</p>
      </div>
    );
  }

  const booths: any[] = data?.booths || [];
  const products: any[] = data?.products || [];
  const warehouses: any[] = data?.warehouses || [];
  const employees: any[] = data?.employees || [];

  const activeBooths = booths.filter(b => b.status === 'AKTIF');
  const historyBooths = booths.filter(b => b.status === 'SELESAI');

  const displayedBooths = activeTab === 'active' ? activeBooths : historyBooths;

  // Summary Metrics
  const totalOmsetAll = booths.reduce((sum, b) => sum + Number(b.total_penjualan), 0);
  const totalKasAll = booths.reduce((sum, b) => sum + Number(b.kas_masuk), 0);
  const totalActiveStock = activeBooths.reduce((sum, b) => sum + b.stocks.reduce((sSum: number, s: any) => sSum + s.quantity, 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>🎪 Event &amp; Open Booth Pameran</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Kelola operasional pameran, bazar, bundling SKU khusus, kasir penjualan, dan pengembalian sisa stok ke gudang.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 20px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          ➕ Buka Booth Baru
        </button>
      </div>

      {/* Global Banner KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', letterSpacing: 0.5, marginBottom: 4 }}>BOOTH AKTIF</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{activeBooths.length} Event</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', letterSpacing: 0.5, marginBottom: 4 }}>TOTAL OMSET EVENT</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d' }}>{formatRp(totalOmsetAll)}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', letterSpacing: 0.5, marginBottom: 4 }}>KAS MASUK TERKUMPUL</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed' }}>{formatRp(totalKasAll)}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', letterSpacing: 0.5, marginBottom: 4 }}>STOK STANDBY BOOTH</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0891b2' }}>{totalActiveStock} pcs</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('active')}
          style={{
            padding: '8px 18px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: activeTab === 'active' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'active' ? '#fff' : '#64748b'
          }}
        >
          🟢 Booth Aktif ({activeBooths.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 18px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: activeTab === 'history' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'history' ? '#fff' : '#64748b'
          }}
        >
          ⚪ Riwayat Selesai ({historyBooths.length})
        </button>
      </div>

      {/* Booth Card Grid */}
      {displayedBooths.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20, border: '1px dashed #cbd5e1', color: '#94a3b8' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🎪</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>
            {activeTab === 'active' ? 'Tidak ada event booth yang sedang aktif' : 'Belum ada riwayat event booth yang selesai'}
          </div>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            {activeTab === 'active' ? 'Buka booth baru untuk memulai pameran atau bazar.' : 'Event yang telah selesai akan diarsipkan di sini.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {displayedBooths.map(booth => {
            const stockPcs = booth.stocks.reduce((sum: number, s: any) => sum + s.quantity, 0);
            const isAktif = booth.status === 'AKTIF';

            return (
              <div
                key={booth.id}
                style={{
                  background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}
              >
                {/* Header Card */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: isAktif ? 'linear-gradient(135deg, #f0fdf4, #fff)' : '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{booth.nama}</h3>
                      {booth.lokasi && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>📍 {booth.lokasi}</div>}
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: isAktif ? '#dcfce7' : '#e2e8f0',
                      color: isAktif ? '#15803d' : '#64748b'
                    }}>
                      {isAktif ? '🟢 AKTIF' : '⚪ SELESAI'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                    🗓️ {new Date(booth.tanggal_mulai).toLocaleDateString('id-ID')} s/d {new Date(booth.tanggal_selesai).toLocaleDateString('id-ID')}
                  </div>
                  {booth.pic && (
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 4, fontWeight: 600 }}>
                      👤 PIC: {booth.pic.nama} ({booth.pic.role || 'Staff'})
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>TOTAL OMSET</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>{formatRp(Number(booth.total_penjualan))}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>KAS MASUK</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{formatRp(Number(booth.kas_masuk))}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>SISA STOK FISIK</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#2563eb' }}>{stockPcs} pcs</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>PAKET BUNDLE</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed' }}>{booth.bundles.length} paket</div>
                  </div>
                </div>

                {/* Footer Action */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <button
                    onClick={() => setSelectedBooth(booth)}
                    style={{
                      width: '100%', padding: '9px', borderRadius: 10, border: 'none',
                      background: isAktif ? 'linear-gradient(135deg, #0f172a, #1e293b)' : '#e2e8f0',
                      color: isAktif ? '#fff' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    🔎 Kelola Booth &amp; Kasir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateBoothModal
          employees={employees}
          onClose={() => setShowCreateModal(false)}
          onSaved={mutate}
        />
      )}

      {selectedBooth && (
        <BoothDetailView
          booth={booths.find(b => b.id === selectedBooth.id) || selectedBooth}
          warehouses={warehouses}
          products={products}
          onClose={() => setSelectedBooth(null)}
          onRefresh={mutate}
        />
      )}
    </div>
  );
}
