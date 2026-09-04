'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Tabs } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { setMarketingTarget, createPersonalBuyerTransaction, deletePersonalBuyerTransaction } from '@/app/actions';

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
            {saving ? '⏳ Menyimpan...' : '💾 Simpan Target'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ADD PERSONAL BUYER MODAL ────────────────────────────
function AddPersonalBuyerModal({ onClose, onSaved, products = [] }: { onClose: () => void; onSaved: () => void; products?: any[] }) {
  const [buyerName, setBuyerName] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

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
    if (!productName.trim()) { alert('Nama produk wajib diisi'); return; }
    if (quantity <= 0) { alert('Jumlah stok yang dibeli harus lebih dari 0'); return; }
    if (amount <= 0) { alert('Harga nominal total harus lebih dari 0'); return; }
    setSaving(true);
    try {
      await createPersonalBuyerTransaction({ 
        buyer_name: buyerName.trim(), 
        product_name: productName.trim(),
        quantity,
        price_per_unit: pricePerUnit > 0 ? pricePerUnit : undefined,
        amount, 
        description: description.trim() || undefined, 
        date 
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
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>👤 Input Transaksi Personal Buyer</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>
          Penjualan langsung ke pembeli personal memiliki harga mandiri (tidak mengikuti harga database).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Buyer Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Nama Pembeli / Buyer *</label>
            <input 
              value={buyerName} 
              onChange={e => setBuyerName(e.target.value)} 
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} 
              placeholder="Contoh: Pak Bambang / Bu Siti" 
            />
          </div>

          {/* Product Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Nama Produk *</label>
            <input 
              list="marketing-products-datalist"
              value={productName} 
              onChange={e => setProductName(e.target.value)} 
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} 
              placeholder="Pilih atau ketik nama produk..." 
            />
            <datalist id="marketing-products-datalist">
              {products.map((p: any) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, display: 'block' }}>
              💡 Bisa pilih produk dari saran katalog atau ketik nama produk custom / paket khusus.
            </span>
          </div>

          {/* Qty & Unit Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Jumlah Stok (Qty) *</label>
              <input 
                type="number" 
                min="1" 
                value={quantity} 
                onChange={e => handleQtyChange(Number(e.target.value))} 
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} 
                placeholder="1" 
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Harga Satuan (Rp)</label>
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
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Total Harga Nominal (Rp) *</label>
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
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #10b981', background: '#f0fdf4', fontSize: 15, fontWeight: 700, color: '#065f46', outline: 'none', boxSizing: 'border-box' }} 
              placeholder="Total nominal pembayaran" 
            />
          </div>

          {/* Date */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Tanggal Transaksi</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} 
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Keterangan (opsional)</label>
            <input 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} 
              placeholder="Catatan / keterangan tambahan" 
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>Batal</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳ Menyimpan...' : '✅ Simpan Transaksi'}
          </button>
        </div>
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
function PerformanceDashboard({ data, mutate }: { data: any; mutate: () => void }) {
  const [targetModal, setTargetModal] = useState<any>(null);
  const performance: any[] = data?.marketingPerformance || [];
  const currentMonth = data?.currentMonth || new Date().getMonth() + 1;
  const currentYear = data?.currentYear || new Date().getFullYear();

  // Overall summary
  const totalOmsetAll = performance.reduce((s: number, p: any) => s + p.total_omset_this_month, 0);
  const totalTargetAll = performance.reduce((s: number, p: any) => s + p.target_omset, 0);
  const totalOutletAll = performance.reduce((s: number, p: any) => s + p.outlet_count, 0);
  const totalOutstandingAll = performance.reduce((s: number, p: any) => s + p.total_outstanding_all, 0);
  const totalBoothSalesAll = data?.totalBoothSalesAll || 0;
  const activeBoothCount = data?.activeBoothCount || 0;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Overall Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <KpiMini icon="💰" label="TOTAL OMSET MARKETING" value={formatRp(totalOmsetAll)} color="#7c3aed" sub="Outlet + Personal Buyer" />
        <KpiMini icon="🎯" label="TOTAL TARGET" value={formatRp(totalTargetAll)} color="#2563eb" />
        <KpiMini icon="🏪" label="OUTLET DIKELOLA" value={String(totalOutletAll)} color="#0891b2" />
        <KpiMini icon="🎪" label="OMSET BOOTH (CASHFLOW)" value={formatRp(totalBoothSalesAll)} color="#059669" sub={`Cashflow PT (${activeBoothCount} booth aktif)`} />
        <KpiMini icon="📋" label="OUTSTANDING OUTLET" value={formatRp(totalOutstandingAll)} color={totalOutstandingAll > 0 ? '#dc2626' : '#16a34a'} />
      </div>

      {/* Per-User Performance Cards */}
      <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span>👥</span> Performa Tim Marketing — {MONTH_NAMES[currentMonth - 1]} {currentYear}
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
                      {p.outlet_count} outlet dikelola {p.booth_count > 0 ? `• ${p.booth_count} booth` : ''}
                    </div>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>

              {/* Body */}
              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
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

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5 }}>TARGET</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{p.target_omset > 0 ? formatRp(p.target_omset) : 'Belum diset'}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5 }}>OMSET MARKETING</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{formatRp(p.total_omset_this_month)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5 }}>BILLING OUTLET</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed' }}>{formatRp(p.total_billing_this_month)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5 }}>PERSONAL BUYER</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0891b2' }}>{formatRp(p.personal_buyer_this_month)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5 }}>BOOTH (CASHFLOW PT)</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>{formatRp(p.booth_sales_this_month || 0)}</div>
                  </div>
                </div>

                {/* Gap */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: p.gap >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 10, padding: '10px 14px',
                  border: `1px solid ${p.gap >= 0 ? '#bbf7d0' : '#fecaca'}`
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: p.gap >= 0 ? '#15803d' : '#b91c1c' }}>
                    {p.gap >= 0 ? '✅ Surplus' : '⚠️ Gap'}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: p.gap >= 0 ? '#15803d' : '#b91c1c' }}>
                    {p.gap >= 0 ? '+' : '-'}{formatRp(Math.abs(p.gap))}
                  </span>
                </div>

                {/* Outstanding */}
                {p.total_outstanding_all > 0 && (
                  <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '8px 12px', border: '1px solid #fecaca' }}>
                    💳 Outstanding seluruh outlet: <b>{formatRp(p.total_outstanding_all)}</b>
                  </div>
                )}

                {/* Managed Booths Summary */}
                {p.managed_booths && p.managed_booths.length > 0 && (
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 12px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 10, color: '#166534', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>
                      🎪 EVENT BOOTH DI-HANDLE ({p.managed_booths.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {p.managed_booths.map((b: any) => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{b.nama}</span>
                          <span style={{ fontWeight: 700, color: '#15803d' }}>{formatRp(b.total_penjualan)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer action */}
              <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 20px' }}>
                <button
                  onClick={() => setTargetModal(p)}
                  style={{ width: '100%', padding: '8px', borderRadius: 10, border: '1.5px dashed #cbd5e1', background: '#fafafa', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}
                  onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#f1f5f9'; (e.target as HTMLButtonElement).style.borderColor = '#94a3b8'; }}
                  onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#fafafa'; (e.target as HTMLButtonElement).style.borderColor = '#cbd5e1'; }}
                >
                  🎯 {p.target_omset > 0 ? 'Ubah' : 'Set'} Target Bulan Ini
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
            style={{ padding: '6px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}
          >
            <option value="all">Semua Marketing</option>
            {performance.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ➕ Input Personal Buyer
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }} className="no-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 550 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' }}>TANGGAL</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' }}>NAMA BUYER</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11, letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' }}>NOMINAL</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' }}>MARKETING</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' }}>KETERANGAN</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11, letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>Belum ada transaksi personal buyer</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', color: '#334155' }}>{new Date(t.date).toLocaleDateString('id-ID')}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#0f172a' }}>{t.buyer_name}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{formatRp(t.amount)}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{t.marketing_name}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#64748b', fontSize: 12 }}>{t.description || '-'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                      style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: deleting === t.id ? 'wait' : 'pointer' }}
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

      {showAddModal && <AddPersonalBuyerModal onClose={() => setShowAddModal(false)} onSaved={mutate} />}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// ADMIN/OWNER: E-COMMERCE TAB (Legacy Online Reports)
// ═══════════════════════════════════════════════════════════
function ECommerceTab({ data }: { data: any }) {
  const onlineReports: any[] = data?.onlineReports || [];
  const globalShopeeTarget = data?.globalShopeeTarget || 0;
  const globalTiktokTarget = data?.globalTiktokTarget || 0;

  const shopeeReports = onlineReports.filter((r: any) => r.platform?.toLowerCase() === 'shopee');
  const tiktokReports = onlineReports.filter((r: any) => r.platform?.toLowerCase() === 'tiktok');

  const shopeeOmsetMtd = shopeeReports.reduce((sum: number, r: any) => sum + Number(r.omset_harian), 0);
  const tiktokOmsetMtd = tiktokReports.reduce((sum: number, r: any) => sum + Number(r.omset_harian), 0);

  const shopeePersentase = globalShopeeTarget > 0 ? (shopeeOmsetMtd / globalShopeeTarget) * 100 : 0;
  const tiktokPersentase = globalTiktokTarget > 0 ? (tiktokOmsetMtd / globalTiktokTarget) * 100 : 0;

  return (
    <section className="flex flex-col gap-5 w-full">
      {/* Cards Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Shopee Card */}
        <div className="bg-gradient-to-br from-orange-50/80 to-amber-100/60 rounded-2xl p-4 sm:p-5 border border-orange-200 shadow-xs flex flex-col justify-between gap-3.5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-200/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛍️</span>
              <div>
                <h4 className="text-base sm:text-lg font-black text-orange-950 leading-tight">Shopee</h4>
                <span className="text-[11px] font-semibold text-orange-700/80">Marketplace Online</span>
              </div>
            </div>
            <div className="bg-orange-200/70 text-orange-900 border border-orange-300/80 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap">
              Target: {globalShopeeTarget > 0 ? formatRp(globalShopeeTarget) : 'Belum diset'}
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-orange-900 mb-1.5">
              <span>Pencapaian MTD</span>
              <span className="font-extrabold">{shopeePersentase.toFixed(1)}%</span>
            </div>
            <ProgressBar value={shopeePersentase} color="#ea580c" />
          </div>

          {/* Stats Grid: On mobile each is full width row, on sm+ 3 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-orange-100 flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1">
              <div className="text-[10px] sm:text-[11px] text-orange-600 font-bold uppercase tracking-wider">OMSET MTD</div>
              <div className="text-sm sm:text-base font-black text-orange-950 whitespace-nowrap">{formatRp(shopeeOmsetMtd)}</div>
            </div>

            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-orange-100 flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1">
              <div className="text-[10px] sm:text-[11px] text-orange-600 font-bold uppercase tracking-wider">PENCAPAIAN</div>
              <div className="text-sm sm:text-base font-black text-orange-950 whitespace-nowrap">{shopeePersentase.toFixed(1)}%</div>
            </div>

            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-orange-100 flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1">
              <div className="text-[10px] sm:text-[11px] text-orange-600 font-bold uppercase tracking-wider">GAP TARGET</div>
              <div className={`text-sm sm:text-base font-black whitespace-nowrap ${(shopeeOmsetMtd - globalShopeeTarget) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(shopeeOmsetMtd - globalShopeeTarget) >= 0 ? '+' : '-'}{formatRp(Math.abs(shopeeOmsetMtd - globalShopeeTarget))}
              </div>
            </div>
          </div>
        </div>

        {/* TikTok Card */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/90 rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between gap-3.5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎵</span>
              <div>
                <h4 className="text-base sm:text-lg font-black text-slate-900 leading-tight">TikTok Shop</h4>
                <span className="text-[11px] font-semibold text-slate-500">Social Commerce</span>
              </div>
            </div>
            <div className="bg-slate-200/80 text-slate-800 border border-slate-300 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap">
              Target: {globalTiktokTarget > 0 ? formatRp(globalTiktokTarget) : 'Belum diset'}
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <span>Pencapaian MTD</span>
              <span className="font-extrabold">{tiktokPersentase.toFixed(1)}%</span>
            </div>
            <ProgressBar value={tiktokPersentase} color="#0f172a" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-slate-200 flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1">
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider">OMSET MTD</div>
              <div className="text-sm sm:text-base font-black text-slate-900 whitespace-nowrap">{formatRp(tiktokOmsetMtd)}</div>
            </div>

            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-slate-200 flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1">
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider">PENCAPAIAN</div>
              <div className="text-sm sm:text-base font-black text-slate-900 whitespace-nowrap">{tiktokPersentase.toFixed(1)}%</div>
            </div>

            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-slate-200 flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1">
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider">GAP TARGET</div>
              <div className={`text-sm sm:text-base font-black whitespace-nowrap ${(tiktokOmsetMtd - globalTiktokTarget) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(tiktokOmsetMtd - globalTiktokTarget) >= 0 ? '+' : '-'}{formatRp(Math.abs(tiktokOmsetMtd - globalTiktokTarget))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Online History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📋</span> History Laporan Harian E-Commerce
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Daftar transaksi harian Shopee dan TikTok yang telah dilaporkan</p>
          </div>
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap">
            {onlineReports.length} Laporan
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-3 sm:px-4 sm:py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">TANGGAL</th>
                <th className="p-3 sm:px-4 sm:py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">PLATFORM</th>
                <th className="p-3 sm:px-4 sm:py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">OMSET HARIAN</th>
                <th className="p-3 sm:px-4 sm:py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">PELAPOR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {onlineReports.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    <div className="text-2xl mb-1">🛒</div>
                    Belum ada data laporan penjualan e-commerce.
                  </td>
                </tr>
              ) : (
                onlineReports.slice(0, 50).map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 sm:px-4 sm:py-3 font-medium text-slate-700 whitespace-nowrap">
                      {new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-3 sm:px-4 sm:py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                        r.platform?.toLowerCase() === 'shopee'
                          ? 'bg-orange-100 text-orange-700 border border-orange-200'
                          : 'bg-slate-100 text-slate-800 border border-slate-300'
                      }`}>
                        {r.platform?.toLowerCase() === 'shopee' ? '🛍️ Shopee' : '🎵 TikTok'}
                      </span>
                    </td>
                    <td className="p-3 sm:px-4 sm:py-3 text-right font-black text-slate-900 whitespace-nowrap">
                      {formatRp(Number(r.omset_harian))}
                    </td>
                    <td className="p-3 sm:px-4 sm:py-3 text-slate-600 whitespace-nowrap">
                      <span className="text-xs font-semibold">{r.employee ? r.employee.nama : 'Sistem'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// ADMIN: EVENT & BOOTH TAB
// ═══════════════════════════════════════════════════════════
function EventBoothTab({ data }: { data: any }) {
  const booths: any[] = data?.eventBooths || [];
  const totalBoothSalesAll = data?.totalBoothSalesAll || 0;
  const totalBoothKasAll = data?.totalBoothKasAll || 0;
  const activeBoothCount = data?.activeBoothCount || 0;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Financial Flow Explanation Alert */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 18px' }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span>💡</span> Relasi Finansial &amp; Omset Event Booth ke Marketing
        </div>
        <div style={{ fontSize: 12, color: '#15803d', lineHeight: 1.5 }}>
          <b>1. Akumulasi Omset:</b> Seluruh transaksi penjualan booth otomatis terhubung dan masuk ke perhitungan omset bulanan <b>PIC Marketing</b> yang ditugaskan mengelola booth tersebut.<br />
          <b>2. Transaksi Langsung (Kas vs Piutang):</b> Berbeda dari outlet yang menerapkan sistem tempo/piutang konsinyasi, booth bertransaksi langsung secara tunai/QRIS/transfer, sehingga hasil penjualan langsung diakui sebagai <b>Kas Masuk</b> tanpa menimbulkan tagihan tertunda.<br />
          <b>3. Rekonsiliasi Sisa Stok:</b> Sisa fisik produk saat booth ditutup otomatis dikembalikan ke kuantitas aktif gudang tujuan dan siap dijual kembali (Bukan Retur Rusak).
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <KpiMini icon="💰" label="TOTAL OMSET BOOTH" value={formatRp(totalBoothSalesAll)} color="#15803d" />
        <KpiMini icon="💵" label="TOTAL KAS TERKUMPUL" value={formatRp(totalBoothKasAll)} color="#0f172a" />
        <KpiMini icon="🟢" label="BOOTH AKTIF" value={`${activeBoothCount} Event`} color="#2563eb" />
        <KpiMini icon="🎪" label="TOTAL EVENT" value={`${booths.length} Event`} color="#7c3aed" />
      </div>

      {/* Booth List Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Monitoring Agenda Event &amp; Open Booth</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Daftar seluruh booth yang dikelola oleh tim marketing</div>
          </div>
          <a
            href="/booth"
            style={{
              padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5
            }}
          >
            🎪 Buka Modul Booth Lengkap ↗
          </a>
        </div>

        <div style={{ overflowX: 'auto' }} className="no-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 680 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>NAMA BOOTH / EVENT</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>PIC MARKETING</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>PERIODE</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>STATUS</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>TRANSAKSI</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>TOTAL PENJUALAN</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>KAS MASUK</th>
              </tr>
            </thead>
            <tbody>
              {booths.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                    Belum ada data event atau open booth. Klik tombol &quot;Buka Modul Booth Lengkap&quot; untuk menambah agenda baru.
                  </td>
                </tr>
              ) : (
                booths.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{b.nama}</div>
                      {b.lokasi && <div style={{ fontSize: 11, color: '#64748b' }}>📍 {b.lokasi}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      <b>{b.pic?.nama || 'Belum diset'}</b>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: 12 }}>
                      {new Date(b.tanggal_mulai).toLocaleDateString('id-ID')} s/d {new Date(b.tanggal_selesai).toLocaleDateString('id-ID')}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: b.status === 'AKTIF' ? '#dcfce7' : '#e2e8f0',
                        color: b.status === 'AKTIF' ? '#15803d' : '#64748b'
                      }}>
                        {b.status === 'AKTIF' ? '🟢 AKTIF' : '⚪ SELESAI'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                      {b.sales_count || 0}x
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#15803d' }}>
                      {formatRp(b.total_penjualan)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {formatRp(b.kas_masuk)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// MARKETING USER: MY DASHBOARD (Isolated)
// ═══════════════════════════════════════════════════════════
function MarketingMyDashboard({ data, mutate }: { data: any; mutate: () => void }) {
  const p = data?.myPerformance;
  const currentMonth = data?.currentMonth || new Date().getMonth() + 1;
  const currentYear = data?.currentYear || new Date().getFullYear();
  const [showAddModal, setShowAddModal] = useState(false);
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
      {/* Hero Performance Card */}
      <div style={{
        background: p.pencapaian >= 100 ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)' : p.pencapaian >= 50 ? 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        borderRadius: 20, padding: '24px 28px', border: `1px solid ${p.pencapaian >= 100 ? '#86efac' : p.pencapaian >= 50 ? '#fde047' : '#fca5a5'}`,
        boxShadow: '0 8px 30px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>📊 Dashboard Saya</h2>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{MONTH_NAMES[currentMonth - 1]} {currentYear}</div>
          </div>
          <StatusBadge status={p.status} />
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: '#475569' }}>Pencapaian Target</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: (p.pencapaian || 0) >= 100 ? '#15803d' : (p.pencapaian || 0) >= 50 ? '#ca8a04' : '#dc2626' }}>
              {(p.pencapaian || 0).toFixed(1)}%
            </span>
          </div>
          <ProgressBar value={p.pencapaian || 0} color={(p.pencapaian || 0) >= 100 ? '#22c55e' : (p.pencapaian || 0) >= 50 ? '#eab308' : '#ef4444'} />
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <KpiMini icon="🎯" label="TARGET OMSET" value={p.target_omset > 0 ? formatRp(p.target_omset) : 'Belum diset'} color="#2563eb" />
          <KpiMini icon="💰" label="OMSET MARKETING" value={formatRp(p.total_omset_this_month || 0)} color="#7c3aed" sub="Outlet + Personal" />
          <KpiMini icon="🏪" label="BILLING OUTLET" value={formatRp(p.total_billing_this_month || 0)} color="#0891b2" />
          <KpiMini icon="👤" label="PERSONAL BUYER" value={formatRp(p.personal_buyer_this_month || 0)} color="#d97706" />
          <KpiMini icon="🎪" label="BOOTH (CASHFLOW)" value={formatRp(p.booth_sales_this_month || 0)} color="#059669" sub="Cashflow Perusahaan" />
        </div>
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

      {/* Booth Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🎪</span> Event &amp; Booth Saya ({p.managed_booths?.length || 0})
          </div>
          <a
            href="/booth"
            style={{
              padding: '6px 14px', borderRadius: 8, background: '#eff6ff', color: '#2563eb',
              fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            Buka Kasir / Booth ↗
          </a>
        </div>
        {(!p.managed_booths || p.managed_booths.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: 14, color: '#94a3b8', fontSize: 13 }}>
            Belum ada agenda event atau booth pameran yang ditugaskan kepada Anda.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {p.managed_booths.map((b: any) => (
              <div key={b.id} style={{
                background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{b.nama}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    background: b.status === 'AKTIF' ? '#dcfce7' : '#e2e8f0',
                    color: b.status === 'AKTIF' ? '#15803d' : '#64748b',
                  }}>{b.status}</span>
                </div>
                {b.lokasi && <div style={{ fontSize: 11, color: '#94a3b8' }}>📍 {b.lokasi}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', padding: '8px 10px', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Total Penjualan</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>{formatRp(b.total_penjualan)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Kas Masuk</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{formatRp(b.kas_masuk)}</div>
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
            <span>👤</span> Transaksi Personal Buyer
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ➕ Input Baru
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

      {showAddModal && <AddPersonalBuyerModal onClose={() => setShowAddModal(false)} onSaved={mutate} products={data?.products} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN MARKETING PAGE
// ═══════════════════════════════════════════════════════════
export default function MarketingPage() {
  const { data, isLoading, error, mutate } = useSWR('/api/data/marketing');
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  if (!isMounted) return null;

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data marketing...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', background: '#fef2f2', borderRadius: 16, margin: '24px 0' }}>
        <h3 style={{ color: '#b91c1c', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Gagal Memuat Data Marketing</h3>
        <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>Terjadi kesalahan saat mengambil data dari server. Silakan coba muat ulang halaman (F5).</p>
      </div>
    );
  }

  const userRole = (data?.userRole || '').toUpperCase();
  const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN';
  const currentMonth = data?.currentMonth || new Date().getMonth() + 1;
  const currentYear = data?.currentYear || new Date().getFullYear();

  // ─── ADMIN/OWNER VIEW ──────────────────────
  if (isOwnerOrAdmin) {
    const tabs = [
      {
        id: 'performance',
        label: '📊 Performance Marketing',
        content: <PerformanceDashboard data={data} mutate={mutate} />,
      },
      {
        id: 'booth',
        label: `🎪 Event & Booth (${data?.activeBoothCount || 0})`,
        content: <EventBoothTab data={data} />,
      },
      {
        id: 'personal-buyer',
        label: '👤 Personal Buyer',
        content: <PersonalBuyerTab data={data} mutate={mutate} />,
      },
      {
        id: 'ecommerce',
        label: '🛒 E-Commerce',
        content: <ECommerceTab data={data} />,
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Page Header */}
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Marketing & Penjualan</h2>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Menampilkan data untuk: <b>{MONTH_NAMES[currentMonth - 1]} {currentYear}</b>
          </div>
        </div>

        <Tabs tabs={tabs} />
      </div>
    );
  }

  // ─── MARKETING USER VIEW ──────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MarketingMyDashboard data={data} mutate={mutate} />
    </div>
  );
}
