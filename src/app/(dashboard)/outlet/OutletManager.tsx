'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  createOutlet, 
  updateOutlet, 
  deleteOutlet, 
  addPiutang, 
  addPelunasan, 
  adjustOutletStock, 
  resetOutletFinance,
  toggleOutletDailySales 
} from '@/app/actions';
import useSWR, { mutate } from 'swr';
import { 
  updateOutletProductPrice, 
  updateOutletTypePrice, 
  submitOutletPayment, 
  submitOutletSale, 
  completePendingPaymentAction, 
  submitStockOpname,
  approveStockOpnameAction,
  rejectStockOpnameAction,
  updateOutletTransactionAction,
  deleteOutletTransactionAction
} from './actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  RotateCcw, 
  Package, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  MapPin, 
  User, 
  Pencil, 
  Trash2, 
  X, 
  ExternalLink, 
  MessageCircle, 
  TrendingUp, 
  Truck, 
  Receipt,
  Info,
  Search,
  Layers,
  Calendar,
  AlertTriangle,
  ArrowUpDown
} from 'lucide-react';

function CategorySaleRow({
  t,
  qty,
  onQtyChange,
  outletStocks,
  variantQtys,
  onVariantQtyChange,
  accentClass = 'text-blue-700',
}: {
  t: { id: string; name: string; price: number; stock?: number };
  qty: number | string;
  onQtyChange: (val: number) => void;
  outletStocks: any[];
  variantQtys: Record<string, number>;
  onVariantQtyChange: (productId: string, val: number) => void;
  accentClass?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const numQty = Number(qty) || 0;
  const sub = numQty * t.price;

  const variantsForType = (outletStocks || []).filter(
    (s: any) => s.product?.product_type_id === t.id
  );
  const manualSum = Object.values(variantQtys || {}).reduce(
    (s, q) => s + (Number(q) || 0),
    0
  );
  const autoCount = Math.max(0, numQty - manualSum);

  return (
    <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-slate-800">{t.name}</div>
          <div className="text-[10px] text-slate-400">
            @Rp {t.price.toLocaleString('id-ID')}
            {t.stock !== undefined && ` • Stok: ${t.stock} pcs`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            placeholder="0"
            value={qty}
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : Number(e.target.value);
              onQtyChange(val);
            }}
            className="w-16 border rounded px-2 py-1 text-xs text-center font-bold"
          />
          <span className={`text-xs font-bold min-w-[70px] text-right ${accentClass}`}>
            Rp {sub.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {numQty > 0 && variantsForType.length > 0 && (
        <div className="pt-1 border-t border-dashed border-slate-100">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <span>{expanded ? '▾ Tutup Rincian Varian' : '▸ Rincian Varian (Opsional)'}</span>
            <span className="text-[10px] text-slate-400 font-normal">
              {manualSum > 0
                ? `(${manualSum} manual, ${autoCount} auto)`
                : '(otomatis dari riwayat kirim & sisa stok)'}
            </span>
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5 bg-slate-50/80 p-2 rounded-lg border border-slate-200/70">
              {variantsForType.map((s: any) => {
                const vQty = variantQtys?.[s.product_id] || 0;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-700 font-medium truncate">
                      {s.product?.short_name || s.product?.name}
                      <span className="text-slate-400 font-normal ml-1">(sisa {s.quantity})</span>
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={numQty}
                      placeholder="Auto"
                      value={vQty || ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? 0 : Number(e.target.value);
                        onVariantQtyChange(s.product_id, v);
                      }}
                      className="w-16 border rounded px-1.5 py-0.5 text-[11px] text-center bg-white font-semibold"
                    />
                  </div>
                );
              })}
              {manualSum > numQty ? (
                <div className="text-[10px] text-rose-600 font-bold">
                  ⚠️ Rincian varian ({manualSum}) melebihi total kategori ({numQty}).
                </div>
              ) : (
                <div className="text-[10px] text-slate-500">
                  Sisanya ({autoCount} pcs) dihitung otomatis dari komposisi kiriman &amp; sisa stok outlet.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OutletManager({ outlets, currentUser, employees }: { outlets: any[], currentUser: any, employees: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('STOK');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockDelta, setStockDelta] = useState<number | ''>('');
  const [stockNote, setStockNote] = useState<string>('');

  // SWR for warehouses & products (stok gudang sync)
  const { data: warehouseData } = useSWR('/api/data/warehouses');
  const { data: productData } = useSWR('/api/data/products');
  const warehouses = warehouseData?.warehouses || [];
  const products = productData?.products || [];
  const productTypes = productData?.productTypes || [];

  const [stockWarehouseId, setStockWarehouseId] = useState<string>('');
  const [initialStocks, setInitialStocks] = useState<Record<string, number>>({});
  const [outletWarehouseId, setOutletWarehouseId] = useState<string>('');

  useEffect(() => {
    if (warehouses.length > 0) {
      if (!stockWarehouseId) setStockWarehouseId(warehouses[0].id);
      if (!outletWarehouseId) setOutletWarehouseId(warehouses[0].id);
    }
  }, [warehouses, stockWarehouseId, outletWarehouseId]);

  const [wilayahFilter, setWilayahFilter] = useState<string>('');
  const [marketingFilter, setMarketingFilter] = useState<string>('');
  const [distributorFilter, setDistributorFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTxSubmitting, setIsTxSubmitting] = useState(false);
  const [isSavingStock, setIsSavingStock] = useState(false);
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [isResettingFinance, setIsResettingFinance] = useState(false);
  const [isTogglingMode, setIsTogglingMode] = useState(false);

  // Type stock price editing
  const [editingTypeStockId, setEditingTypeStockId] = useState<string | null>(null);
  const [newTypePrice, setNewTypePrice] = useState<number>(0);
  const [isSavingTypePrice, setIsSavingTypePrice] = useState(false);

  // Consignment Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payNominal, setPayNominal] = useState<number | ''>('');
  const [paySettleOnly, setPaySettleOnly] = useState(false);
  const [payItems, setPayItems] = useState<Record<string, number>>({});
  const [payVariants, setPayVariants] = useState<Record<string, Record<string, number>>>({});
  const [payDesc, setPayDesc] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Daily Sales (SALE) Modal
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleItems, setSaleItems] = useState<Record<string, number>>({});
  const [saleVariants, setSaleVariants] = useState<Record<string, Record<string, number>>>({});
  const [salePeriodStart, setSalePeriodStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [salePeriodEnd, setSalePeriodEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [saleDesc, setSaleDesc] = useState('');
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // Opname Modal
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [opnameActual, setOpnameActual] = useState<Record<string, number>>({});
  const [opnameNotes, setOpnameNotes] = useState('');
  const [opnameAsDraft, setOpnameAsDraft] = useState(false);
  const [isSubmittingOpname, setIsSubmittingOpname] = useState(false);

  // Complete Pending Payment Modal
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingTx, setPendingTx] = useState<any>(null);
  const [pendingItems, setPendingItems] = useState<Record<string, number>>({});
  const [pendingVariants, setPendingVariants] = useState<Record<string, Record<string, number>>>({});
  const [isSubmittingPending, setIsSubmittingPending] = useState(false);

  // Single Transaction Edit Modal
  const [editingOutletTx, setEditingOutletTx] = useState<any>(null);
  const [editTxDesc, setEditTxDesc] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [editTxAmount, setEditTxAmount] = useState<string>('');
  const [isSavingEditTx, setIsSavingEditTx] = useState(false);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'PIUTANG' | 'PELUNASAN'>('PIUTANG');
  const [txAmount, setTxAmount] = useState<number | ''>('');
  const [txDesc, setTxDesc] = useState('');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);

  const userRole = (currentUser?.role || '').toUpperCase();
  const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN';
  const isMarketing = userRole === 'MARKETING' || userRole.includes('MARKETING');
  const isDistributor = userRole === 'DISTRIBUTOR';
  const canAddOutlet = isOwnerOrAdmin || isDistributor;

  // Keep selectedOutlet in sync with latest outlets data from SWR
  useEffect(() => {
    if (selectedOutlet?.id && outlets && !editingStockId && !editingPriceId && !isSavingStock && !isSavingPrice) {
      const fresh = outlets.find((o: any) => o.id === selectedOutlet.id);
      if (fresh) {
        setSelectedOutlet(fresh);
      }
    }
  }, [outlets, editingStockId, editingPriceId, isSavingStock, isSavingPrice]);

  // Helper to reliably compute product unit price for this outlet
  const getStockPrice = (stock: any) => {
    if (stock.harga_beli !== null && stock.harga_beli !== undefined && stock.harga_beli !== '') {
      return Number(stock.harga_beli);
    }
    return Number(stock.product?.base_price || 0);
  };

  // List unique marketing employees (from employees list or assigned outlet pengelola)
  const marketingList = useMemo(() => {
    const listMap = new Map<string, { id: string; nama: string; role?: string }>();

    (employees || []).forEach(emp => {
      const r = (emp.role || '').toUpperCase();
      const p = (emp.posisi || '').toLowerCase();
      // Exclude Admin, Owner, Produksi, Distributor from Marketing list
      if (['ADMIN', 'OWNER', 'PRODUKSI', 'DISTRIBUTOR'].includes(r)) return;
      if (p.includes('admin') || p.includes('owner') || p.includes('produksi') || p.includes('distributor')) return;
      if (r === 'MARKETING' || p.includes('marketing')) {
        listMap.set(emp.id, { id: emp.id, nama: emp.nama, role: emp.role });
      }
    });

    outlets.forEach(o => {
      if (o.pengelola && o.pengelola.id) {
        const pr = (o.pengelola.role || '').toUpperCase();
        if (!['ADMIN', 'OWNER', 'PRODUKSI', 'DISTRIBUTOR'].includes(pr) && !listMap.has(o.pengelola.id)) {
          listMap.set(o.pengelola.id, { id: o.pengelola.id, nama: o.pengelola.nama });
        }
      }
    });

    return Array.from(listMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [employees, outlets]);

  // List unique distributors (from employees with role DISTRIBUTOR or assigned outlet distributor)
  const distributorList = useMemo(() => {
    const listMap = new Map<string, { id: string; nama: string; wilayah?: string }>();

    (employees || []).forEach(emp => {
      if ((emp.role || '').toUpperCase() === 'DISTRIBUTOR') {
        listMap.set(emp.id, { id: emp.id, nama: emp.nama, wilayah: emp.wilayah });
      }
    });

    outlets.forEach(o => {
      if (o.distributor && o.distributor.id) {
        if (!listMap.has(o.distributor.id)) {
          listMap.set(o.distributor.id, { id: o.distributor.id, nama: o.distributor.nama, wilayah: o.distributor.wilayah });
        }
      }
    });

    return Array.from(listMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [employees, outlets]);

  const uniqueWilayah = Array.from(new Set(outlets.map((o) => o.wilayah).filter(Boolean))) as string[];

  const filteredOutlets = outlets.filter((o) => {
    // 0. Strict Role Isolation: Non-admin can ONLY see their assigned outlets
    if (!isOwnerOrAdmin) {
      if (isDistributor) {
        if (o.distributor_id !== currentUser?.id) return false;
      } else {
        // Marketing staff or other non-admin
        if (o.pengelola_id !== currentUser?.id) return false;
      }
    }

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = o.nama?.toLowerCase().includes(q);
      const matchContact = o.kontak?.toLowerCase().includes(q);
      const matchAddress = o.alamat?.toLowerCase().includes(q);
      const matchWilayah = o.wilayah?.toLowerCase().includes(q);
      const matchPengelola = o.pengelola?.nama?.toLowerCase().includes(q);
      if (!matchName && !matchContact && !matchAddress && !matchWilayah && !matchPengelola) {
        return false;
      }
    }

    // 2. Wilayah Filter
    if (wilayahFilter && o.wilayah !== wilayahFilter) return false;

    // 3. Marketing User Filter
    if (marketingFilter) {
      if (marketingFilter === 'unassigned') {
        if (o.pengelola_id) return false;
      } else {
        if (o.pengelola_id !== marketingFilter) return false;
      }
    }

    // 4. Distributor Filter
    if (distributorFilter) {
      if (distributorFilter === 'direct') {
        if (o.distributor_id) return false;
      } else {
        if (o.distributor_id !== distributorFilter) return false;
      }
    }

    return true;
  });

  const openDetailModal = (outlet: any) => {
    setSelectedOutlet(outlet);
    setActiveTab('STOK');
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedOutlet(null);
  };

  const openModal = (outlet?: any) => {
    if (!canAddOutlet) {
      alert('Akses ditolak: Hanya Owner, Admin, atau Distributor yang dapat menambah atau mengedit outlet.');
      return;
    }
    if (outlet) {
      if (!isOwnerOrAdmin && (!isDistributor || outlet.distributor_id !== currentUser?.id)) {
        alert('Akses ditolak: Anda hanya dapat mengedit outlet jaringan kemitraan Anda sendiri.');
        return;
      }
      setFormData(outlet);
      setIsEditing(true);
    } else {
      setFormData({ 
        status: 'Active', 
        order_baru: 0, 
        tagihan: 0, 
        payment: 0, 
        sisa_tagihan: 0, 
        wilayah: isDistributor ? (currentUser?.wilayah || '') : '', 
        pengelola_id: '',
        distributor_id: isDistributor ? currentUser?.id : ''
      });
      setInitialStocks({});
      setOutletWarehouseId(warehouses[0]?.id || '');
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setFormData({});
    setInitialStocks({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!canAddOutlet) {
      alert('Akses ditolak: Hanya Owner, Admin, atau Distributor yang dapat menyimpan perubahan outlet.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateOutlet(formData.id, formData);
      } else {
        const stockItems = Object.entries(initialStocks)
          .filter(([_, qty]) => Number(qty) > 0)
          .map(([productId, qty]) => ({ product_id: productId, qty: Number(qty) }));

        await createOutlet(
          {
            ...formData,
            distributor_id: isDistributor ? currentUser?.id : (formData.distributor_id || null)
          },
          stockItems.length > 0 ? stockItems : undefined,
          stockItems.length > 0 ? (outletWarehouseId || warehouses[0]?.id) : undefined
        );
      }
      await Promise.all([
        mutate('/api/data/outlets'),
        mutate('/api/data/employees'),
        mutate('/api/data/warehouses'),
        mutate('/api/data/products'),
      ]);
      closeModal();
      if (isDetailModalOpen) closeDetailModal();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data outlet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isDeleting) return false;
    const target = outlets.find((o: any) => o.id === id);
    if (!isOwnerOrAdmin && (!isDistributor || target?.distributor_id !== currentUser?.id)) {
      alert('Akses ditolak: Anda hanya dapat menghapus outlet jaringan kemitraan Anda sendiri.');
      return false;
    }
    if (!confirm('Yakin ingin menghapus outlet ini? Riwayat transaksi dan stok outlet ini akan terhapus.')) {
      return false;
    }

    setIsDeleting(true);
    try {
      await deleteOutlet(id);
      await Promise.all([
        mutate('/api/data/outlets'),
        mutate('/api/data/employees')
      ]);
      return true;
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus outlet');
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const openTxModal = (type: 'PIUTANG' | 'PELUNASAN') => {
    if (!isOwnerOrAdmin) {
      alert('Akses ditolak: Hanya Owner atau Admin yang dapat menginput transaksi via dashboard.');
      return;
    }
    setTxType(type);
    setTxAmount('');
    setTxDesc('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setIsTxModalOpen(true);
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutlet || !txAmount || isTxSubmitting) return;
    if (!isOwnerOrAdmin) {
      alert('Akses ditolak: Hanya Owner atau Admin yang dapat menginput transaksi keuangan manual.');
      return;
    }
    
    setIsTxSubmitting(true);
    try {
      if (txType === 'PIUTANG') {
        await addPiutang(selectedOutlet.id, Number(txAmount), txDesc, txDate);
        
        const newTagihan = Number(selectedOutlet.tagihan) + Number(txAmount);
        const newSisa = newTagihan - Number(selectedOutlet.payment);
        
        setSelectedOutlet({
          ...selectedOutlet,
          tagihan: newTagihan,
          sisa_tagihan: newSisa,
          transactions: [
            {
              id: 'temp-' + Date.now(),
              date: new Date(txDate).toISOString(),
              type: 'PIUTANG',
              amount: Number(txAmount),
              description: txDesc
            },
            ...(selectedOutlet.transactions || [])
          ]
        });
        
      } else {
        await addPelunasan(selectedOutlet.id, Number(txAmount), txDesc, txDate);
        
        const newPayment = Number(selectedOutlet.payment) + Number(txAmount);
        const newSisa = Number(selectedOutlet.tagihan) - newPayment;
        
        setSelectedOutlet({
          ...selectedOutlet,
          payment: newPayment,
          sisa_tagihan: newSisa,
          transactions: [
            {
              id: 'temp-' + Date.now(),
              date: new Date(txDate).toISOString(),
              type: 'PELUNASAN',
              amount: Number(txAmount),
              description: txDesc
            },
            ...(selectedOutlet.transactions || [])
          ]
        });
      }
      
      await mutate('/api/data/outlets');
      setIsTxModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan transaksi');
    } finally {
      setIsTxSubmitting(false);
    }
  };

  const handleResetFinance = async () => {
    if (!selectedOutlet || isResettingFinance) return;
    if (!isOwnerOrAdmin) {
      alert('Akses ditolak: Hanya Owner atau Admin yang dapat mereset data keuangan.');
      return;
    }

    const confirmText = `Apakah Anda yakin ingin mereset seluruh data tagihan, pembayaran, dan riwayat transaksi untuk outlet "${selectedOutlet.nama}" menjadi Rp 0?\n\nTindakan ini HANYA DAPAT DILAKUKAN OLEH ADMIN/OWNER dan TIDAK DAPAT DIBATALKAN.`;
    if (!confirm(confirmText)) return;

    setIsResettingFinance(true);
    try {
      await resetOutletFinance(selectedOutlet.id);

      setSelectedOutlet({
        ...selectedOutlet,
        tagihan: 0,
        payment: 0,
        sisa_tagihan: 0,
        order_baru: 0,
        transactions: []
      });

      await mutate('/api/data/outlets');
    } catch (err: any) {
      alert(err.message || 'Gagal mereset keuangan outlet');
    } finally {
      setIsResettingFinance(false);
    }
  };

  const handleToggleMode = async () => {
    if (!selectedOutlet || isTogglingMode) return;
    if (!isOwnerOrAdmin) return;
    const targetMode = !selectedOutlet.has_daily_sales;
    const modeName = targetMode ? 'Modern Trade (Daily Sales)' : 'Reguler';
    if (!confirm(`Ubah mode outlet "${selectedOutlet.nama}" menjadi ${modeName}?`)) return;

    setIsTogglingMode(true);
    try {
      await toggleOutletDailySales(selectedOutlet.id, targetMode);
      setSelectedOutlet({
        ...selectedOutlet,
        has_daily_sales: targetMode,
      });
      await mutate('/api/data/outlets');
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah mode outlet');
    } finally {
      setIsTogglingMode(false);
    }
  };

  const handleSaveTypePrice = async (ts: any) => {
    if (!isOwnerOrAdmin || isSavingTypePrice) return;
    if (newTypePrice < 0) {
      alert('Harga tidak boleh negatif.');
      return;
    }
    setIsSavingTypePrice(true);
    try {
      const res = await updateOutletTypePrice(
        ts.id || 'new',
        newTypePrice,
        selectedOutlet.id,
        ts.product_type_id || ts.product_type?.id
      );
      if (res && !res.success) throw new Error(res.error || 'Gagal menyimpan harga jenis');
      await mutate('/api/data/outlets');
      setEditingTypeStockId(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan harga jenis produk');
    } finally {
      setIsSavingTypePrice(false);
    }
  };

  const openPaymentModal = () => {
    setPayNominal('');
    setPaySettleOnly(false);
    const initialItemMap: Record<string, number> = {};
    (selectedOutlet?.type_stocks || []).forEach((ts: any) => {
      initialItemMap[ts.product_type_id] = 0;
    });
    setPayItems(initialItemMap);
    setPayVariants({});
    setPayDesc('');
    setPayDate(new Date().toISOString().split('T')[0]);
    setIsPaymentModalOpen(true);
  };

  const buildItemsPayload = (
    itemsMap: Record<string, number>,
    variantsMap: Record<string, Record<string, number>>
  ) => {
    return Object.entries(itemsMap)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([typeId, qty]) => {
        const typeVars = variantsMap[typeId] || {};
        const variants = Object.entries(typeVars)
          .filter(([_, vQty]) => Number(vQty) > 0)
          .map(([productId, vQty]) => ({ productId, qty: Number(vQty) }));
        const totalManual = variants.reduce((s, v) => s + v.qty, 0);
        if (totalManual > Number(qty)) {
          throw new Error(`Rincian varian (${totalManual} pcs) melebihi total terjual kategori (${qty} pcs).`);
        }
        return {
          productTypeId: typeId,
          qty: Number(qty),
          ...(variants.length > 0 ? { variants } : {}),
        };
      });
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutlet || !payNominal || isSubmittingPay) return;
    const nominal = Number(payNominal);
    if (nominal <= 0) {
      alert('Nominal pembayaran harus lebih dari 0.');
      return;
    }

    let items;
    try {
      items = buildItemsPayload(payItems, payVariants);
    } catch (err: any) {
      alert(err.message);
      return;
    }

    setIsSubmittingPay(true);
    try {
      const res = await submitOutletPayment(
        selectedOutlet.id,
        nominal,
        items.length > 0 ? items : undefined,
        paySettleOnly,
        payDesc || (paySettleOnly ? 'Pelunasan Sisa Piutang' : 'Laporan Pembayaran Outlet'),
        payDate
      );
      if (res?.error) throw new Error(res.error);

      await mutate('/api/data/outlets');
      setIsPaymentModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses pembayaran');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutlet || isSubmittingSale) return;

    let items;
    try {
      items = buildItemsPayload(saleItems, saleVariants);
    } catch (err: any) {
      alert(err.message);
      return;
    }

    if (items.length === 0) {
      alert('Pilih minimal 1 jenis barang yang terjual.');
      return;
    }

    setIsSubmittingSale(true);
    try {
      const res = await submitOutletSale(
        selectedOutlet.id,
        items,
        salePeriodStart,
        salePeriodEnd,
        saleDesc || 'Pencatatan Penjualan Harian (Daily Sales)'
      );
      if (res?.error) throw new Error(res.error);

      await mutate('/api/data/outlets');
      setIsSaleModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal mencatat daily sales');
    } finally {
      setIsSubmittingSale(false);
    }
  };

  const openOpnameModal = () => {
    const actualMap: Record<string, number> = {};
    (selectedOutlet?.type_stocks || []).forEach((ts: any) => {
      actualMap[ts.product_type_id] = ts.quantity;
    });
    setOpnameActual(actualMap);
    setOpnameNotes('');
    setOpnameAsDraft(false);
    setIsOpnameModalOpen(true);
  };

  const handleSubmitOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutlet || isSubmittingOpname) return;
    const items = Object.entries(opnameActual).map(([typeId, qty]) => ({
      productTypeId: typeId,
      qtyActual: Number(qty) || 0,
    }));

    setIsSubmittingOpname(true);
    try {
      const res = await submitStockOpname(selectedOutlet.id, items, opnameNotes, opnameAsDraft);
      if (res?.error) throw new Error(res.error);

      await mutate('/api/data/outlets');
      setIsOpnameModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan stok opname');
    } finally {
      setIsSubmittingOpname(false);
    }
  };

  const openPendingModal = (tx: any) => {
    setPendingTx(tx);
    const initialItemMap: Record<string, number> = {};
    (selectedOutlet?.type_stocks || []).forEach((ts: any) => {
      initialItemMap[ts.product_type_id] = 0;
    });
    setPendingItems(initialItemMap);
    setPendingVariants({});
    setIsPendingModalOpen(true);
  };

  const handleSubmitPending = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTx || isSubmittingPending) return;

    let items;
    try {
      items = buildItemsPayload(pendingItems, pendingVariants);
    } catch (err: any) {
      alert(err.message);
      return;
    }

    if (items.length === 0) {
      alert('Rincian jenis produk terjual wajib diisi.');
      return;
    }

    setIsSubmittingPending(true);
    try {
      const res = await completePendingPaymentAction(pendingTx.id, items);
      if (res?.error) throw new Error(res.error);

      await mutate('/api/data/outlets');
      setIsPendingModalOpen(false);
      setPendingTx(null);
    } catch (err: any) {
      alert(err.message || 'Gagal melengkapi rincian pembayaran');
    } finally {
      setIsSubmittingPending(false);
    }
  };

  const handleDeleteOutletTx = async (tx: any) => {
    if (!confirm(`Hapus/batalkan transaksi "${tx.type}" senilai Rp ${Number(tx.amount).toLocaleString('id-ID')}? Stok & keuangan akan otomatis dikembalikan.`)) return;
    try {
      const res = await deleteOutletTransactionAction(tx.id);
      if (res?.error) throw new Error(res.error);
      await Promise.all([mutate('/api/data/outlets'), mutate('/api/data/marketing'), mutate('/api/data/overview')]);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus transaksi');
    }
  };

  const handleSaveEditOutletTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutletTx || isSavingEditTx) return;
    setIsSavingEditTx(true);
    try {
      const res = await updateOutletTransactionAction(editingOutletTx.id, {
        description: editTxDesc,
        date: editTxDate,
        ...(editingOutletTx.type === 'PIUTANG_MANUAL' ? { amount: Number(editTxAmount) || 0 } : {}),
      });
      if (res?.error) throw new Error(res.error);
      await Promise.all([mutate('/api/data/outlets'), mutate('/api/data/marketing'), mutate('/api/data/overview')]);
      setEditingOutletTx(null);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui transaksi');
    } finally {
      setIsSavingEditTx(false);
    }
  };

  // Real-time stock adjustment with optimistic SWR sync
  const handleSaveStock = async (stock: any) => {
    if (!isOwnerOrAdmin) {
      alert('Akses ditolak: Hanya Owner atau Admin yang dapat mengubah stok outlet.');
      return;
    }
    const delta = Number(stockDelta);
    if (isNaN(delta) || delta === 0) {
      alert('Masukkan jumlah penyesuaian stok (+ untuk menambah, - untuk mengurangi/kembalikan ke gudang).');
      return;
    }
    const targetQty = Number(stock.quantity) + delta;
    if (targetQty < 0) {
      alert('Stok fisik outlet tidak boleh menjadi minus.');
      return;
    }

    setIsSavingStock(true);
    try {
      const selectedWId = stockWarehouseId || warehouses[0]?.id;
      const res: any = await adjustOutletStock(stock.id, targetQty, stockNote, selectedWId);

      const targetOutletId = selectedOutlet.id;

      // 1. Immutable update for local modal state
      setSelectedOutlet((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tagihan: res?.tagihan !== undefined ? res.tagihan : prev.tagihan,
          sisa_tagihan: res?.sisa_tagihan !== undefined ? res.sisa_tagihan : prev.sisa_tagihan,
          payment: res?.payment !== undefined ? res.payment : prev.payment,
          stocks: (prev.stocks || []).map((s: any) =>
            s.id === stock.id ? { ...s, quantity: targetQty } : s
          )
        };
      });

      // 2. Optimistic update of SWR outlets cache
      await mutate(
        '/api/data/outlets',
        (currentOutlets: any[] | undefined) => {
          if (!currentOutlets) return currentOutlets;
          return currentOutlets.map((o: any) => {
            if (o.id !== targetOutletId) return o;
            return {
              ...o,
              tagihan: res?.tagihan !== undefined ? res.tagihan : o.tagihan,
              sisa_tagihan: res?.sisa_tagihan !== undefined ? res.sisa_tagihan : o.sisa_tagihan,
              payment: res?.payment !== undefined ? res.payment : o.payment,
              stocks: (o.stocks || []).map((s: any) =>
                s.id === stock.id ? { ...s, quantity: targetQty } : s
              )
            };
          });
        },
        false
      );

      // 3. Revalidate from server
      await Promise.all([
        mutate('/api/data/outlets'),
        mutate('/api/data/warehouses'),
        mutate('/api/data/marketing'),
        mutate('/api/data/overview'),
      ]);
      setEditingStockId(null);
      setStockDelta('');
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah stok');
    } finally {
      setIsSavingStock(false);
    }
  };

  // Real-time price update with optimistic SWR sync & instant valuation update
  const handleSavePrice = async (stock: any) => {
    if (!isOwnerOrAdmin) {
      alert('Akses ditolak: Hanya Owner atau Admin yang dapat mengubah harga outlet.');
      return;
    }
    const priceNum = Number(newPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Harga harus berupa angka valid dan tidak boleh negatif.');
      return;
    }
    setIsSavingPrice(true);
    try {
      const res = await updateOutletProductPrice(stock.id, priceNum);
      if (res && !res.success) {
        throw new Error(res.error || 'Gagal mengubah harga');
      }

      const targetOutletId = selectedOutlet.id;

      // 1. Immutable update for local modal state
      setSelectedOutlet((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tagihan: res?.tagihan !== undefined ? res.tagihan : prev.tagihan,
          sisa_tagihan: res?.sisa_tagihan !== undefined ? res.sisa_tagihan : prev.sisa_tagihan,
          payment: res?.payment !== undefined ? res.payment : prev.payment,
          stocks: (prev.stocks || []).map((s: any) =>
            s.id === stock.id ? { ...s, harga_beli: priceNum } : s
          )
        };
      });

      // 2. Optimistic update of SWR outlets cache
      await mutate(
        '/api/data/outlets',
        (currentOutlets: any[] | undefined) => {
          if (!currentOutlets) return currentOutlets;
          return currentOutlets.map((o: any) => {
            if (o.id !== targetOutletId) return o;
            return {
              ...o,
              tagihan: res?.tagihan !== undefined ? res.tagihan : o.tagihan,
              sisa_tagihan: res?.sisa_tagihan !== undefined ? res.sisa_tagihan : o.sisa_tagihan,
              payment: res?.payment !== undefined ? res.payment : o.payment,
              stocks: (o.stocks || []).map((s: any) =>
                s.id === stock.id ? { ...s, harga_beli: priceNum } : s
              )
            };
          });
        },
        false
      );

      // 3. Revalidate from server
      await Promise.all([
        mutate('/api/data/outlets'),
        mutate('/api/data/marketing'),
        mutate('/api/data/overview'),
      ]);
      setEditingPriceId(null);
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah harga');
    } finally {
      setIsSavingPrice(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Daftar Outlet ({filteredOutlets.length})</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isDistributor
                ? 'Kelola jaringan kemitraan outlet dan ketersediaan stok distributor Anda'
                : 'Kelola kemitraan outlet, stok konsinyasi, jaringan distributor, dan penugasan marketing'}
            </p>
          </div>
          {canAddOutlet && (
            <button 
              onClick={() => openModal()} 
              className={`${
                isDistributor ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
              } text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5 cursor-pointer`}
            >
              <span>+</span> {isDistributor ? 'Tambah Outlet Mitra' : 'Tambah Outlet'}
            </button>
          )}
        </div>

        {/* Distributor Mode Banner */}
        {isDistributor && (
          <div className="bg-purple-50 border border-purple-200 text-purple-900 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">🚚 Mode Mitra Distributor:</span>
              <span>Menampilkan jaringan outlet mitra Anda ({currentUser?.nama}). Anda dapat menambah outlet dan memantau stok secara mandiri.</span>
            </div>
            <span className="bg-purple-200/80 text-purple-800 font-extrabold px-2.5 py-1 rounded-lg shrink-0">
              {filteredOutlets.length} Outlet
            </span>
          </div>
        )}

        {/* Filter & Search Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama outlet, alamat, pengelola..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter User Marketing (Owner / Admin Only) */}
          {isOwnerOrAdmin && (
            <div className="min-w-[180px]">
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                value={marketingFilter}
                onChange={e => setMarketingFilter(e.target.value)}
              >
                <option value="">👤 Semua Marketing ({outlets.length})</option>
                {marketingList.map(m => {
                  const count = outlets.filter(o => o.pengelola_id === m.id).length;
                  return (
                    <option key={m.id} value={m.id}>
                      {m.nama} ({count} outlet)
                    </option>
                  );
                })}
                <option value="unassigned">
                  🏢 Dikelola Pusat ({outlets.filter(o => !o.pengelola_id).length})
                </option>
              </select>
            </div>
          )}

          {/* Filter Wilayah */}
          <div className="min-w-[140px]">
            <select 
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              value={wilayahFilter} 
              onChange={e => setWilayahFilter(e.target.value)}
            >
              <option value="">📍 Semua Wilayah</option>
              {uniqueWilayah.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Filter Distributor (Untuk Admin / Owner) */}
          {!isDistributor && (
            <div className="min-w-[190px]">
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                value={distributorFilter}
                onChange={e => setDistributorFilter(e.target.value)}
              >
                <option value="">🚚 Semua Distributor &amp; Pusat</option>
                <option value="direct">🏢 Non-Distributor (Pusat / Direct)</option>
                {distributorList.map(d => {
                  const count = outlets.filter(o => o.distributor_id === d.id).length;
                  return (
                    <option key={d.id} value={d.id}>
                      🚚 {d.nama} ({count} outlet)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Reset Button */}
          {(marketingFilter || wilayahFilter || distributorFilter || searchQuery) && (
            <button
              onClick={() => {
                setMarketingFilter('');
                setWilayahFilter('');
                setDistributorFilter('');
                setSearchQuery('');
              }}
              className="text-xs text-red-600 hover:text-red-700 font-semibold px-2.5 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Nama Outlet</TableHead>
              <TableHead>Kontak & Alamat</TableHead>
              <TableHead>Pengelola</TableHead>
              <TableHead>Sisa Stok</TableHead>
              <TableHead>Sisa Tagihan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOutlets.map((o) => {
              const totalPcs = (o.stocks || []).reduce((acc: number, s: any) => acc + Number(s.quantity || 0), 0);
              const totalValuation = (o.stocks || []).reduce((acc: number, s: any) => {
                const p = getStockPrice(s);
                return acc + (Number(s.quantity || 0) * p);
              }, 0);

              return (
                <TableRow key={o.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openDetailModal(o)}>
                  <TableCell>
                    <div className="font-bold">{o.nama}</div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {o.wilayah && <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full inline-block font-medium">{o.wilayah}</div>}
                      {o.distributor && (
                        <div className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full inline-block font-medium">
                          🚚 Mitra: {o.distributor.nama}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{o.tlp || '-'}</div>
                    <div className="text-xs text-gray-500">{o.alamat || '-'}</div>
                  </TableCell>
                  <TableCell>
                    {o.pengelola?.nama ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
                        <span>👤</span> {o.pengelola.nama}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold">
                        <span>🏢</span> Dikelola Pusat
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-800">{totalPcs} pcs</div>
                    <div className="text-[11px] text-blue-600 font-medium">Rp {totalValuation.toLocaleString('id-ID')}</div>
                  </TableCell>
                  <TableCell style={{ color: Number(o.sisa_tagihan) > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                    Rp {Number(o.sisa_tagihan).toLocaleString('id-ID')}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {isOwnerOrAdmin || (isDistributor && o.distributor_id === currentUser?.id) ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); openModal(o); }} 
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); openDetailModal(o); }} 
                        className="text-slate-600 hover:text-slate-900 font-medium text-xs px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Detail
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredOutlets.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-10">
                  <div className="text-2xl mb-2">🔍</div>
                  <div className="font-semibold text-gray-700">Tidak ada outlet yang cocok dengan filter</div>
                  <div className="text-xs text-gray-400 mt-1">Coba ubah kata kunci pencarian, filter marketing, atau wilayah</div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedOutlet && (() => {
        const totalPhysicalValue = (selectedOutlet.stocks || []).reduce((acc: number, stock: any) => {
          const price = getStockPrice(stock);
          return acc + (Number(stock.quantity || 0) * price);
        }, 0);

        const totalPhysicalPcs = (selectedOutlet.stocks || []).reduce((acc: number, stock: any) => {
          return acc + Number(stock.quantity || 0);
        }, 0);

        const typeStockValuation = (selectedOutlet.type_stocks || []).reduce((acc: number, ts: any) => {
          return acc + (Number(ts.quantity || 0) * Number(ts.harga_beli || ts.product_type?.base_price || 0));
        }, 0);

        const totalTypePcs = (selectedOutlet.type_stocks || []).reduce((acc: number, ts: any) => {
          return acc + Number(ts.quantity || 0);
        }, 0);

        const baseValuation = selectedOutlet.type_stocks && selectedOutlet.type_stocks.length > 0
          ? typeStockValuation
          : (selectedOutlet.valuasi_stok !== undefined ? Number(selectedOutlet.valuasi_stok) : totalPhysicalValue);

        const pendingValuation = Number(selectedOutlet.valuasi_pending || 0);
        const displayedValuation = Math.max(0, baseValuation - pendingValuation);
        const currentPiutang = Number(selectedOutlet.piutang || 0);
        const currentPayment = Number(selectedOutlet.payment || 0);

        const typeStocksToDisplay = (productTypes.length > 0 ? productTypes : (selectedOutlet.type_stocks || []).map((ts: any) => ts.product_type).filter(Boolean)).map((pt: any) => {
          const match = (selectedOutlet.type_stocks || []).find((ts: any) => ts.product_type_id === pt?.id || ts.product_type?.code === pt?.code);
          return {
            id: match?.id,
            product_type_id: pt?.id || match?.product_type_id,
            product_type: pt || match?.product_type,
            quantity: match?.quantity || 0,
            harga_beli: match?.harga_beli !== null && match?.harga_beli !== undefined ? Number(match.harga_beli) : Number(pt?.base_price || 0),
          };
        });

        const cleanPhone = (selectedOutlet.tlp || '').replace(/\D/g, '');
        const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);
        const waUrl = waNumber ? `https://wa.me/${waNumber}` : null;
        const gmapsUrl = selectedOutlet.alamat ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOutlet.nama + ' ' + selectedOutlet.alamat)}` : null;

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center z-[80] p-0 sm:p-4 md:p-6 animate-in fade-in duration-150">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-4xl h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col border border-slate-100 overflow-hidden">
              
              {/* Header (shrink-0: always crisp and never squished) */}
              <div className="p-3.5 sm:p-5 border-b border-slate-100 bg-white shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${
                        selectedOutlet.status?.toLowerCase() === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedOutlet.status?.toLowerCase() === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {selectedOutlet.status || 'Active'}
                      </span>
                      {selectedOutlet.wilayah && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <MapPin size={10} />
                          {selectedOutlet.wilayah}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                        <User size={10} />
                        {selectedOutlet.pengelola?.nama || 'Dikelola Pusat'}
                      </span>
                      <div className="inline-flex items-center gap-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${
                          selectedOutlet.has_daily_sales
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {selectedOutlet.has_daily_sales ? '🏬 Modern Trade (Daily Sales)' : '🏪 Reguler'}
                        </span>
                        {isOwnerOrAdmin && (
                          <button
                            onClick={handleToggleMode}
                            disabled={isTogglingMode}
                            className="text-[10px] sm:text-xs text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer disabled:opacity-50"
                            title="Ubah mode outlet"
                          >
                            {isTogglingMode ? '...' : 'Ganti Mode'}
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">{selectedOutlet.nama}</h3>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {waUrl && (
                      <a 
                        href={waUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
                        title="Chat WhatsApp PIC"
                      >
                        <MessageCircle size={13} />
                        <span>Chat WA</span>
                      </a>
                    )}
                    {isOwnerOrAdmin ? (
                      <>
                        <button 
                          onClick={() => openModal(selectedOutlet)} 
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Pencil size={12} />
                          <span>Edit Data</span>
                        </button>
                        <button 
                          disabled={isDeleting}
                          onClick={async () => {
                            const deleted = await handleDelete(selectedOutlet.id);
                            if (deleted) closeDetailModal();
                          }} 
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-all ${
                            isDeleting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          {isDeleting ? (
                            <>
                              <div className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                              <span>Menghapus...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 size={12} />
                              <span>Hapus</span>
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200/80">
                        <span>👁️ View Only</span>
                      </span>
                    )}
                    <button 
                      onClick={closeDetailModal} 
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ml-auto sm:ml-1"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Segmented Tabs Bar (shrink-0: always accessible at top, never crushed) */}
              <div className="px-3 sm:px-5 border-b border-slate-200 bg-white shrink-0 flex gap-1 sm:gap-2 overflow-x-auto no-scrollbar h-11 items-center z-10">
                <button 
                  onClick={() => setActiveTab('STOK')}
                  className={`h-full px-2.5 sm:px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'STOK' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Package size={14} />
                  <span>Stok & Harga</span>
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold">
                    {typeStocksToDisplay.length || selectedOutlet.stocks?.length || 0}
                  </span>
                </button>

                <button 
                  onClick={() => setActiveTab('KEUANGAN')}
                  className={`h-full px-2.5 sm:px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'KEUANGAN' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <CreditCard size={14} />
                  <span>Keuangan & Transaksi</span>
                  {(currentPiutang > 0 || pendingValuation > 0) && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </button>

                <button 
                  onClick={() => setActiveTab('PENGIRIMAN')}
                  className={`h-full px-2.5 sm:px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'PENGIRIMAN' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Truck size={14} />
                  <span>Pengiriman</span>
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold">
                    {selectedOutlet.shipments?.length || 0}
                  </span>
                </button>

                <button 
                  onClick={() => setActiveTab('INFO')}
                  className={`h-full px-2.5 sm:px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'INFO' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Info size={14} />
                  <span>Kontak & Alamat</span>
                </button>
              </div>

              {/* Scrollable Content Body (Holds KPI Cards + Tab Content with generous bottom padding) */}
              <div className="overflow-y-auto flex-1 p-3 sm:p-5 space-y-4 pb-24 sm:pb-6">
                
                {/* Pending Valuation Banner */}
                {pendingValuation > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      <span>
                        <b>Valuasi Tertunda:</b> Ada pembayaran dengan valuasi tertunda sebesar <b>Rp {pendingValuation.toLocaleString('id-ID')}</b> karena belum dilengkapi rincian item terjual.
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('KEUANGAN')}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      Buka Tab Keuangan
                    </button>
                  </div>
                )}

                {/* KPI Metrics Grid (3 Konsep Inti yang Dipisahkan) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
                  {/* Valuasi Konsinyasi */}
                  <div className="bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Valuasi Konsinyasi</span>
                      <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Package size={12} />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                        Rp {displayedValuation.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-blue-600 font-medium truncate mt-0.5">
                        {totalTypePcs || totalPhysicalPcs} pcs di outlet
                        {pendingValuation > 0 && (
                          <span className="text-amber-600 font-bold ml-1">(Tertunda Rp {pendingValuation.toLocaleString('id-ID')})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sisa Piutang */}
                  <div className={`p-2.5 sm:p-3 rounded-lg border shadow-xs flex flex-col justify-between ${
                    currentPiutang > 0 ? 'bg-rose-50/80 border-rose-200' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[11px] sm:text-xs font-semibold truncate ${
                        currentPiutang > 0 ? 'text-rose-700' : 'text-slate-500'
                      }`}>
                        Sisa Piutang
                      </span>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        currentPiutang > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <CreditCard size={12} />
                      </div>
                    </div>
                    <div>
                      <div className={`text-sm sm:text-base font-black tracking-tight ${
                        currentPiutang > 0 ? 'text-rose-600' : 'text-slate-800'
                      }`}>
                        Rp {currentPiutang.toLocaleString('id-ID')}
                      </div>
                      <div className={`text-[10px] font-semibold truncate mt-0.5 ${
                        currentPiutang > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {currentPiutang > 0 ? '⚠️ Belum Disetor' : '✅ Bersih / Rp 0'}
                      </div>
                    </div>
                  </div>

                  {/* Total Pembayaran */}
                  <div className="bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Total Pembayaran</span>
                      <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={12} />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-black text-emerald-700 tracking-tight">
                        Rp {currentPayment.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-medium truncate mt-0.5">
                        Setoran diterima
                      </div>
                    </div>
                  </div>

                  {/* Mode Operasional */}
                  <div className="bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Mode Operasional</span>
                      <div className="w-5 h-5 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <TrendingUp size={12} />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-black text-purple-800 tracking-tight">
                        {selectedOutlet.has_daily_sales ? 'Modern Trade' : 'Reguler'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                        {selectedOutlet.has_daily_sales ? 'Daily Sales Harian' : 'Laporan via Setoran'}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* TAB 1: STOK & HARGA */}
                {activeTab === 'STOK' && (
                  <div className="space-y-5">
                    {/* View Only Banner for Marketing */}
                    {!isOwnerOrAdmin && (
                      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-900 leading-relaxed shadow-xs">
                        <Info size={16} className="text-amber-600 shrink-0" />
                        <div>
                          <span className="font-bold">Akses View Only (Marketing):</span> Anda hanya dapat melihat data stok dan harga produk outlet. Penyesuaian stok fisik dan harga khusus outlet hanya dapat diubah oleh Admin atau Owner.
                        </div>
                      </div>
                    )}

                    {/* SECTION 1: Stok & Harga per Jenis (Dasar Valuasi Konsinyasi) */}
                    <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/80 p-3.5 sm:p-4 rounded-xl border border-blue-200 shadow-xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                            <Layers size={16} className="text-blue-600" />
                            <span>Stok & Harga per Jenis (Dasar Valuasi Konsinyasi)</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Patokan akumulasi valuasi Calio di outlet dan dasar pemotongan transaksi per gramasi/jenis.
                          </p>
                        </div>
                        {isOwnerOrAdmin && (
                          <button
                            onClick={openOpnameModal}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer self-start sm:self-auto active:scale-95"
                          >
                            <ArrowUpDown size={13} />
                            <span>+ Stok Opname Fisik</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {typeStocksToDisplay.map((ts: any) => {
                          const subtotal = ts.quantity * ts.harga_beli;
                          const isEditingThis = editingTypeStockId === (ts.id || ts.product_type_id);

                          return (
                            <div key={ts.product_type_id || ts.id} className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-extrabold text-slate-800 text-xs sm:text-sm">{ts.product_type?.name || ts.product_type_id}</span>
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">
                                    {ts.product_type?.code || 'TYPE'}
                                  </span>
                                </div>

                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Stok Jenis:</span>
                                    <span className="font-black text-slate-900 text-sm">{ts.quantity} pcs</span>
                                  </div>
                                </div>

                                {isEditingThis ? (
                                  <div className="flex items-center gap-1 py-1">
                                    <input
                                      type="number"
                                      min="0"
                                      className="w-full border border-blue-300 rounded px-2 py-1 text-xs font-bold"
                                      value={newTypePrice}
                                      onChange={e => setNewTypePrice(Number(e.target.value))}
                                    />
                                    <button
                                      disabled={isSavingTypePrice}
                                      onClick={() => handleSaveTypePrice(ts)}
                                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] rounded font-bold cursor-pointer disabled:opacity-50"
                                    >
                                      {isSavingTypePrice ? '...' : 'Simpan'}
                                    </button>
                                    <button
                                      onClick={() => setEditingTypeStockId(null)}
                                      className="px-1.5 py-1 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between py-1 text-xs">
                                    <span className="text-slate-500 font-medium">Harga Outlet:</span>
                                    <div className="flex items-center gap-1 font-bold text-slate-800">
                                      <span>Rp {ts.harga_beli.toLocaleString('id-ID')}</span>
                                      {isOwnerOrAdmin && (
                                        <button
                                          onClick={() => {
                                            setEditingTypeStockId(ts.id || ts.product_type_id);
                                            setNewTypePrice(ts.harga_beli);
                                          }}
                                          className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                                          title="Ubah harga jenis untuk outlet ini"
                                        >
                                          <Pencil size={11} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-dashed border-slate-200 text-xs">
                                <span className="text-slate-400 font-medium">Valuasi Jenis:</span>
                                <span className="font-extrabold text-blue-700">Rp {subtotal.toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* SECTION 2: Rincian Stok Fisik per Varian Rasa */}
                    <div>
                      <div className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <Package size={15} className="text-slate-500" />
                        <span>Rincian Stok Fisik per Varian Rasa (Histori Pengiriman & Freezer Toko)</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        Pencatatan varian rasa di freezer outlet. Penyesuaian fisik (+ / -) tersinkron otomatis ke gudang yang dipilih.
                      </p>
                    </div>

                    {selectedOutlet.stocks && selectedOutlet.stocks.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {selectedOutlet.stocks.map((stock: any) => {
                          const unitPrice = getStockPrice(stock);
                          const subtotal = Number(stock.quantity || 0) * unitPrice;
                          const isLowStock = stock.quantity > 0 && stock.quantity <= 10;
                          const isOutOfStock = stock.quantity === 0;

                          return (
                            <div key={stock.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-200 transition-all flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <div>
                                    <div className="font-bold text-slate-800 text-sm">{stock.product.name}</div>
                                    <div className="text-[10px] font-mono text-slate-400">{stock.product.sku}</div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isOutOfStock 
                                      ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                                      : isLowStock 
                                        ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {isOutOfStock ? 'Habis' : isLowStock ? 'Menipis' : 'Aman'}
                                  </span>
                                </div>

                                {/* Stock Quantity & Subtotal Value */}
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500 font-medium">Stok Fisik:</span>
                                    <span className="text-sm font-black text-slate-800">{stock.quantity} pcs</span>
                                  </div>
                                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200/60 text-[11px]">
                                    <span className="text-slate-400">Valuasi Aset:</span>
                                    <span className="font-bold text-blue-700">Rp {subtotal.toLocaleString('id-ID')}</span>
                                  </div>
                                </div>

                                {/* Stock Edit Form (Owner / Admin Only) */}
                                {isOwnerOrAdmin && (
                                  editingStockId === stock.id ? (
                                    <div className="space-y-2.5 bg-blue-50/60 p-3 rounded-xl border border-blue-200 mb-3">
                                      <div className="flex items-center justify-between">
                                        <div className="text-[11px] font-bold text-blue-900">Penyesuaian Stok Fisik</div>
                                        <div className="text-[10px] text-slate-500">Stok Saat Ini: <b className="text-slate-800">{stock.quantity} pcs</b></div>
                                      </div>
                                      
                                      {/* Quick Delta Helper & Number Input */}
                                      <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                          <div className="relative">
                                            <input 
                                              type="number" 
                                              className="border border-blue-300 rounded px-2 py-1 text-xs w-20 bg-white font-black text-center text-slate-900" 
                                              placeholder="+ / -"
                                              value={stockDelta} 
                                              onChange={e => {
                                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                                setStockDelta(val);
                                              }} 
                                            />
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button 
                                              type="button" 
                                              onClick={() => setStockDelta(prev => (Number(prev) || 0) - 1)}
                                              className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-xs font-black cursor-pointer transition-colors"
                                              title="Kurang 1 pcs (-1)"
                                            >
                                              -1
                                            </button>
                                            <button 
                                              type="button" 
                                              onClick={() => setStockDelta(prev => (Number(prev) || 0) + 1)}
                                              className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-xs font-black cursor-pointer transition-colors"
                                              title="Tambah 1 pcs (+1)"
                                            >
                                              +1
                                            </button>
                                          </div>
                                          <input 
                                            type="text" 
                                            className="border border-slate-300 rounded px-2 py-1 text-xs flex-1 bg-white" 
                                            placeholder="Keterangan..." 
                                            value={stockNote} 
                                            onChange={e => setStockNote(e.target.value)} 
                                          />
                                        </div>

                                        {/* Live Preview Result */}
                                        {stockDelta !== '' && Number(stockDelta) !== 0 && (
                                          <div className="text-[11px] px-2 py-1 rounded bg-white border border-blue-100 flex items-center justify-between">
                                            <span className="text-slate-500 font-medium">
                                              Hasil Fisik: {stock.quantity} {Number(stockDelta) > 0 ? `+ ${stockDelta}` : `- ${Math.abs(Number(stockDelta))}`} =
                                            </span>
                                            <span className={`font-black ${stock.quantity + Number(stockDelta) < 0 ? 'text-rose-600' : 'text-blue-700'}`}>
                                              {stock.quantity + Number(stockDelta)} pcs
                                              {stock.quantity + Number(stockDelta) < 0 && ' (Tidak valid, stok minus!)'}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Warehouse Selection for Both Plus (+) and Minus (-) */}
                                      {stockDelta !== '' && Number(stockDelta) !== 0 && (
                                        <div className="pt-0.5">
                                          <div className={`text-[10px] font-bold mb-0.5 flex items-center gap-1 ${
                                            Number(stockDelta) > 0 ? 'text-blue-700' : 'text-amber-800'
                                          }`}>
                                            <span>{Number(stockDelta) > 0 ? '🏬 Ambil tambahan dari gudang:' : '🏬 Kembalikan stok ke gudang:'}</span>
                                            <span className="font-black">({Math.abs(Number(stockDelta))} pcs)</span>
                                          </div>
                                          <select
                                            value={stockWarehouseId}
                                            onChange={e => setStockWarehouseId(e.target.value)}
                                            className="w-full text-xs p-1.5 border border-blue-300 rounded-lg bg-white font-medium text-slate-800"
                                          >
                                            {warehouses.map((w: any) => (
                                              <option key={w.id} value={w.id}>
                                                🏬 {w.name} ({w.type === 'FACTORY' ? 'Pabrik' : 'Penyimpanan'})
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}

                                      <div className="flex gap-2 pt-0.5">
                                        <button 
                                          disabled={isSavingStock || stockDelta === '' || Number(stockDelta) === 0 || (stock.quantity + Number(stockDelta) < 0)}
                                          onClick={() => handleSaveStock(stock)} 
                                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-medium flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                        >
                                          {isSavingStock ? (
                                            <>
                                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                              <span>Menyimpan...</span>
                                            </>
                                          ) : (
                                            <span>Simpan Perubahan</span>
                                          )}
                                        </button>
                                        <button 
                                          disabled={isSavingStock} 
                                          onClick={() => { setEditingStockId(null); setStockDelta(''); }} 
                                          className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mb-3">
                                      <button 
                                        onClick={() => { 
                                          setEditingStockId(stock.id); 
                                          setStockDelta(''); 
                                          setStockNote(''); 
                                          setStockWarehouseId(warehouses[0]?.id || ''); 
                                        }} 
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                                      >
                                        <Pencil size={11} />
                                        <span>Sesuaikan Stok Fisik</span>
                                      </button>
                                    </div>
                                  )
                                )}

                                {/* Price Edit Form (Owner / Admin Only) */}
                                {isOwnerOrAdmin && editingPriceId === stock.id ? (
                                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                    <input 
                                      type="number" 
                                      className="border rounded px-2 py-1 text-xs w-full bg-white font-bold" 
                                      value={newPrice} 
                                      onChange={e => setNewPrice(Number(e.target.value))} 
                                    />
                                    <button 
                                      disabled={isSavingPrice}
                                      onClick={() => handleSavePrice(stock)} 
                                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded font-medium flex items-center gap-1 disabled:opacity-60 cursor-pointer"
                                    >
                                      {isSavingPrice ? (
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <span>Simpan</span>
                                      )}
                                    </button>
                                    <button disabled={isSavingPrice} onClick={() => setEditingPriceId(null)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">Batal</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                    <div className="text-xs text-slate-500 font-medium">Harga Jual:</div>
                                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                      Rp {unitPrice.toLocaleString('id-ID')}
                                      {isOwnerOrAdmin && (
                                        <button 
                                          onClick={() => { setEditingPriceId(stock.id); setNewPrice(unitPrice); }} 
                                          className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                                          title="Edit Harga Khusus Outlet"
                                        >
                                          <Pencil size={11} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-8 rounded-xl border border-dashed text-center text-sm text-slate-400 italic">
                        Belum ada data produk untuk outlet ini.
                      </div>
                    )}

                    {/* Riwayat Stok Opname Outlet */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <ArrowUpDown size={14} className="text-blue-600" />
                          <span>Riwayat Stok Opname Fisik ({selectedOutlet.stock_opnames?.length || 0})</span>
                        </div>
                      </div>
                      <div className="bg-white border rounded-xl overflow-hidden shadow-xs">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="text-xs">Tanggal</TableHead>
                              <TableHead className="text-xs">Rincian Item</TableHead>
                              <TableHead className="text-xs">Catatan</TableHead>
                              <TableHead className="text-center text-xs">Status</TableHead>
                              {isOwnerOrAdmin && <TableHead className="text-center text-xs">Aksi</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedOutlet.stock_opnames?.map((op: any) => (
                              <TableRow key={op.id}>
                                <TableCell className="text-xs whitespace-nowrap">{new Date(op.date).toLocaleDateString('id-ID')}</TableCell>
                                <TableCell className="text-xs">
                                  <div className="flex flex-wrap gap-1">
                                    {(op.items || []).map((it: any, i: number) => (
                                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        {it.product_type?.name || 'Jenis'}: {it.qty_system} → <b>{it.qty_actual}</b> ({it.selisih >= 0 ? `+${it.selisih}` : it.selisih})
                                      </span>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">{op.notes || '-'}</TableCell>
                                <TableCell className="text-center text-xs">
                                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                    op.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                    op.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {op.status}
                                  </span>
                                </TableCell>
                                {isOwnerOrAdmin && (
                                  <TableCell className="text-center text-xs whitespace-nowrap">
                                    {op.status === 'DRAFT' ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const r = await approveStockOpnameAction(op.id);
                                            if (r?.error) alert(r.error);
                                            else await mutate('/api/data/outlets');
                                          }}
                                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                        >
                                          Setujui
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const r = await rejectStockOpnameAction(op.id);
                                            if (r?.error) alert(r.error);
                                            else await mutate('/api/data/outlets');
                                          }}
                                          className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded text-[10px] font-bold cursor-pointer"
                                        >
                                          Tolak
                                        </button>
                                      </div>
                                    ) : <span className="text-slate-300">-</span>}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                            {(!selectedOutlet.stock_opnames || selectedOutlet.stock_opnames.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={isOwnerOrAdmin ? 5 : 4} className="text-center text-xs text-slate-400 py-5">Belum ada histori stok opname.</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Riwayat Penyesuaian Stok (Audit Trail) */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <Package size={14} className="text-slate-500" />
                          <span>Audit Trail Penyesuaian Stok</span>
                        </div>
                      </div>
                      <div className="bg-white border rounded-xl overflow-hidden shadow-xs">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="text-xs">Tanggal</TableHead>
                              <TableHead className="text-xs">Produk</TableHead>
                              <TableHead className="text-xs">Penyesuaian</TableHead>
                              <TableHead className="text-xs">Stok Akhir</TableHead>
                              <TableHead className="text-xs">Keterangan & PIC</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedOutlet.stock_history?.map((tx: any) => (
                              <TableRow key={tx.id}>
                                <TableCell className="text-xs">{new Date(tx.date).toLocaleDateString('id-ID')}</TableCell>
                                <TableCell className="text-xs font-medium">{tx.product?.name || '-'}</TableCell>
                                <TableCell className="text-xs">
                                  <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                                    tx.flow === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                  }`}>
                                    {tx.flow === 'IN' ? '+' : '-'}{tx.qty}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs font-bold text-slate-700">{tx.balance} pcs</TableCell>
                                <TableCell className="text-xs">
                                  <div className="text-slate-600">{tx.description || '-'}</div>
                                  {tx.employee && <div className="text-[10px] text-indigo-500 font-medium mt-0.5">PIC: {tx.employee.nama}</div>}
                                </TableCell>
                              </TableRow>
                            ))}
                            {(!selectedOutlet.stock_history || selectedOutlet.stock_history.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-6">Belum ada riwayat penyesuaian stok.</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: KEUANGAN & TRANSAKSI */}
                {activeTab === 'KEUANGAN' && (
                  <div className="space-y-4">
                    {/* Guidance Banner */}
                    <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed shadow-xs">
                      <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Ketentuan Valuasi & Piutang:</span>
                        <ul className="list-disc ml-4 mt-1 space-y-0.5">
                          <li><b>Valuasi Konsinyasi</b> adalah nilai produk Calio yang ada di outlet (berkurang saat barang terjual/disetor).</li>
                          <li><b>Sisa Piutang</b> adalah nilai produk yang sudah terjual namun uangnya belum disetorkan ke Calio.</li>
                          <li><b>Pembayaran Mode A</b> memotong stok konsinyasi sesuai rincian jenis produk terjual. Mode B hanya melunasi piutang lama.</li>
                        </ul>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap gap-2 justify-between items-center bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                      <div>
                        {isOwnerOrAdmin && (
                          <button 
                            type="button"
                            onClick={handleResetFinance}
                            disabled={isResettingFinance}
                            className="bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors border border-red-200 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            title="Reset seluruh transaksi dan saldo keuangan outlet menjadi Rp 0"
                          >
                            {isResettingFinance ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                <span>Mereset...</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw size={13} className="text-red-600" />
                                <span>Reset Keuangan (Rp 0)</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {isOwnerOrAdmin ? (
                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={openPaymentModal} 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <CreditCard size={13} />
                            <span>+ Input Pembayaran (Mode A / B)</span>
                          </button>

                          {selectedOutlet.has_daily_sales && (
                            <button 
                              onClick={() => {
                                const initialSaleMap: Record<string, number> = {};
                                (selectedOutlet?.type_stocks || []).forEach((ts: any) => {
                                  initialSaleMap[ts.product_type_id] = 0;
                                });
                                setSaleItems(initialSaleMap);
                                setSaleDesc('');
                                setIsSaleModalOpen(true);
                              }} 
                              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <TrendingUp size={13} />
                              <span>+ Catat Daily Sales (SALE)</span>
                            </button>
                          )}

                          <button 
                            onClick={() => openTxModal('PIUTANG')} 
                            className="bg-slate-700 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg font-medium text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            title="Input Piutang Manual Lama"
                          >
                            <span>+ Piutang Manual</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic bg-white px-2.5 py-1 rounded-md border border-slate-200">
                          Pelaporan piutang & pelunasan diinput melalui WhatsApp.
                        </div>
                      )}
                    </div>

                    {/* Financial Transactions Table */}
                    <div className="bg-white border rounded-xl overflow-hidden shadow-xs">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs">Tanggal</TableHead>
                            <TableHead className="text-xs">Jenis</TableHead>
                            <TableHead className="text-xs">Rincian Item / Status</TableHead>
                            <TableHead className="text-xs">Dampak Valuasi</TableHead>
                            <TableHead className="text-xs">Dampak Piutang</TableHead>
                            <TableHead className="text-right text-xs">Nominal</TableHead>
                            <TableHead className="text-center text-xs">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOutlet.transactions?.map((tx: any) => {
                            const isPayment = tx.type === 'PAYMENT' || tx.type === 'PELUNASAN';
                            const isSale = tx.type === 'SALE';
                            const valDelta = tx.valuasi_delta !== null && tx.valuasi_delta !== undefined ? Number(tx.valuasi_delta) : null;
                            const piuDelta = tx.piutang_delta !== null && tx.piutang_delta !== undefined ? Number(tx.piutang_delta) : null;
                            const isPending = tx.breakdown_status === 'PENDING';

                            return (
                              <TableRow key={tx.id} className={isPending ? 'bg-amber-50/50' : undefined}>
                                <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                                  {new Date(tx.date).toLocaleDateString('id-ID')}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                                    isPayment 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                      : isSale
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {tx.type}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <div className="font-medium text-slate-700">{tx.description || '-'}</div>
                                  {tx.items && tx.items.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {tx.items.map((it: any, i: number) => (
                                        <span key={i} className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                          {it.qty}x {it.product_type?.name || 'Item'}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {tx.variants && tx.variants.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {tx.variants.map((v: any, i: number) => (
                                        <span key={i} className={`text-[10px] px-1.5 py-0.2 rounded border ${
                                          v.source === 'MANUAL'
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                            : 'bg-sky-50 text-sky-700 border-sky-200'
                                        }`}>
                                          {v.qty}x {v.product?.short_name || v.product?.name} ({v.source === 'MANUAL' ? 'Manual' : 'Auto'})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {tx.breakdown_status && (
                                    <div className="mt-1">
                                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                        tx.breakdown_status === 'COMPLETE'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : tx.breakdown_status === 'PARTIAL'
                                            ? 'bg-blue-100 text-blue-800'
                                            : tx.breakdown_status === 'ESTIMATED'
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {tx.breakdown_status === 'COMPLETE' ? 'Rincian Lengkap' :
                                         tx.breakdown_status === 'PARTIAL' ? 'Rincian Sebagian' :
                                         tx.breakdown_status === 'ESTIMATED' ? 'Qty Diestimasi' : '⚠️ Pending Rincian'}
                                      </span>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs font-bold whitespace-nowrap">
                                  {valDelta !== null ? (
                                    <span className={valDelta < 0 ? 'text-blue-700' : valDelta > 0 ? 'text-slate-800' : 'text-slate-400'}>
                                      {valDelta > 0 ? `+Rp ${valDelta.toLocaleString('id-ID')}` : valDelta < 0 ? `-Rp ${Math.abs(valDelta).toLocaleString('id-ID')}` : 'Rp 0'}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs font-bold whitespace-nowrap">
                                  {piuDelta !== null ? (
                                    <span className={piuDelta > 0 ? 'text-rose-600' : piuDelta < 0 ? 'text-emerald-600' : 'text-slate-400'}>
                                      {piuDelta > 0 ? `+Rp ${piuDelta.toLocaleString('id-ID')}` : piuDelta < 0 ? `-Rp ${Math.abs(piuDelta).toLocaleString('id-ID')}` : 'Rp 0'}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </TableCell>
                                <TableCell className={`text-right text-sm font-black whitespace-nowrap ${
                                  isPayment ? 'text-emerald-700' : 'text-slate-800'
                                }`}>
                                  Rp {Number(tx.amount).toLocaleString('id-ID')}
                                </TableCell>
                                <TableCell className="text-center text-xs whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    {isPending && isOwnerOrAdmin && (
                                      <button
                                        onClick={() => openPendingModal(tx)}
                                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors"
                                      >
                                        Lengkapi
                                      </button>
                                    )}
                                    {isOwnerOrAdmin && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingOutletTx(tx);
                                            setEditTxDesc(tx.description || '');
                                            setEditTxDate(new Date(tx.date).toISOString().split('T')[0]);
                                            setEditTxAmount(String(Number(tx.amount || 0)));
                                          }}
                                          className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                          title="Edit Catatan / Tanggal Transaksi"
                                        >
                                          <Pencil size={12} />
                                        </button>
                                        {(tx.type === 'PAYMENT' || tx.type === 'PELUNASAN' || tx.type === 'SALE' || tx.type === 'PIUTANG_MANUAL' || tx.type === 'PIUTANG') && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteOutletTx(tx)}
                                            className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                            title="Batalkan & Hapus Transaksi (stok dipulihkan)"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {(!selectedOutlet.transactions || selectedOutlet.transactions.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-xs text-slate-400 py-8">Belum ada riwayat transaksi keuangan.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* TAB 3: RIWAYAT PENGIRIMAN */}
                {activeTab === 'PENGIRIMAN' && (
                  <div className="space-y-3">
                    <div className="bg-white border rounded-xl overflow-hidden shadow-xs">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs">Tanggal</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Rincian Produk Dikirim</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOutlet.shipments?.map((ship: any) => (
                            <TableRow key={ship.id}>
                              <TableCell className="text-xs text-slate-600 font-medium">
                                {new Date(ship.date).toLocaleDateString('id-ID')}
                              </TableCell>
                              <TableCell className="text-xs">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px] rounded-full">
                                  {ship.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs">
                                <ul className="space-y-1">
                                  {ship.items?.map((item: any) => (
                                    <li key={item.id} className="flex items-center gap-1.5 text-slate-700 font-medium">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                      <span>{item.product?.name || item.product_id}</span>
                                      <span className="font-bold text-slate-900">({item.qty} pcs)</span>
                                    </li>
                                  ))}
                                </ul>
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!selectedOutlet.shipments || selectedOutlet.shipments.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-xs text-slate-400 py-8">Belum ada riwayat pengiriman.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* TAB 4: DETAIL KONTAK & ALAMAT */}
                {activeTab === 'INFO' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kontak Penanggung Jawab (PIC)</div>
                      
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><User size={16} /></div>
                          <div>
                            <div className="text-xs text-slate-400">Nama PIC</div>
                            <div className="text-sm font-bold text-slate-800">{selectedOutlet.pic || '-'}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Phone size={16} /></div>
                          <div>
                            <div className="text-xs text-slate-400">Nomor Telepon / WA</div>
                            <div className="text-sm font-bold text-slate-800">{selectedOutlet.tlp || '-'}</div>
                          </div>
                        </div>
                      </div>

                      {waUrl && (
                        <div className="pt-2">
                          <a 
                            href={waUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            <MessageCircle size={15} />
                            <span>Hubungi PIC via WhatsApp</span>
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lokasi & Alamat Toko</div>

                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 mt-0.5"><MapPin size={16} /></div>
                        <div>
                          <div className="text-xs text-slate-400">Alamat Lengkap</div>
                          <div className="text-sm font-medium text-slate-800 leading-relaxed">
                            {selectedOutlet.alamat || 'Alamat belum dilengkapi.'}
                          </div>
                          {selectedOutlet.wilayah && (
                            <div className="text-xs text-indigo-600 font-semibold mt-1">
                              Wilayah Operasional: {selectedOutlet.wilayah}
                            </div>
                          )}
                        </div>
                      </div>

                      {gmapsUrl && (
                        <div className="pt-2">
                          <a 
                            href={gmapsUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            <ExternalLink size={14} />
                            <span>Buka di Google Maps</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        );
      })()}

      {/* Transaction Modal */}
      {isTxModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${txType === 'PIUTANG' ? 'bg-red-500' : 'bg-green-500'}`}></span>
              {txType === 'PIUTANG' ? 'Input Piutang Baru' : 'Input Pelunasan'}
            </h3>
            <form onSubmit={handleTxSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">Tanggal</label>
                  <input required type="date" className="w-full border rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 outline-none transition-all text-sm" value={txDate} onChange={e => setTxDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">Nominal (Rp)</label>
                  <input required type="number" min="0" className="w-full border rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 outline-none transition-all text-sm" value={txAmount} onChange={e => setTxAmount(e.target.value ? Number(e.target.value) : '')} placeholder="Contoh: 150000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Keterangan (Opsional)</label>
                <textarea className="w-full border rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 outline-none transition-all" value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="Catatan transaksi..." rows={3} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsTxModalOpen(false)} disabled={isTxSubmitting} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition-colors disabled:opacity-50">Batal</button>
                <button 
                  type="submit" 
                  disabled={isTxSubmitting} 
                  className={`px-4 py-2 text-white rounded-lg font-medium transition-all flex items-center gap-2 ${
                    txType === 'PIUTANG' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                  } ${isTxSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isTxSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Data</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditing ? 'Edit Outlet' : 'Tambah Outlet'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Outlet</label>
                <input required type="text" className="w-full border rounded p-2" value={formData.nama || ''} onChange={e => setFormData({...formData, nama: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Wilayah</label>
                  <input type="text" className="w-full border rounded p-2" value={formData.wilayah || ''} onChange={e => setFormData({...formData, wilayah: e.target.value})} placeholder="Cth: Bandung" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select className="w-full border rounded p-2" value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="Active">Active</option>
                    <option value="Non-Active">Non-Active</option>
                  </select>
                </div>
              </div>
              
              {isOwnerOrAdmin && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Pengelola / Marketing</label>
                    <select className="w-full border rounded p-2 text-sm" value={formData.pengelola_id || ''} onChange={e => setFormData({...formData, pengelola_id: e.target.value})}>
                      <option value="">-- Dikelola Pusat / Belum Ditugaskan --</option>
                      {employees.filter(e => {
                        const r = (e.role || '').toUpperCase();
                        const p = (e.posisi || '').toLowerCase();
                        if (['ADMIN', 'OWNER', 'PRODUKSI', 'DISTRIBUTOR'].includes(r)) return false;
                        if (p.includes('admin') || p.includes('owner') || p.includes('produksi') || p.includes('distributor')) return false;
                        return r === 'MARKETING' || p.includes('marketing') || r === 'MITRA';
                      }).map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.nama} ({emp.role || emp.posisi || 'Marketing'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Mitra Distributor (Opsional)</label>
                    <select 
                      className="w-full border rounded p-2 text-sm" 
                      value={formData.distributor_id || ''} 
                      onChange={e => setFormData({...formData, distributor_id: e.target.value})}
                    >
                      <option value="">-- Non-Distributor (Outlet Langsung CalioFish) --</option>
                      {distributorList.map(d => (
                        <option key={d.id} value={d.id}>🚚 Distributor: {d.nama} {d.wilayah ? `(${d.wilayah})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.has_daily_sales)}
                        onChange={e => setFormData({ ...formData, has_daily_sales: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <span className="text-xs font-bold text-purple-900">
                        🏬 Mode Modern Trade (Daily Sales)
                      </span>
                    </label>
                    <p className="text-[11px] text-purple-700 ml-6 mt-0.5">
                      Aktifkan jika outlet melaporkan penjualan harian (POS) sebelum pembayaran tukar faktur.
                    </p>
                  </div>
                </>
              )}

              {isDistributor && (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900">
                  <span className="font-bold">Kemitraan Distributor:</span> Outlet ini otomatis didaftarkan dalam jaringan kemitraan Anda (<b>{currentUser?.nama}</b>).
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nama PIC</label>
                  <input type="text" placeholder="Cth: Budi" className="w-full border rounded p-2 text-sm" value={formData.pic || ''} onChange={e => setFormData({...formData, pic: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nomor PIC (WA)</label>
                  <input type="text" placeholder="08123456789" className="w-full border rounded p-2 text-sm" value={formData.tlp || ''} onChange={e => setFormData({...formData, tlp: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alamat</label>
                <textarea className="w-full border rounded p-2 text-sm" value={formData.alamat || ''} onChange={e => setFormData({...formData, alamat: e.target.value})} placeholder="Alamat lengkap outlet..." rows={3} />
              </div>

              {!isEditing && isOwnerOrAdmin && (
                <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900">📦 Input Stok Awal Outlet Langsung (Opsional)</span>
                    <span className="text-[10px] text-blue-600 font-medium">Potong stok gudang</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-700">Stok Diambil dari Gudang Mana: *</label>
                    <select 
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white font-medium"
                      value={outletWarehouseId}
                      onChange={e => setOutletWarehouseId(e.target.value)}
                    >
                      {warehouses.map((w: any) => (
                        <option key={w.id} value={w.id}>
                          🏬 {w.name} ({w.type === 'FACTORY' ? 'Pabrik' : 'Penyimpanan'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Jumlah Stok Produk Awal:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {products.map((p: any) => (
                        <div key={p.id} className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col justify-between">
                          <span className="text-xs font-bold text-slate-800 truncate">{p.short_name || p.name}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <input 
                              type="number" 
                              min="0"
                              placeholder="0"
                              className="w-full border rounded px-2 py-1 text-xs font-bold text-slate-800"
                              value={initialStocks[p.id] || ''}
                              onChange={e => setInitialStocks({
                                ...initialStocks,
                                [p.id]: parseInt(e.target.value) || 0
                              })}
                            />
                            <span className="text-[10px] text-slate-400 font-bold shrink-0">pcs</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={closeModal} disabled={isSubmitting} className="px-4 py-2 border rounded text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">Batal</button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className={`px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-all ${
                    isSubmitting ? 'opacity-60 cursor-not-allowed bg-blue-400' : 'hover:bg-blue-700 active:scale-95 cursor-pointer'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Outlet</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Consignment Payment Modal (Mode A / Mode B) */}
      {isPaymentModalOpen && selectedOutlet && (() => {
        const availableTypes = (productTypes.length > 0 ? productTypes : (selectedOutlet.type_stocks || []).map((ts: any) => ts.product_type).filter(Boolean)).map((pt: any) => {
          const match = (selectedOutlet.type_stocks || []).find((ts: any) => ts.product_type_id === pt?.id || ts.product_type?.code === pt?.code);
          return {
            id: pt?.id || match?.product_type_id,
            name: pt?.name || match?.product_type?.name || pt?.code,
            code: pt?.code || match?.product_type?.code,
            price: match?.harga_beli != null ? Number(match.harga_beli) : Number(pt?.base_price || 0),
            stock: match?.quantity || 0,
          };
        });

        const nominal = Number(payNominal) || 0;
        const totalItemsVal = availableTypes.reduce((acc: number, t: any) => {
          const qty = Number(payItems[t.id]) || 0;
          return acc + (qty * t.price);
        }, 0);
        const totalItemsQty = availableTypes.reduce((acc: number, t: any) => acc + (Number(payItems[t.id]) || 0), 0);
        const selisih = totalItemsVal - nominal;

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Input Pembayaran Konsinyasi</h3>
                  <p className="text-xs text-slate-500">Outlet: <b>{selectedOutlet.nama}</b></p>
                </div>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitPayment} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={payDate}
                      onChange={e => setPayDate(e.target.value)}
                      className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nominal Setoran (Rp) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="0"
                      value={payNominal}
                      onChange={e => setPayNominal(e.target.value ? Number(e.target.value) : '')}
                      className="w-full border rounded-lg p-2 text-xs font-bold bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Settle Only Mode Toggle */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paySettleOnly}
                      onChange={e => setPaySettleOnly(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Pelunasan Piutang Lama Saja (Mode B)
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                    Centang jika setoran ini hanya untuk melunasi sisa piutang lama tanpa mengurangi stok konsinyasi di outlet.
                  </p>
                </div>

                {/* Mode A: Breakdown Items */}
                {!paySettleOnly && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">Rincian Produk Terjual (per Jenis):</label>
                      <span className="text-[10px] text-slate-400">Total: {totalItemsQty} pcs</span>
                    </div>

                    <div className="space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                      {availableTypes.map((t: any) => (
                        <CategorySaleRow
                          key={t.id}
                          t={t}
                          qty={payItems[t.id] ?? ''}
                          onQtyChange={(val) => setPayItems(prev => ({ ...prev, [t.id]: val }))}
                          outletStocks={selectedOutlet.stocks || []}
                          variantQtys={payVariants[t.id] || {}}
                          onVariantQtyChange={(pid, val) =>
                            setPayVariants(prev => ({
                              ...prev,
                              [t.id]: { ...(prev[t.id] || {}), [pid]: val },
                            }))
                          }
                          accentClass="text-blue-700"
                        />
                      ))}
                    </div>

                    {/* Live Calculation Feedback */}
                    <div className="p-3 rounded-xl border text-xs space-y-1 bg-white">
                      <div className="flex justify-between text-slate-600">
                        <span>Total Nilai Terjual (Rincian):</span>
                        <span className="font-bold text-slate-900">Rp {totalItemsVal.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Nominal Setoran:</span>
                        <span className="font-bold text-emerald-700">Rp {nominal.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-100">
                        {totalItemsQty === 0 && nominal > 0 ? (
                          <div className="text-amber-700 font-medium">
                            ⚠️ Tanpa rincian item: Pembayaran akan berstatus <b>PENDING</b> sampai rincian dilengkapi.
                          </div>
                        ) : selisih === 0 ? (
                          <div className="text-emerald-700 font-bold">
                            ✅ Setoran PAS: Valuasi berkurang Rp {nominal.toLocaleString('id-ID')}, Piutang Rp 0.
                          </div>
                        ) : selisih > 0 ? (
                          <div className="text-rose-700 font-bold">
                            ⚠️ Ada Selisih: Valuasi berkurang Rp {totalItemsVal.toLocaleString('id-ID')}. Sisa <b>Rp {selisih.toLocaleString('id-ID')}</b> jadi PIUTANG BARU.
                          </div>
                        ) : (
                          <div className="text-blue-700 font-bold">
                            💰 Lebih Bayar: Kelebihan <b>Rp {Math.abs(selisih).toLocaleString('id-ID')}</b> akan melunasi piutang lama.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Catatan transfer, nomor rekening, dsb."
                    value={payDesc}
                    onChange={e => setPayDesc(e.target.value)}
                    className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    disabled={isSubmittingPay}
                    className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPay || !payNominal}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingPay ? 'Memproses...' : 'Simpan Pembayaran'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modern Trade Sale Modal (Daily Sales) */}
      {isSaleModalOpen && selectedOutlet && (() => {
        const availableTypes = (productTypes.length > 0 ? productTypes : (selectedOutlet.type_stocks || []).map((ts: any) => ts.product_type).filter(Boolean)).map((pt: any) => {
          const match = (selectedOutlet.type_stocks || []).find((ts: any) => ts.product_type_id === pt?.id || ts.product_type?.code === pt?.code);
          return {
            id: pt?.id || match?.product_type_id,
            name: pt?.name || match?.product_type?.name || pt?.code,
            price: match?.harga_beli != null ? Number(match.harga_beli) : Number(pt?.base_price || 0),
            stock: match?.quantity || 0,
          };
        });

        const totalSaleVal = availableTypes.reduce((acc: number, t: any) => {
          const qty = Number(saleItems[t.id]) || 0;
          return acc + (qty * t.price);
        }, 0);

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Catat Penjualan Harian (Daily Sales)</h3>
                  <p className="text-xs text-purple-700 font-semibold">Mode Modern Trade: Valuasi berkurang & Piutang naik otomatis</p>
                </div>
                <button onClick={() => setIsSaleModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitSale} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Periode Mulai</label>
                    <input
                      type="date"
                      required
                      value={salePeriodStart}
                      onChange={e => setSalePeriodStart(e.target.value)}
                      className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Periode Selesai</label>
                    <input
                      type="date"
                      required
                      value={salePeriodEnd}
                      onChange={e => setSalePeriodEnd(e.target.value)}
                      className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800">Jumlah Produk Terjual per Jenis:</label>
                  <div className="space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                    {availableTypes.map((t: any) => (
                      <CategorySaleRow
                        key={t.id}
                        t={t}
                        qty={saleItems[t.id] ?? ''}
                        onQtyChange={(val) => setSaleItems(prev => ({ ...prev, [t.id]: val }))}
                        outletStocks={selectedOutlet.stocks || []}
                        variantQtys={saleVariants[t.id] || {}}
                        onVariantQtyChange={(pid, val) =>
                          setSaleVariants(prev => ({
                            ...prev,
                            [t.id]: { ...(prev[t.id] || {}), [pid]: val },
                          }))
                        }
                        accentClass="text-purple-700"
                      />
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs flex justify-between items-center">
                  <span className="font-bold text-purple-900">Total Nilai Penjualan:</span>
                  <span className="text-sm font-black text-purple-900">Rp {totalSaleVal.toLocaleString('id-ID')}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Laporan POS Transmart Minggu ke-2"
                    value={saleDesc}
                    onChange={e => setSaleDesc(e.target.value)}
                    className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSaleModalOpen(false)}
                    disabled={isSubmittingSale}
                    className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSale || totalSaleVal <= 0}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingSale ? 'Menyimpan...' : 'Simpan Daily Sales'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Stock Opname Fisik Modal */}
      {isOpnameModalOpen && selectedOutlet && (() => {
        const availableTypes = (productTypes.length > 0 ? productTypes : (selectedOutlet.type_stocks || []).map((ts: any) => ts.product_type).filter(Boolean)).map((pt: any) => {
          const match = (selectedOutlet.type_stocks || []).find((ts: any) => ts.product_type_id === pt?.id || ts.product_type?.code === pt?.code);
          return {
            id: pt?.id || match?.product_type_id,
            name: pt?.name || match?.product_type?.name || pt?.code,
            price: match?.harga_beli != null ? Number(match.harga_beli) : Number(pt?.base_price || 0),
            currentQty: match?.quantity || 0,
          };
        });

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Stok Opname Fisik Outlet</h3>
                  <p className="text-xs text-slate-500">Koreksi berkala stok riil per jenis produk</p>
                </div>
                <button onClick={() => setIsOpnameModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitOpname} className="space-y-4">
                <div className="space-y-2">
                  {availableTypes.map((t: any) => {
                    const actual = opnameActual[t.id] ?? t.currentQty;
                    const diff = Number(actual) - t.currentQty;

                    return (
                      <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                          <span>{t.name}</span>
                          <span className="text-slate-500">Stok Sistem: <b>{t.currentQty} pcs</b></span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[11px] text-slate-600">Stok Fisik Riil:</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={actual}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                setOpnameActual(prev => ({ ...prev, [t.id]: val }));
                              }}
                              className="w-20 border rounded px-2 py-1 text-xs font-bold text-center bg-white"
                            />
                            <span className={`text-xs font-bold min-w-[50px] text-right ${
                              diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}>
                              {diff > 0 ? `+${diff}` : diff} pcs
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Audit / Opname</label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Audit stok triwulan IV oleh PIC Budi"
                    value={opnameNotes}
                    onChange={e => setOpnameNotes(e.target.value)}
                    className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs bg-amber-50 p-2.5 rounded-lg border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opnameAsDraft}
                    onChange={e => setOpnameAsDraft(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span className="font-semibold text-amber-900">
                    Simpan sebagai DRAFT terlebih dahulu (Approve manual nanti)
                  </span>
                </label>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsOpnameModalOpen(false)}
                    disabled={isSubmittingOpname}
                    className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingOpname}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingOpname ? 'Menyimpan...' : opnameAsDraft ? 'Simpan Draft Opname' : 'Setujui & Terapkan Opname'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Complete Pending Payment Modal */}
      {isPendingModalOpen && pendingTx && selectedOutlet && (() => {
        const availableTypes = (productTypes.length > 0 ? productTypes : (selectedOutlet.type_stocks || []).map((ts: any) => ts.product_type).filter(Boolean)).map((pt: any) => {
          const match = (selectedOutlet.type_stocks || []).find((ts: any) => ts.product_type_id === pt?.id || ts.product_type?.code === pt?.code);
          return {
            id: pt?.id || match?.product_type_id,
            name: pt?.name || match?.product_type?.name || pt?.code,
            price: match?.harga_beli != null ? Number(match.harga_beli) : Number(pt?.base_price || 0),
          };
        });

        const txNominal = Number(pendingTx.amount) || 0;
        const totalItemsVal = availableTypes.reduce((acc: number, t: any) => {
          const qty = Number(pendingItems[t.id]) || 0;
          return acc + (qty * t.price);
        }, 0);

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[95] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Lengkapi Rincian Pembayaran</h3>
                  <p className="text-xs text-amber-700 font-medium">
                    Nominal Transaksi: <b>Rp {txNominal.toLocaleString('id-ID')}</b>
                  </p>
                </div>
                <button onClick={() => setIsPendingModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitPending} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800">Jumlah Produk Terjual (per Kategori):</label>
                  {availableTypes.map((t: any) => (
                    <CategorySaleRow
                      key={t.id}
                      t={t}
                      qty={pendingItems[t.id] ?? ''}
                      onQtyChange={(val) => setPendingItems(prev => ({ ...prev, [t.id]: val }))}
                      outletStocks={selectedOutlet.stocks || []}
                      variantQtys={pendingVariants[t.id] || {}}
                      onVariantQtyChange={(pid, val) =>
                        setPendingVariants(prev => ({
                          ...prev,
                          [t.id]: { ...(prev[t.id] || {}), [pid]: val },
                        }))
                      }
                      accentClass="text-blue-700"
                    />
                  ))}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                  <span className="text-slate-600 font-bold">Total Nilai Terjual:</span>
                  <span className="font-black text-slate-900">Rp {totalItemsVal.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsPendingModalOpen(false)}
                    disabled={isSubmittingPending}
                    className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPending || totalItemsVal <= 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingPending ? 'Menyimpan...' : 'Selesaikan Pembayaran'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Edit Single Outlet Transaction Modal */}
      {editingOutletTx && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[95] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-3">
              Edit Transaksi ({editingOutletTx.type})
            </h3>
            <form onSubmit={handleSaveEditOutletTx} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  required
                  value={editTxDate}
                  onChange={e => setEditTxDate(e.target.value)}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              </div>
              {editingOutletTx.type === 'PIUTANG_MANUAL' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nominal Piutang (Rp)</label>
                  <input
                    type="number"
                    required
                    value={editTxAmount}
                    onChange={e => setEditTxAmount(e.target.value)}
                    className="w-full border rounded-lg p-2 text-xs font-bold"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan</label>
                <textarea
                  rows={2}
                  value={editTxDesc}
                  onChange={e => setEditTxDesc(e.target.value)}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOutletTx(null)}
                  disabled={isSavingEditTx}
                  className="px-3 py-1.5 border rounded-lg text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditTx}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  {isSavingEditTx ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
