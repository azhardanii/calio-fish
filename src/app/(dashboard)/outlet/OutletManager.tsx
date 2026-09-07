'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createOutlet, updateOutlet, deleteOutlet, addPiutang, addPelunasan, adjustOutletStock, resetOutletFinance } from '@/app/actions';
import { mutate } from 'swr';
import { updateOutletProductPrice } from './actions';
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
  Search
} from 'lucide-react';

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
  const [newStockQty, setNewStockQty] = useState<number>(0);
  const [stockNote, setStockNote] = useState<string>('');

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
      if (r === 'MARKETING' || r.includes('MARKETING') || p.includes('marketing')) {
        listMap.set(emp.id, { id: emp.id, nama: emp.nama, role: emp.role });
      }
    });

    outlets.forEach(o => {
      if (o.pengelola && o.pengelola.id) {
        if (!listMap.has(o.pengelola.id)) {
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
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setFormData({});
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
        await createOutlet({
          ...formData,
          distributor_id: isDistributor ? currentUser?.id : (formData.distributor_id || null)
        });
      }
      await Promise.all([
        mutate('/api/data/outlets'),
        mutate('/api/data/employees')
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

  // Real-time stock adjustment with optimistic SWR sync
  const handleSaveStock = async (stock: any) => {
    if (!isOwnerOrAdmin) {
      alert('Akses ditolak: Hanya Owner atau Admin yang dapat mengubah stok outlet.');
      return;
    }
    setIsSavingStock(true);
    try {
      await adjustOutletStock(stock.id, newStockQty, stockNote);

      const targetOutletId = selectedOutlet.id;
      const targetQty = Number(newStockQty);

      // 1. Immutable update for local modal state
      setSelectedOutlet((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
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
              stocks: (o.stocks || []).map((s: any) =>
                s.id === stock.id ? { ...s, quantity: targetQty } : s
              )
            };
          });
        },
        false
      );

      // 3. Revalidate from server
      await mutate('/api/data/outlets');
      setEditingStockId(null);
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
              stocks: (o.stocks || []).map((s: any) =>
                s.id === stock.id ? { ...s, harga_beli: priceNum } : s
              )
            };
          });
        },
        false
      );

      // 3. Revalidate from server
      await mutate('/api/data/outlets');
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

          {/* Filter User Marketing */}
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
                    {selectedOutlet.stocks?.length || 0}
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
                  <span>Keuangan & Tagihan</span>
                  {Number(selectedOutlet.sisa_tagihan || 0) > 0 && (
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
                
                {/* KPI Metrics Grid (Solusi 2: Inside scroll container, perfectly proportioned) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
                  {/* Valuasi Stok Fisik */}
                  <div className="bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Valuasi Stok</span>
                      <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Package size={12} />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                        Rp {totalPhysicalValue.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-blue-600 font-medium truncate mt-0.5">
                        {totalPhysicalPcs} pcs di freezer
                      </div>
                    </div>
                  </div>

                  {/* Total Tagihan */}
                  <div className="bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Total Tagihan</span>
                      <div className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Receipt size={12} />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-black text-slate-800 tracking-tight">
                        Rp {Number(selectedOutlet.tagihan || 0).toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                        Faktur & kiriman
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
                        Rp {Number(selectedOutlet.payment || 0).toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-medium truncate mt-0.5">
                        Setoran lunas
                      </div>
                    </div>
                  </div>

                  {/* Sisa Tagihan */}
                  <div className={`p-2.5 sm:p-3 rounded-lg border shadow-xs flex flex-col justify-between ${
                    Number(selectedOutlet.sisa_tagihan || 0) > 0 
                      ? 'bg-rose-50/80 border-rose-200' 
                      : 'bg-emerald-50/80 border-emerald-200'
                  }`}>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[11px] sm:text-xs font-semibold truncate ${
                        Number(selectedOutlet.sisa_tagihan || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}>
                        Sisa Tagihan
                      </span>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        Number(selectedOutlet.sisa_tagihan || 0) > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        <CreditCard size={12} />
                      </div>
                    </div>
                    <div>
                      <div className={`text-sm sm:text-base font-black tracking-tight ${
                        Number(selectedOutlet.sisa_tagihan || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        Rp {Number(selectedOutlet.sisa_tagihan || 0).toLocaleString('id-ID')}
                      </div>
                      <div className={`text-[10px] font-semibold truncate mt-0.5 ${
                        Number(selectedOutlet.sisa_tagihan || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        {Number(selectedOutlet.sisa_tagihan || 0) > 0 ? '⚠️ Belum Lunas' : '✅ Lunas'}
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
                                    <div className="space-y-2 bg-blue-50/50 p-2.5 rounded-lg border border-blue-200 mb-3">
                                      <div className="text-[11px] font-bold text-blue-900">Sesuaikan Stok Fisik</div>
                                      <div className="flex gap-1.5">
                                        <input 
                                          type="number" 
                                          className="border rounded px-2 py-1 text-xs w-16 bg-white font-bold" 
                                          value={newStockQty} 
                                          onChange={e => setNewStockQty(Number(e.target.value))} 
                                        />
                                        <input 
                                          type="text" 
                                          className="border rounded px-2 py-1 text-xs flex-1 bg-white" 
                                          placeholder="Catatan..." 
                                          value={stockNote} 
                                          onChange={e => setStockNote(e.target.value)} 
                                        />
                                      </div>
                                      <div className="flex gap-2 pt-0.5">
                                        <button 
                                          disabled={isSavingStock}
                                          onClick={() => handleSaveStock(stock)} 
                                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded font-medium flex items-center gap-1 disabled:opacity-60 cursor-pointer"
                                        >
                                          {isSavingStock ? (
                                            <>
                                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                              <span>Menyimpan...</span>
                                            </>
                                          ) : (
                                            <span>Simpan Stok</span>
                                          )}
                                        </button>
                                        <button disabled={isSavingStock} onClick={() => setEditingStockId(null)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">Batal</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mb-3">
                                      <button 
                                        onClick={() => { setEditingStockId(stock.id); setNewStockQty(stock.quantity); setStockNote(''); }} 
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

                {/* TAB 2: KEUANGAN & TAGIHAN */}
                {activeTab === 'KEUANGAN' && (
                  <div className="space-y-4">
                    {/* Guidance Banner (Solusi 2) */}
                    <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed shadow-xs">
                      <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Ketentuan Finansial:</span> Tagihan bertambah resmi saat ada pengiriman produk (Surat Jalan) dan nota piutang. Pembayaran tercatat dari bukti setoran pelunasan. Mengubah angka stok fisik di freezer toko tidak akan menghapus atau memanipulasi histori uang yang sudah dibayarkan.
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap gap-2 justify-between items-center bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <div>
                        {(currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN') && (
                          <button 
                            type="button"
                            onClick={handleResetFinance}
                            disabled={isResettingFinance}
                            className="bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors border border-red-200 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            title="Reset tagihan, pembayaran, dan riwayat transaksi outlet ini menjadi Rp 0 (Khusus Admin/Owner)"
                          >
                            {isResettingFinance ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                <span>Mereset Keuangan...</span>
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
                        <div className="flex gap-2">
                          <button 
                            onClick={() => openTxModal('PIUTANG')} 
                            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <span className="text-base leading-none">+</span> Input Piutang
                          </button>
                          <button 
                            onClick={() => openTxModal('PELUNASAN')} 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <span className="text-base leading-none">+</span> Input Pelunasan
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
                            <TableHead className="text-xs">Keterangan</TableHead>
                            <TableHead className="text-right text-xs">Jumlah</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOutlet.transactions?.map((tx: any) => {
                            const isPayment = tx.type === 'PELUNASAN';
                            return (
                              <TableRow key={tx.id}>
                                <TableCell className="text-xs text-slate-600">{new Date(tx.date).toLocaleDateString('id-ID')}</TableCell>
                                <TableCell className="text-xs">
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                                    isPayment ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {tx.type}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">{tx.description || '-'}</TableCell>
                                <TableCell className={`text-right text-sm font-black ${
                                  isPayment ? 'text-emerald-700' : 'text-rose-600'
                                }`}>
                                  Rp {Number(tx.amount).toLocaleString('id-ID')}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {(!selectedOutlet.transactions || selectedOutlet.transactions.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-xs text-slate-400 py-8">Belum ada riwayat transaksi keuangan.</TableCell>
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
                      {employees.filter(e => (e.role || '').toUpperCase().includes('MARKETING') || (e.posisi || '').toUpperCase().includes('MARKETING') || e.role === 'MITRA').map((emp) => (
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
    </>
  );
}
