'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Tabs } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import {
  setMarketingTarget,
  createPersonalBuyerTransaction,
  deletePersonalBuyerTransaction,
  createExpense,
  deleteExpense,
} from '@/app/actions';

function formatRp(val: number) { return formatCurrency(val); }

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// ─── STATUS BADGE ────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
    on_track: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', icon: '✅', label: 'On Track' },
    behind: { bg: '#fefce8', text: '#a16207', border: '#fde047', icon: '⚠️', label: 'Behind' },
    critical: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', icon: '🔴', label: 'Critical' },
  };
  const c = config[status] || config.on_track;
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {c.icon} {c.label}
    </span>
  );
}

// ─── PROGRESS BAR ────────────────────────────────────────
function ProgressBar({ value, color = '#3b82f6' }: { value: number; color?: string }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 999, height: 10, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${clamped}%`, background: `linear-gradient(90deg, ${color}, ${color}dd)`, height: '100%', borderRadius: 999, transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ─── SET TARGET MODAL ────────────────────────────────────
function SetTargetModal({ employee, currentMonth, currentYear, onClose, onSaved }: {
  employee: any; currentMonth: number; currentYear: number; onClose: () => void; onSaved: () => void;
}) {
  const [targetOmset, setTargetOmset] = useState(employee.target_omset || 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setMarketingTarget(employee.id, currentMonth, currentYear, Number(targetOmset));
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>🎯 Set Target Marketing</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
          {employee.nama} — {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </p>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Target Omset Bulanan (Rp)</label>
        <input
          type="number"
          value={targetOmset}
          onChange={e => setTargetOmset(Number(e.target.value))}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 16, fontWeight: 600, marginBottom: 20, outline: 'none', boxSizing: 'border-box' }}
          placeholder="Contoh: 50000000"
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>Batal</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Menyimpan...' : 'Simpan Target'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ADD PERSONAL BUYER MODAL (Dengan Dropdown Produk & Cek Stok Fisik Gudang) ───
function AddPersonalBuyerModal({ onClose, onSaved, products = [], warehouses = [] }: {
  onClose: () => void;
  onSaved: () => void;
  products?: any[];
  warehouses?: any[];
}) {
  const [buyerName, setBuyerName] = useState('');
  const [jenisProduk, setJenisProduk] = useState<'SATUAN' | 'PAKET'>('SATUAN');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [customPackageName, setCustomPackageName] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(warehouses[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(1);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || products[0];
  }, [selectedProductId, products]);

  // Sync price when product changes
  React.useEffect(() => {
    if (selectedProduct) {
      const base = Number(selectedProduct.base_price || 0);
      setPricePerUnit(base);
      setAmount(base * (quantity || 1));
    }
  }, [selectedProduct]);

  // Calculate available stock in selected warehouse
  const availableStock = useMemo(() => {
    if (!selectedProduct) return 0;
    if (selectedWarehouseId) {
      const ws = (selectedProduct.warehouse_stocks || []).find((w: any) => w.warehouse_id === selectedWarehouseId);
      return ws ? ws.quantity : 0;
    }
    return selectedProduct.stok || 0;
  }, [selectedProduct, selectedWarehouseId]);

  const isStockInsufficient = quantity > availableStock;

  const handleQtyChange = (val: number) => {
    const qty = Math.max(1, val);
    setQuantity(qty);
    if (pricePerUnit > 0) {
      setAmount(qty * pricePerUnit);
    }
  };

  const handlePricePerUnitChange = (val: number) => {
    setPricePerUnit(val);
    if (quantity > 0) {
      setAmount(quantity * val);
    }
  };

  const handleSave = async () => {
    if (!buyerName.trim()) { alert('Nama buyer wajib diisi'); return; }
    if (quantity <= 0) { alert('Jumlah stok yang dibeli harus lebih dari 0'); return; }
    if (amount <= 0) { alert('Harga nominal total harus lebih dari 0'); return; }

    if (isStockInsufficient) {
      alert(`Transaksi gagal: Stok tidak mencukupi!\nStok tersedia di gudang: ${availableStock} pcs\nJumlah diminta: ${quantity} pcs`);
      return;
    }

    setSaving(true);
    try {
      const finalProductName = jenisProduk === 'PAKET' && customPackageName.trim()
        ? `[Paket] ${customPackageName.trim()} (${selectedProduct?.name})`
        : selectedProduct?.name || 'Produk Personal';

      await createPersonalBuyerTransaction({
        buyer_name: buyerName.trim(),
        product_name: finalProductName,
        product_id: selectedProduct?.id,
        quantity,
        price_per_unit: pricePerUnit > 0 ? pricePerUnit : undefined,
        amount,
        description: description.trim() || (jenisProduk === 'PAKET' ? 'Paket Khusus Personal' : undefined),
        date,
        warehouse_id: selectedWarehouseId || undefined,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 500, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>👤 Input Transaksi Personal Buyer</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>
          Pilih produk katalog, jenis bundle, dan gudang asal. Stok otomatis divalidasi dan dipotong dari gudang.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Buyer Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Nama Pembeli / Buyer *</label>
            <input 
              value={buyerName} 
              onChange={e => setBuyerName(e.target.value)} 
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} 
              placeholder="Contoh: Pak Bambang / Bu Siti" 
            />
          </div>

          {/* Jenis Penjualan: Satuan vs Paket */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Jenis Penjualan</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => setJenisProduk('SATUAN')}
                style={{
                  padding: '8px 12px', borderRadius: 10, border: jenisProduk === 'SATUAN' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  background: jenisProduk === 'SATUAN' ? '#eff6ff' : '#fff', color: jenisProduk === 'SATUAN' ? '#1d4ed8' : '#64748b',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}
              >
                🏷️ Satuan (Pcs)
              </button>
              <button
                type="button"
                onClick={() => setJenisProduk('PAKET')}
                style={{
                  padding: '8px 12px', borderRadius: 10, border: jenisProduk === 'PAKET' ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                  background: jenisProduk === 'PAKET' ? '#f5f3ff' : '#fff', color: jenisProduk === 'PAKET' ? '#6d28d9' : '#64748b',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}
              >
                🎁 Paket / Bundle
              </button>
            </div>
          </div>

          {jenisProduk === 'PAKET' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', marginBottom: 4, display: 'block' }}>Nama Paket / Keterangan Bundle</label>
              <input
                value={customPackageName}
                onChange={e => setCustomPackageName(e.target.value)}
                placeholder="Contoh: Paket Keluarga Hemat 3 Rasa"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #ddd6fe', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          )}

          {/* Product Dropdown */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Pilih Produk Aktif *</label>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 600, outline: 'none', background: '#fff' }}
            >
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.short_name}) — Rp {Number(p.base_price).toLocaleString('id-ID')}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse Dropdown */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Gudang Asal Barang *</label>
            <select
              value={selectedWarehouseId}
              onChange={e => setSelectedWarehouseId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 600, outline: 'none', background: '#fff' }}
            >
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>
                  🏬 {w.name} ({w.type})
                </option>
              ))}
            </select>
          </div>

          {/* Stock Availability Pill */}
          <div style={{
            background: isStockInsufficient ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${isStockInsufficient ? '#fecaca' : '#bbf7d0'}`,
            padding: '8px 12px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: isStockInsufficient ? '#b91c1c' : '#15803d' }}>
              {isStockInsufficient ? '⚠️ Stok Gudang Kurang!' : '📦 Stok Tersedia di Gudang ini:'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: isStockInsufficient ? '#b91c1c' : '#15803d' }}>
              {availableStock} pcs
            </span>
          </div>

          {/* Qty & Unit Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Jumlah (Qty) *</label>
              <input 
                type="number" 
                min="1" 
                value={quantity} 
                onChange={e => handleQtyChange(Number(e.target.value))} 
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 10,
                  border: isStockInsufficient ? '2px solid #ef4444' : '1.5px solid #e2e8f0',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box'
                }} 
                placeholder="1" 
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Harga Satuan (Rp)</label>
              <input 
                type="number" 
                value={pricePerUnit || ''} 
                onChange={e => handlePricePerUnitChange(Number(e.target.value))} 
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} 
                placeholder="Misal: 25000" 
              />
            </div>
          </div>

          {/* Total Amount */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Total Nominal Pembayaran (Rp) *</label>
              {pricePerUnit > 0 && (
                <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                  ({quantity} pcs &times; {formatRp(pricePerUnit)})
                </span>
              )}
            </div>
            <input 
              type="number" 
              value={amount || ''} 
              onChange={e => setAmount(Number(e.target.value))} 
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #10b981', background: '#f0fdf4', fontSize: 15, fontWeight: 800, color: '#065f46', outline: 'none', boxSizing: 'border-box' }} 
              placeholder="Total nominal pembayaran" 
            />
          </div>

          {/* Date */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Tanggal Transaksi</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} 
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }}>Keterangan (opsional)</label>
            <input 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} 
              placeholder="Catatan / keterangan tambahan" 
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>Batal</button>
          <button
            onClick={handleSave}
            disabled={saving || isStockInsufficient}
            style={{
              padding: '8px 20px', borderRadius: 10, border: 'none',
              background: isStockInsufficient ? '#cbd5e1' : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: isStockInsufficient ? 'not-allowed' : saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? 'Menyimpan...' : isStockInsufficient ? 'Stok Kurang' : 'Simpan Transaksi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL DETAIL KARYAWAN MARKETING (Outlet, Pembayaran Masuk & Pengeluaran) ───
function MarketingDetailModal({ employee, onClose, onSaved }: { employee: any; onClose: () => void; onSaved: () => void }) {
  const [detailTab, setDetailTab] = useState<'outlets' | 'payments' | 'expenses' | 'personal'>('outlets');
  
  // Expense form state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState<number | ''>('');
  const [expCategory, setExpCategory] = useState('MARKETING');
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingExp, setSavingExp] = useState(false);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim()) { alert('Judul pengeluaran wajib diisi'); return; }
    if (!expAmount || Number(expAmount) <= 0) { alert('Nominal harus lebih dari 0'); return; }

    setSavingExp(true);
    try {
      await createExpense({
        title: expTitle.trim(),
        amount: Number(expAmount),
        category: expCategory,
        description: expDesc.trim() || undefined,
        date: expDate,
        employee_id: employee.id,
      });
      setShowAddExpense(false);
      setExpTitle('');
      setExpAmount('');
      setExpDesc('');
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Gagal mencatat pengeluaran');
    } finally {
      setSavingExp(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Hapus catatan pengeluaran ini?')) return;
    try {
      await deleteExpense(id);
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus pengeluaran');
    }
  };

  const outlets: any[] = employee.outlets || [];
  const payments: any[] = employee.outlet_payments_history || [];
  const expenses: any[] = employee.expenses || [];
  const personalTxns: any[] = employee.personal_buyer_transactions || [];

  const totalBilling = employee.total_billing_this_month || 0;
  const totalPayment = employee.total_payment_this_month || 0;
  const totalExpenses = employee.total_expenses_this_month || 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 24, maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20 }}>
              {employee.nama.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{employee.nama}</h2>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {employee.posisi || 'Marketing'} • {employee.no_hp || 'No HP -'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', fontWeight: 800, color: '#64748b' }}>✕</button>
        </div>

        {/* Dual Metric Highlights: Distribusi (Barang Keluar) vs Kas Masuk (Pembayaran) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', letterSpacing: 0.5 }}>REALISASI DISTRIBUSI (BILLING)</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#5b21b6', marginTop: 2 }}>{formatRp(totalBilling)}</div>
            <div style={{ fontSize: 10, color: '#6d28d9', marginTop: 1 }}>Total nilai barang dikirim ke outlet</div>
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', letterSpacing: 0.5 }}>KAS MASUK (PEMBAYARAN)</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#14532d', marginTop: 2 }}>{formatRp(totalPayment)}</div>
            <div style={{ fontSize: 10, color: '#166534', marginTop: 1 }}>Uang tunai/transfer disetor outlet</div>
          </div>

          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', letterSpacing: 0.5 }}>PENGELUARAN OPERASIONAL</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#991b1b', marginTop: 2 }}>{formatRp(totalExpenses)}</div>
            <div style={{ fontSize: 10, color: '#b91c1c', marginTop: 1 }}>Bensin, makan & biaya dinas</div>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e2e8f0', marginBottom: 16, overflowX: 'auto' }}>
          <button
            onClick={() => setDetailTab('outlets')}
            style={{
              padding: '8px 14px', border: 'none', background: 'transparent',
              borderBottom: detailTab === 'outlets' ? '2px solid #2563eb' : '2px solid transparent',
              color: detailTab === 'outlets' ? '#1d4ed8' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer'
            }}
          >
            🏪 Outlet Binaan ({outlets.length})
          </button>
          <button
            onClick={() => setDetailTab('payments')}
            style={{
              padding: '8px 14px', border: 'none', background: 'transparent',
              borderBottom: detailTab === 'payments' ? '2px solid #16a34a' : '2px solid transparent',
              color: detailTab === 'payments' ? '#15803d' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer'
            }}
          >
            💵 Riwayat Pembayaran Masuk ({payments.length})
          </button>
          <button
            onClick={() => setDetailTab('expenses')}
            style={{
              padding: '8px 14px', border: 'none', background: 'transparent',
              borderBottom: detailTab === 'expenses' ? '2px solid #dc2626' : '2px solid transparent',
              color: detailTab === 'expenses' ? '#b91c1c' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer'
            }}
          >
            📤 Pengeluaran ({expenses.length})
          </button>
          <button
            onClick={() => setDetailTab('personal')}
            style={{
              padding: '8px 14px', border: 'none', background: 'transparent',
              borderBottom: detailTab === 'personal' ? '2px solid #0891b2' : '2px solid transparent',
              color: detailTab === 'personal' ? '#0e7490' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer'
            }}
          >
            👤 Personal Buyer ({personalTxns.length})
          </button>
        </div>

        {/* Tab 1: Outlets */}
        {detailTab === 'outlets' && (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: 11, fontWeight: 700 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>OUTLET</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>WILAYAH</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>TAGIHAN (BILLING)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>DIBAYAR</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>SISA TAGIHAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outlets.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Belum ada outlet binaan</td></tr>
                  ) : outlets.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{o.nama}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{o.wilayah || '-'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{formatRp(o.tagihan)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{formatRp(o.payment)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: o.sisa_tagihan > 0 ? '#dc2626' : '#15803d' }}>
                        {formatRp(o.sisa_tagihan)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Payments History */}
        {detailTab === 'payments' && (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: 11, fontWeight: 700 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>TANGGAL</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>OUTLET</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>NOMINAL BAYAR</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>KETERANGAN / METODE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>SISA TAGIHAN SAAT INI</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Belum ada riwayat pembayaran outlet pada periode ini</td></tr>
                  ) : payments.map((pay: any) => (
                    <tr key={pay.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {new Date(pay.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{pay.outlet_nama}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#15803d' }}>
                        {formatRp(pay.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{pay.description || 'Pelunasan'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#b91c1c' }}>
                        {formatRp(pay.sisa_tagihan_outlet)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Expenses */}
        {detailTab === 'expenses' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Total Pengeluaran: <b style={{ color: '#b91c1c' }}>{formatRp(totalExpenses)}</b>
              </div>
              <button
                onClick={() => setShowAddExpense(!showAddExpense)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: showAddExpense ? '#f1f5f9' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: showAddExpense ? '#475569' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}
              >
                {showAddExpense ? 'Batal' : 'Catat Pengeluaran'}
              </button>
            </div>

            {showAddExpense && (
              <form onSubmit={handleAddExpense} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#991b1b', marginBottom: 10 }}>Form Catat Pengeluaran Personil</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 2 }}>Judul Biaya *</label>
                    <input
                      value={expTitle}
                      onChange={e => setExpTitle(e.target.value)}
                      placeholder="Contoh: Bensin motor kunjungan Malang"
                      style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, background: '#fff', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 2 }}>Nominal (Rp) *</label>
                    <input
                      type="number"
                      value={expAmount}
                      onChange={e => setExpAmount(Number(e.target.value))}
                      placeholder="50000"
                      style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, background: '#fff', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 2 }}>Tanggal</label>
                    <input
                      type="date"
                      value={expDate}
                      onChange={e => setExpDate(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, background: '#fff', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="submit"
                    disabled={savingExp}
                    style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: savingExp ? 'wait' : 'pointer' }}
                  >
                    {savingExp ? 'Menyimpan...' : 'Simpan Biaya'}
                  </button>
                </div>
              </form>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: 11, fontWeight: 700 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>TANGGAL</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>JUDUL BIAYA</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>NOMINAL</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>KATEGORI</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Belum ada catatan pengeluaran untuk personil ini</td></tr>
                  ) : expenses.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{e.title}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                        {formatRp(e.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{e.category}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Personal Buyer */}
        {detailTab === 'personal' && (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: 11, fontWeight: 700 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>TANGGAL</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>PEMBELI</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>PRODUK</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>QTY</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {personalTxns.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Belum ada transaksi personal buyer</td></tr>
                  ) : personalTxns.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{t.buyer_name}</td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{t.product_name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>{t.quantity} pcs</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#15803d' }}>{formatRp(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI CARD (reusable mini) ────────────────────────────
function KpiMini({ icon, label, value, color, sub }: { icon: string; label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: `${color}08`, borderRadius: 14, padding: '12px 14px', border: `1px solid ${color}22`, flex: '1 1 0', minWidth: 120 }}>
      <div style={{ fontSize: 10, color: `${color}cc`, fontWeight: 700, letterSpacing: 0.5, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span style={{ fontSize: 13 }}>{icon}</span> <span>{label}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: `${color}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ADMIN/OWNER: PERFORMANCE DASHBOARD TAB
// ═══════════════════════════════════════════════════════════
function PerformanceDashboard({ data, mutate, filterLabel }: { data: any; mutate: () => void; filterLabel?: string }) {
  const [targetModal, setTargetModal] = useState<any>(null);
  const [detailModal, setDetailModal] = useState<any>(null);
  const performance: any[] = data?.marketingPerformance || [];
  const currentMonth = data?.currentMonth || new Date().getMonth() + 1;
  const currentYear = data?.currentYear || new Date().getFullYear();

  // Overall summary
  const totalOmsetAll = performance.reduce((s: number, p: any) => s + p.total_omset_this_month, 0);
  const totalTargetAll = performance.reduce((s: number, p: any) => s + p.target_omset, 0);
  const totalOutletAll = performance.reduce((s: number, p: any) => s + p.outlet_count, 0);
  const totalPaymentAll = performance.reduce((s: number, p: any) => s + p.total_payment_this_month, 0);
  const totalOutstandingAll = performance.reduce((s: number, p: any) => s + p.total_outstanding_all, 0);
  const totalExpensesAll = performance.reduce((s: number, p: any) => s + (p.total_expenses_this_month || 0), 0);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Overall Summary Cards (Tanpa Omset Booth!) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <KpiMini icon="💰" label="TOTAL OMSET MARKETING" value={formatRp(totalOmsetAll)} color="#7c3aed" sub="Distribusi Outlet + Personal" />
        <KpiMini icon="💵" label="TOTAL KAS MASUK" value={formatRp(totalPaymentAll)} color="#15803d" sub="Pelunasan Outlet Disetor" />
        <KpiMini icon="🎯" label="TOTAL TARGET" value={formatRp(totalTargetAll)} color="#2563eb" />
        <KpiMini icon="🏪" label="OUTLET BINAAN" value={String(totalOutletAll)} color="#0891b2" />
        <KpiMini icon="📤" label="PENGELUARAN DINAS" value={formatRp(totalExpensesAll)} color="#dc2626" sub="Biaya Operasional Lapangan" />
        <KpiMini icon="📋" label="OUTSTANDING PIUTANG" value={formatRp(totalOutstandingAll)} color={totalOutstandingAll > 0 ? '#dc2626' : '#16a34a'} />
      </div>

      {/* Per-User Performance Cards */}
      <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span>👥</span> Performa Tim Marketing Offline — {filterLabel || `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`}
      </div>

      {performance.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: 16, color: '#94a3b8', fontSize: 14 }}>
          Belum ada karyawan dengan role Marketing yang aktif.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {performance.map((p: any) => (
            <div key={p.id} style={{
              background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              padding: 0, overflow: 'hidden', transition: 'box-shadow 0.2s', display: 'flex', flexDirection: 'column'
            }}>
              {/* Header */}
              <div style={{
                background: p.status === 'critical' ? 'linear-gradient(135deg, #fef2f2, #fee2e2)' : p.status === 'behind' ? 'linear-gradient(135deg, #fefce8, #fef3c7)' : 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #f1f5f9'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0
                  }}>
                    {p.nama.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{p.nama}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {p.outlet_count} outlet dikelola
                    </div>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>

              {/* Body */}
              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: '#475569' }}>Pencapaian Target</span>
                    <span style={{ fontWeight: 700, color: p.pencapaian >= 100 ? '#15803d' : p.pencapaian >= 50 ? '#ca8a04' : '#dc2626' }}>
                      {p.pencapaian.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={p.pencapaian} color={p.pencapaian >= 100 ? '#22c55e' : p.pencapaian >= 50 ? '#eab308' : '#ef4444'} />
                </div>

                {/* Stats Grid: Realisasi Distribusi vs Kas Masuk */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5 }}>TARGET BULANAN</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{p.target_omset > 0 ? formatRp(p.target_omset) : 'Belum diset'}</div>
                  </div>
                  <div style={{ background: '#f5f3ff', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700, letterSpacing: 0.5 }}>DISTRIBUSI (BILLING)</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#5b21b6' }}>{formatRp(p.total_billing_this_month)}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#15803d', fontWeight: 700, letterSpacing: 0.5 }}>KAS MASUK (BAYAR)</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#166534' }}>{formatRp(p.total_payment_this_month)}</div>
                  </div>
                  <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, letterSpacing: 0.5 }}>PENGELUARAN</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#b91c1c' }}>{formatRp(p.total_expenses_this_month || 0)}</div>
                  </div>
                </div>

                {/* Gap */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: p.gap >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 10, padding: '8px 12px',
                  border: `1px solid ${p.gap >= 0 ? '#bbf7d0' : '#fecaca'}`
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: p.gap >= 0 ? '#15803d' : '#b91c1c' }}>
                    {p.gap >= 0 ? '✅ Surplus Target' : '⚠️ Gap Target'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: p.gap >= 0 ? '#15803d' : '#b91c1c' }}>
                    {p.gap >= 0 ? '+' : '-'}{formatRp(Math.abs(p.gap))}
                  </span>
                </div>
              </div>

              {/* Footer action */}
              <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 16px', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setDetailModal(p)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#2563eb' }}
                >
                  🔍 Detail &amp; Keuangan
                </button>
                <button
                  onClick={() => setTargetModal(p)}
                  style={{ padding: '8px 12px', borderRadius: 10, border: '1px dashed #cbd5e1', background: '#fafafa', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}
                >
                  🎯 Target
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {targetModal && (
        <SetTargetModal
          employee={targetModal}
          currentMonth={currentMonth}
          currentYear={currentYear}
          onClose={() => setTargetModal(null)}
          onSaved={mutate}
        />
      )}

      {detailModal && (
        <MarketingDetailModal
          employee={detailModal}
          onClose={() => setDetailModal(null)}
          onSaved={mutate}
        />
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// ADMIN/OWNER: DISTRIBUTOR TAB (Dengan Filter Area)
// ═══════════════════════════════════════════════════════════
function DistributorTab({ data }: { data: any }) {
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [selectedDistributorModal, setSelectedDistributorModal] = useState<any>(null);

  const distributors: any[] = data?.distributorPerformance || [];

  // Extract unique areas
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    distributors.forEach(d => {
      if (d.wilayah && d.wilayah !== 'Umum') set.add(d.wilayah);
    });
    return Array.from(set);
  }, [distributors]);

  const filteredDistributors = useMemo(() => {
    if (areaFilter === 'ALL') return distributors;
    return distributors.filter(d => (d.wilayah || '').toLowerCase() === areaFilter.toLowerCase());
  }, [distributors, areaFilter]);

  const totalDistributors = filteredDistributors.length;
  const totalStokGudangAll = filteredDistributors.reduce((sum, d) => sum + (d.total_stok_gudang || 0), 0);
  const totalBillingAll = filteredDistributors.reduce((sum, d) => sum + (d.total_billing_this_month || 0), 0);
  const totalPaymentAll = filteredDistributors.reduce((sum, d) => sum + (d.total_payment_this_month || 0), 0);
  const totalSisaTagihanAll = filteredDistributors.reduce((sum, d) => sum + (d.total_sisa_tagihan || 0), 0);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Filter Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            🏢 Manajemen &amp; Performa Distributor
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
            Monitoring stok di gudang distributor, pergerakan outlet distribusi, dan setoran kas
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>📍 Filter Area:</span>
          <select
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: 13, fontWeight: 700, background: '#fff', color: '#1e293b' }}
          >
            <option value="ALL">Semua Wilayah ({distributors.length})</option>
            {uniqueAreas.map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary KPI Cards (Tanpa Omset Booth & Total Target) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <KpiMini icon="🏢" label="TOTAL DISTRIBUTOR" value={`${totalDistributors} Mitra`} color="#2563eb" />
        <KpiMini icon="📦" label="STOK DI DISTRIBUTOR" value={`${totalStokGudangAll} pcs`} color="#0891b2" sub="Stok aktif di gudang mitra" />
        <KpiMini icon="📤" label="DISTRIBUSI PRODUK (BILLING)" value={formatRp(totalBillingAll)} color="#7c3aed" sub="Nilai invoice pengiriman" />
        <KpiMini icon="💵" label="KAS MASUK DISETOR" value={formatRp(totalPaymentAll)} color="#15803d" sub="Dana cair diterima" />
        <KpiMini icon="📋" label="SISA TAGIHAN DISTRIBUSI" value={formatRp(totalSisaTagihanAll)} color={totalSisaTagihanAll > 0 ? '#dc2626' : '#16a34a'} />
      </div>

      {/* Distributors Grid */}
      {filteredDistributors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', background: '#f8fafc', borderRadius: 16, color: '#94a3b8' }}>
          Belum ada data distributor untuk filter wilayah ini. Daftarkan distributor baru melalui menu <b>Karyawan &gt; Database Distributor</b> atau modul <b>Warehouse</b>.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filteredDistributors.map((dist: any) => (
            <div key={dist.id} style={{ background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', padding: '16px 20px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#1e3a8a' }}>{dist.nama}</div>
                  <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>📍 Wilayah: {dist.wilayah || 'Umum'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#2563eb', color: '#fff' }}>
                  Distributor
                </span>
              </div>

              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>STOK GUDANG</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>{dist.total_stok_gudang} pcs</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>OUTLET DIKELOLA</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>{dist.outlet_count} Outlet</div>
                  </div>
                  <div style={{ background: '#f5f3ff', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700 }}>DISTRIBUSI (BILLING)</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#5b21b6' }}>{formatRp(dist.total_billing_this_month)}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#15803d', fontWeight: 700 }}>KAS DISETOR</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#166534' }}>{formatRp(dist.total_payment_this_month)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Sisa Tagihan Konsinyasi:</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: dist.total_sisa_tagihan > 0 ? '#dc2626' : '#15803d' }}>
                    {formatRp(dist.total_sisa_tagihan)}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 16px' }}>
                <button
                  onClick={() => setSelectedDistributorModal(dist)}
                  style={{ width: '100%', padding: '8px', borderRadius: 10, border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  🔍 Rincian Outlet &amp; Gudang Distributor
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Distributor Detail Modal */}
      {selectedDistributorModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 24, maxWidth: 650, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>{selectedDistributorModal.nama}</h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>📍 Wilayah: {selectedDistributorModal.wilayah} • No HP: {selectedDistributorModal.no_hp || '-'}</div>
              </div>
              <button onClick={() => setSelectedDistributorModal(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a', marginBottom: 8 }}>🏬 Fasilitas Gudang Distributor:</div>
              {(!selectedDistributorModal.warehouses || selectedDistributorModal.warehouses.length === 0) ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Belum ada gudang distributor terdaftar</div>
              ) : selectedDistributorModal.warehouses.map((w: any) => (
                <div key={w.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
                    <span>{w.name}</span>
                    <span style={{ color: '#2563eb' }}>{w.total_stock} pcs</span>
                  </div>
                  {w.address && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{w.address}</div>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {(w.stocks || []).map((s: any, idx: number) => (
                      <span key={idx} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {s.product_name}: {s.quantity} pcs
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a', marginBottom: 8 }}>
                🏪 Daftar Outlet Jaringan ({selectedDistributorModal.outlets?.length || 0}):
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>NAMA OUTLET</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>TAGIHAN</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>BAYAR</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>SISA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedDistributorModal.outlets || []).map((o: any) => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{o.nama}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatRp(o.tagihan)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#15803d', fontWeight: 700 }}>{formatRp(o.payment)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: o.sisa_tagihan > 0 ? '#dc2626' : '#15803d', fontWeight: 700 }}>{formatRp(o.sisa_tagihan)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// ADMIN/OWNER: PERSONAL BUYER TAB
// ═══════════════════════════════════════════════════════════
function PersonalBuyerTab({ data, mutate }: { data: any; mutate: () => void }) {
  const performance: any[] = data?.marketingPerformance || [];
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const allTransactions = useMemo(() => {
    const txns: any[] = [];
    performance.forEach(p => {
      p.personal_buyer_transactions.forEach((t: any) => {
        txns.push({ ...t, marketing_name: p.nama, employee_id: p.id });
      });
    });
    return txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [performance]);

  const filtered = filterEmployee === 'all' ? allTransactions : allTransactions.filter(t => t.employee_id === filterEmployee);

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus transaksi ini?')) return;
    setDeleting(id);
    try {
      await deletePersonalBuyerTransaction(id);
      mutate();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Filter Marketing:</span>
          <select
            value={filterEmployee}
            onChange={e => setFilterEmployee(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', background: '#fff' }}
          >
            <option value="all">Semua Marketing ({allTransactions.length} transaksi)</option>
            {performance.map(p => (
              <option key={p.id} value={p.id}>{p.nama} ({p.personal_buyer_transactions.length})</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '8px 18px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(16,185,129,0.25)'
          }}
        >
          Input Personal Buyer Baru
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>TANGGAL</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>BUYER</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>MARKETING</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>PRODUK</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>STOK (QTY)</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>HARGA SATUAN</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>TOTAL NOMINAL</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>KETERANGAN</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '30px 14px', textAlign: 'center', color: '#94a3b8' }}>Belum ada transaksi personal buyer</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{new Date(t.date).toLocaleDateString('id-ID')}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{t.buyer_name}</td>
                  <td style={{ padding: '10px 14px', color: '#3b82f6', fontWeight: 600 }}>{t.marketing_name}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>{t.product_name || '-'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>{t.quantity ? `${t.quantity} pcs` : '1 pcs'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b' }}>{t.price_per_unit ? formatRp(t.price_per_unit) : '-'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>{formatRp(t.amount)}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{t.description || '-'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                      style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: deleting === t.id ? 'wait' : 'pointer' }}
                      title="Hapus Transaksi"
                    >
                      {deleting === t.id ? 'Loading...' : 'Hapus'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddPersonalBuyerModal
          onClose={() => setShowAddModal(false)}
          onSaved={mutate}
          products={data?.products}
          warehouses={data?.warehouses}
        />
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// MARKETING USER: MY DASHBOARD (Isolated untuk Role Marketing)
// ═══════════════════════════════════════════════════════════
function MarketingMyDashboard({ data, mutate, filterLabel }: { data: any; mutate: () => void; filterLabel?: string }) {
  const p = data?.myPerformance;
  const currentMonth = data?.currentMonth || new Date().getMonth() + 1;
  const currentYear = data?.currentYear || new Date().getFullYear();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  if (!p) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Data performance Anda belum tersedia.</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Pastikan akun Anda telah dikaitkan dengan outlet oleh Admin.</div>
      </div>
    );
  }

  const handleDeletePB = async (id: string) => {
    if (!confirm('Hapus transaksi ini?')) return;
    setDeleting(id);
    try {
      await deletePersonalBuyerTransaction(id);
      mutate();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI Cards: Distribusi vs Kas Masuk */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <KpiMini icon="🎯" label="TARGET BULAN INI" value={p.target_omset > 0 ? formatRp(p.target_omset) : 'Belum diset'} color="#2563eb" />
        <KpiMini icon="📦" label="REALISASI DISTRIBUSI (BILLING)" value={formatRp(p.total_billing_this_month)} color="#7c3aed" sub="Nilai barang ke outlet" />
        <KpiMini icon="💵" label="KAS MASUK (PEMBAYARAN)" value={formatRp(p.total_payment_this_month)} color="#15803d" sub="Pelunasan disetor" />
        <KpiMini icon="📤" label="PENGELUARAN DINAS" value={formatRp(p.total_expenses_this_month || 0)} color="#dc2626" sub="Biaya operasional" />
        <KpiMini icon="👤" label="PERSONAL BUYER" value={formatRp(p.personal_buyer_this_month)} color="#0891b2" />
        <KpiMini icon="📋" label="OUTSTANDING SISA TAGIHAN" value={formatRp(p.total_outstanding_all)} color={p.total_outstanding_all > 0 ? '#dc2626' : '#16a34a'} />
      </div>

      {/* Progress & Quick Action */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Pencapaian Target {filterLabel || `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`}</span>
            <span style={{ fontWeight: 800, color: p.pencapaian >= 100 ? '#15803d' : p.pencapaian >= 50 ? '#ca8a04' : '#dc2626' }}>{p.pencapaian.toFixed(1)}%</span>
          </div>
          <ProgressBar value={p.pencapaian} color={p.pencapaian >= 100 ? '#22c55e' : p.pencapaian >= 50 ? '#eab308' : '#ef4444'} />
        </div>
        <button
          onClick={() => setShowDetailModal(true)}
          style={{ padding: '8px 18px', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8', border: '1.5px solid #bfdbfe', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          🔍 Lihat Rincian &amp; Catat Pengeluaran
        </button>
      </div>

      {/* Outlet Summary */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🏪</span> Outlet Saya ({(p.outlets || []).length})
        </div>
        {(!p.outlets || p.outlets.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: 14, color: '#94a3b8', fontSize: 13 }}>
            Belum ada outlet yang ditugaskan kepada Anda.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {(p.outlets || []).map((o: any) => (
              <div key={o.id} style={{
                background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{o.nama}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                    background: o.status === 'Active' || o.status === 'Aktif' ? '#dcfce7' : '#fee2e2',
                    color: o.status === 'Active' || o.status === 'Aktif' ? '#15803d' : '#b91c1c',
                  }}>{o.status || 'Aktif'}</span>
                </div>
                {o.wilayah && <div style={{ fontSize: 11, color: '#94a3b8' }}>📍 {o.wilayah}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontWeight: 600 }}>Tagihan</div>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{formatRp(o.tagihan)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontWeight: 600 }}>Bayar</div>
                    <div style={{ fontWeight: 700, color: '#15803d' }}>{formatRp(o.payment)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontWeight: 600 }}>Sisa</div>
                    <div style={{ fontWeight: 700, color: o.sisa_tagihan > 0 ? '#dc2626' : '#15803d' }}>{formatRp(o.sisa_tagihan)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Personal Buyer Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>👤</span> Transaksi Personal Buyer Saya
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            Input Personal Buyer
          </button>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>TANGGAL</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>BUYER</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>PRODUK</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>STOK (QTY)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>HARGA SATUAN</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>TOTAL NOMINAL</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>KETERANGAN</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {(!p.personal_buyer_transactions || p.personal_buyer_transactions.length === 0) ? (
                  <tr><td colSpan={8} style={{ padding: '24px 14px', textAlign: 'center', color: '#94a3b8' }}>Belum ada transaksi personal buyer</td></tr>
                ) : p.personal_buyer_transactions.map((t: any) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{new Date(t.date).toLocaleDateString('id-ID')}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{t.buyer_name}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>{t.product_name || '-'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>{t.quantity ? `${t.quantity} pcs` : '1 pcs'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b' }}>{t.price_per_unit ? formatRp(t.price_per_unit) : '-'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>{formatRp(t.amount)}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{t.description || '-'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeletePB(t.id)}
                        disabled={deleting === t.id}
                        style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: deleting === t.id ? 'wait' : 'pointer' }}
                        title="Hapus Transaksi"
                      >
                        {deleting === t.id ? '⏳' : '🗑️'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddPersonalBuyerModal
          onClose={() => setShowAddModal(false)}
          onSaved={mutate}
          products={data?.products}
          warehouses={data?.warehouses}
        />
      )}

      {showDetailModal && (
        <MarketingDetailModal
          employee={p}
          onClose={() => setShowDetailModal(false)}
          onSaved={mutate}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN MARKETING OFFLINE PAGE
// ═══════════════════════════════════════════════════════════
export default function MarketingPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    };
  });
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>(dateRange);

  const apiUrl = useMemo(() => {
    if (appliedDateRange?.from && appliedDateRange?.to) {
      const fromStr = format(appliedDateRange.from, 'yyyy-MM-dd');
      const toStr = format(appliedDateRange.to, 'yyyy-MM-dd');
      return `/api/data/marketing?startDate=${fromStr}&endDate=${toStr}`;
    }
    return '/api/data/marketing';
  }, [appliedDateRange]);

  const { data, isLoading, error, mutate } = useSWR(apiUrl);
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  const filterLabel = useMemo(() => {
    if (!appliedDateRange?.from) return 'Lifetime (Semua Waktu)';
    
    const fromDate = appliedDateRange.from;
    const toDate = appliedDateRange.to || fromDate;
    
    const isFullMonth = 
      fromDate.getDate() === 1 && 
      toDate.getDate() === new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0).getDate() &&
      fromDate.getMonth() === toDate.getMonth() &&
      fromDate.getFullYear() === toDate.getFullYear();

    if (isFullMonth) {
      return fromDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }
    
    const fromStr = fromDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const toStr = toDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fromStr} - ${toStr}`;
  }, [appliedDateRange]);

  if (!isMounted) return null;

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data marketing offline...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', background: '#fef2f2', borderRadius: 16, margin: '24px 0' }}>
        <h3 style={{ color: '#b91c1c', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Gagal Memuat Data Marketing Offline</h3>
        <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>Terjadi kesalahan saat mengambil data dari server. Silakan coba muat ulang halaman (F5).</p>
      </div>
    );
  }

  const userRole = (data?.userRole || '').toUpperCase();
  const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN';
  const isDistributor = userRole === 'DISTRIBUTOR' || userRole.includes('DISTRIBUTOR');

  const filterToolbar = (
    <div className="marketing-filter-toolbar">
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Marketing Offline</h2>
        <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Menampilkan data distribusi konsinyasi &amp; penjualan langsung untuk: <b>{filterLabel}</b>
        </div>
      </div>

      <div className="marketing-filter-actions">
        <DateRangePicker date={dateRange} setDate={setDateRange} />

        <button
          onClick={() => setAppliedDateRange(dateRange)}
          className="overview-filter-btn"
        >
          Tampilkan
        </button>
      </div>
    </div>
  );

  // ─── ADMIN/OWNER VIEW ──────────────────────
  if (isOwnerOrAdmin) {
    const tabs = [
      {
        id: 'performance',
        label: '📊 Performance Marketing Offline',
        content: <PerformanceDashboard data={data} mutate={mutate} filterLabel={filterLabel} />,
      },
      {
        id: 'distributor',
        label: `🏢 Distributor (${data?.distributorPerformance?.length || 0})`,
        content: <DistributorTab data={data} />,
      },
      {
        id: 'personal-buyer',
        label: '👤 Personal Buyer',
        content: <PersonalBuyerTab data={data} mutate={mutate} />,
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {filterToolbar}
        <Tabs tabs={tabs} />
      </div>
    );
  }

  // ─── DISTRIBUTOR ROLE VIEW ──────────────────
  if (isDistributor) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {filterToolbar}
        <DistributorTab data={data} />
      </div>
    );
  }

  // ─── MARKETING USER VIEW ──────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {filterToolbar}
      <MarketingMyDashboard data={data} mutate={mutate} filterLabel={filterLabel} />
    </div>
  );
}
