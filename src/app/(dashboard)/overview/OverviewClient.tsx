'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Building2, 
  Store, 
  ShoppingBag, 
  Users, 
  Truck, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  ArrowUpRight, 
  Sparkles,
  DollarSign,
  Wallet,
  Receipt,
  Boxes,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';

type Channel = { 
  name: string; 
  mtd: number; 
  target: number; 
  icon?: string; 
  pct?: number; 
};

type FeedItem = { 
  type: string; 
  title: string; 
  sub: string; 
  time: string; 
  color: string; 
};

type ProductStock = { 
  name: string; 
  stok: number; 
};

interface OverviewData {
  filterState: { from: string; to: string; filterLabel: string };
  highlightOmset: { title: string; value: number; note: string; isUp: boolean };
  totalOmset: number;
  targetChannelsOmset?: number;
  totalTarget: number;
  totalGap: number;
  totalPersentase: number;
  channels: Channel[];
  financials?: {
    totalOmset: number;
    totalKasMasuk: number;
    totalSisaTagihan: number;
    kasPelunasanOutlet: number;
    kasDistributor?: number;
    kasBooth: number;
    kasPersonalBuyer: number;
    kasEcommerce: number;
    totalPengeluaranCalio?: number;
    netMargin?: number;
  };
  boothSummary?: {
    activeBoothCount: number;
    totalBoothCount: number;
    boothOmset: number;
    boothStok: number;
    today?: number;
  };
  personalBuyerSummary?: {
    omset: number;
    today: number;
    count: number;
    allOmset?: number;
  };
  marketingEvaluation?: {
    totalStaff: number;
    totalTarget: number;
    totalRealisasi: number;
    pencapaian: number;
    criticalCount: number;
    behindCount: number;
    onTrackCount: number;
    staff: Array<{
      id: string;
      nama: string;
      posisi?: string;
      no_hp?: string;
      target_omset: number;
      total_billing_this_month: number;
      personal_buyer_this_month: number;
      booth_sales_this_month: number;
      total_omset_this_month: number;
      pencapaian: number;
      gap: number;
      status: 'on_track' | 'behind' | 'critical';
      outlet_count: number;
      total_outstanding_all?: number;
    }>;
  };
  chartData: { 
    date: string; 
    displayDate: string; 
    offline: number; 
    online: number; 
    booth?: number; 
    personal?: number; 
    total?: number; 
  }[];
  totalOutlets: number;
  totalSisaTagihan: number;
  totalEmployees: number;
  hadirToday: number;
  attendanceTodayCount: number;
  lowStockProducts: ProductStock[];
  allProducts: ProductStock[];
  stockDistribution: {
    factoryStok: number;
    storageStok: number;
    boothStok?: number;
    outletStok: number;
    totalStokFisikEkosistem?: number;
    totalKerugian: number;
    warehouses?: Array<{ id: string; name: string; type: string; stock: number }>;
  };
  recentFeed: FeedItem[];
  totalShipments: number;
  totalItemsSent: number;
}

function formatRp(val: number): string {
  if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
  if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}jt`;
  if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}rb`;
  const str = Math.round(Math.abs(val)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (val < 0 ? '-Rp ' : 'Rp ') + str;
}

function formatRpFull(val: number): string {
  const str = Math.round(Math.abs(val)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (val < 0 ? '-Rp ' : 'Rp ') + str;
}

// Custom tooltip for chart
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs shadow-xl min-w-[160px]">
      <div className="font-bold mb-2 text-gray-900 border-b pb-1">
        {item.displayDate || label}
      </div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}:</span>
          </div>
          <span className="font-bold text-gray-800">{formatRpFull(p.value)}</span>
        </div>
      ))}
      <div className="border-t pt-1 mt-1 flex justify-between font-black text-gray-900">
        <span>Total:</span>
        <span>{formatRpFull(item.total || payload.reduce((s: number, x: any) => s + (x.value || 0), 0))}</span>
      </div>
    </div>
  );
}

export default function OverviewClient({ data }: { data: OverviewData; isValidating?: boolean }) {
  const router = useRouter();
  const {
    filterState,
    highlightOmset = { title: 'Omset Hari Ini', value: 0, note: '', isUp: false },
    totalOmset = 0,
    targetChannelsOmset,
    totalTarget = 0,
    totalGap = 0,
    totalPersentase = 0,
    channels = [],
    marketingEvaluation,
    financials,
    boothSummary,
    personalBuyerSummary,
    chartData = [],
    totalOutlets = 0,
    totalSisaTagihan = 0,
    totalEmployees = 0,
    hadirToday = 0,
    attendanceTodayCount = 0,
    lowStockProducts = [],
    allProducts = [],
    stockDistribution,
    recentFeed = [],
    totalShipments = 0,
    totalItemsSent = 0,
  } = data;

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (filterState.from && filterState.to) {
      return {
        from: new Date(filterState.from),
        to: new Date(filterState.to)
      };
    }
    if (filterState.filterLabel !== 'Lifetime (Keseluruhan Waktu)') {
      const today = new Date();
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
      };
    }
    return undefined;
  });

  const [isMounted, setIsMounted] = useState(false);
  const [evalFilter, setEvalFilter] = useState<'all' | 'critical' | 'behind' | 'on_track'>('all');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (filterState?.from && filterState?.to) {
      setDateRange({
        from: new Date(filterState.from),
        to: new Date(filterState.to)
      });
    } else if (filterState?.filterLabel === 'Lifetime (Keseluruhan Waktu)') {
      setDateRange(undefined);
    }
  }, [filterState?.from, filterState?.to, filterState?.filterLabel]);

  const handleApplyFilter = () => {
    if (!dateRange?.from) {
      router.push('/overview?lifetime=true');
      return;
    }
    const fromStr = format(dateRange.from, 'yyyy-MM-dd');
    const toStr = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : fromStr;
    router.push(`/overview?from=${fromStr}&to=${toStr}`);
  };

  const totalKasMasuk = financials?.totalKasMasuk ?? (totalOmset - totalSisaTagihan);

  const filteredStaff = (marketingEvaluation?.staff || []).filter(st => {
    if (evalFilter === 'all') return true;
    return st.status === evalFilter;
  });

  return (
    <div className="space-y-5 sm:space-y-6">

      {/* ── FILTER TOOLBAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">Dashboard Overview</h1>
            <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
              Live Data
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Monitoring omset menyeluruh, perputaran kas, stok fisik, dan operasional: <b className="text-gray-700">{filterState.filterLabel}</b>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker date={dateRange} setDate={setDateRange} />
          <button
            onClick={handleApplyFilter}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95"
          >
            Tampilkan
          </button>
        </div>
      </div>

      {/* ── SECTION DIBAWAH HEADER: TOTAL KAS TERKUMPUL (STANDOUT) & KARTU METRIK ── */}
      {/* ── SECTION 1: 4 PILAR UTAMA KEUANGAN (CORE FINANCIAL HEALTH) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* 1. Total Omset Penjualan */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-indigo-700/40 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-indigo-500/10 pointer-events-none blur-xl" />
          <div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] sm:text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-indigo-400" />
                <span>Total Omset Penjualan</span>
              </span>
              <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                Gross Sales
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1 truncate">
              {formatRp(totalOmset)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-indigo-800/60">
            <div className="flex justify-between items-center text-[10px] text-indigo-200 mb-1">
              <span>Target Gabungan: <b>{totalPersentase}%</b></span>
              <span>{formatRp(totalTarget)}</span>
            </div>
            <div className="w-full bg-indigo-950/80 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-400 h-full rounded-full transition-all"
                style={{ width: `${Math.min(totalPersentase, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. Total Kas Terkumpul */}
        <div className="bg-gradient-to-br from-emerald-800 to-teal-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-emerald-600/40 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-emerald-400/10 pointer-events-none blur-xl" />
          <div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] sm:text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Total Kas Terkumpul</span>
              </span>
              <span className="text-[10px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 px-2 py-0.5 rounded-full">
                Cash Inflow
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1 truncate">
              {formatRp(totalKasMasuk)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-emerald-700/60 text-[10px] text-emerald-200/90 flex flex-col gap-0.5">
            <div className="truncate">
              Dist &amp; Outlet: <b>{formatRp((financials?.kasPelunasanOutlet ?? 0) + (financials?.kasDistributor ?? 0))}</b>
            </div>
            <div className="truncate">
              Booth: <b>{formatRp(financials?.kasBooth ?? 0)}</b> · Online: <b>{formatRp(financials?.kasEcommerce ?? 0)}</b>
            </div>
          </div>
        </div>

        {/* 3. Pengeluaran CalioFish */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-rose-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] sm:text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-rose-600" />
                <span>Pengeluaran CalioFish</span>
              </span>
              <Link 
                href="/pengeluaran" 
                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-0.5 transition"
              >
                <span>Rincian</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-800 mt-1 truncate">
              {formatRp(financials?.totalPengeluaranCalio || 0)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 text-[10px] text-rose-600/90 leading-tight">
            Total biaya dinas, logistik, &amp; operasional CalioFish periode {filterState.filterLabel}
          </div>
        </div>

        {/* 4. Arus Kas Bersih (Net Margin) */}
        <div className={`rounded-2xl p-4 sm:p-5 shadow-xs border flex flex-col justify-between ${
          (financials?.netMargin ?? 0) >= 0 
            ? 'bg-purple-50/70 border-purple-200 text-purple-950' 
            : 'bg-rose-50/70 border-rose-200 text-rose-950'
        }`}>
          <div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                (financials?.netMargin ?? 0) >= 0 ? 'text-purple-700' : 'text-rose-700'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Arus Kas Bersih</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                (financials?.netMargin ?? 0) >= 0 
                  ? 'bg-purple-100 text-purple-800 border-purple-300' 
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                Net Margin
              </span>
            </div>
            <div className={`text-2xl sm:text-3xl font-black mt-1 truncate ${
              (financials?.netMargin ?? 0) >= 0 ? 'text-purple-900' : 'text-rose-800'
            }`}>
              {formatRp(financials?.netMargin ?? (totalKasMasuk - (financials?.totalPengeluaranCalio || 0)))}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-purple-200/60 text-[10px] text-purple-800/80 leading-tight">
            Akumulasi Kas Terkumpul dikurangi Pengeluaran Operasional
          </div>
        </div>
      </div>

      {/* ── SECTION 2: AKTIVITAS PENJUALAN & STATUS OPERASIONAL ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        
        {/* 1. Omset Hari Ini */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              {highlightOmset.title}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
              💰
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-900 truncate mt-0.5">
            {formatRp(highlightOmset.value)}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1 truncate">
            {highlightOmset.note || 'Semua kanal aktif'}
          </div>
        </div>

        {/* 2. Event & Open Booth */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Event &amp; Open Booth
            </span>
            <Link 
              href="/booth" 
              className="w-7 h-7 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm shrink-0 transition"
              title="Buka Manajemen Booth"
            >
              🎪
            </Link>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-900 truncate mt-0.5">
            {formatRp(boothSummary?.boothOmset || 0)}
          </div>
          <Link 
            href="/booth" 
            className="text-[10px] text-purple-700 hover:text-purple-900 font-bold mt-1 flex items-center gap-1 truncate"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span>{boothSummary?.activeBoothCount || 0} Booth Aktif &rarr;</span>
          </Link>
        </div>

        {/* 3. Personal Buyer Direct */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Personal Buyer (Pusat)
            </span>
            <Link 
              href="/marketing" 
              className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm shrink-0 transition"
              title="Buka Tab Personal Buyer"
            >
              👤
            </Link>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-900 truncate mt-0.5">
            {formatRp(personalBuyerSummary?.omset || 0)}
          </div>
          <div className="text-[10px] text-amber-700 font-semibold mt-1 truncate">
            {personalBuyerSummary?.count || 0} Transaksi Pembeli Langsung
          </div>
        </div>

        {/* 4. Sisa Piutang Outlet */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Sisa Piutang Mitra
            </span>
            <Link 
              href="/outlet" 
              className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm shrink-0 transition"
              title="Kelola Outlet & Piutang"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </Link>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-900 truncate mt-0.5">
            {formatRp(totalSisaTagihan)}
          </div>
          <Link 
            href="/outlet" 
            className="text-[10px] text-amber-800 hover:text-amber-950 font-bold mt-1 truncate"
          >
            {totalOutlets} Outlet Terdaftar &rarr;
          </Link>
        </div>
      </div>


      {/* ── ROW 2: CHART + PROGRESS TARGET ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Omset Chart (2 Cols on lg) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
            <div>
              <div className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📈 Tren Omset Seluruh Kanal Penjualan</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Akumulasi harian penjualan Tim Marketing, E-Commerce, Event Booth, &amp; Personal Buyer ({filterState.filterLabel})
              </div>
            </div>
          </div>

          <div className="h-[260px] sm:h-[300px] w-full min-h-[260px]">
            {isMounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorBooth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="displayDate" 
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                    tickFormatter={(v) => formatRp(v)} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Area
                    type="monotone" dataKey="offline" name="Tim Marketing"
                    stroke="#3b82f6" fill="url(#colorTotal)" strokeWidth={2}
                  />
                  <Area
                    type="monotone" dataKey="online" name="E-Commerce"
                    stroke="#06b6d4" fill="url(#colorOnline)" strokeWidth={2}
                  />
                  <Area
                    type="monotone" dataKey="booth" name="Event Booth"
                    stroke="#10b981" fill="url(#colorBooth)" strokeWidth={2}
                  />
                  <Area
                    type="monotone" dataKey="personal" name="Personal Buyer"
                    stroke="#8b5cf6" fill="none" strokeWidth={1.5} strokeDasharray="3 3"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-xs italic">
                Belum ada data penjualan tercatat pada rentang filter ini
              </div>
            )}
          </div>
        </div>

        {/* Channels Breakdown & Target Progress (1 Col on lg) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div>
                <div className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-blue-600" />
                  <span>Jalur Distribusi &amp; Omset</span>
                </div>
                <div className="text-xs text-gray-400">Kontribusi per sales channel</div>
              </div>
            </div>

            <div className="space-y-3">
              {channels.map((ch: Channel, i: number) => {
                const targetBase = targetChannelsOmset ?? totalOmset;
                const porsiPct = targetBase > 0 ? Math.round((ch.mtd / targetBase) * 100) : 0;
                const hasTarget = (ch.target ?? 0) > 0;
                const capaianPct = hasTarget ? Math.round((ch.mtd / ch.target) * 100) : porsiPct;
                const progressWidth = Math.min(Math.max(capaianPct, 0), 100);

                return (
                  <div key={i} className="p-2.5 bg-gray-50/70 border border-gray-100 rounded-xl">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-gray-800 flex items-center gap-1.5 truncate">
                        <span>{ch.icon || '📦'}</span>
                        <span className="truncate">{ch.name}</span>
                      </span>
                      <span className="font-black text-gray-900 whitespace-nowrap ml-2">
                        {formatRp(ch.mtd)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          hasTarget
                            ? capaianPct >= 100 
                              ? 'bg-emerald-500' 
                              : capaianPct >= 50 
                                ? 'bg-blue-600' 
                                : 'bg-amber-500'
                            : 'bg-blue-500'
                        }`} 
                        style={{ width: `${progressWidth}%` }} 
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
                      <span>
                        {hasTarget ? (
                          <>
                            Progress: <b className={capaianPct >= 100 ? 'text-emerald-600 font-bold' : capaianPct >= 50 ? 'text-blue-600 font-bold' : 'text-amber-600 font-bold'}>{capaianPct}%</b>
                            <span className="text-gray-400 ml-1.5">(Porsi: {porsiPct}%)</span>
                          </>
                        ) : (
                          <>Porsi Omset: <b>{porsiPct}%</b></>
                        )}
                      </span>
                      {hasTarget ? (
                        <span className="text-gray-500">Target: {formatRp(ch.target)}</span>
                      ) : (
                        <span className="text-gray-400 italic">Tanpa target</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Target Progress Summary */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex justify-between items-center text-xs font-bold text-gray-800 mb-1">
              <span>Pencapaian Target Gabungan</span>
              <span className="text-blue-600 font-black">{totalPersentase}%</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  totalPersentase >= 100 ? 'bg-emerald-500' : totalPersentase >= 60 ? 'bg-blue-600' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(totalPersentase, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 mt-1.5">
              <span>{formatRp(targetChannelsOmset ?? totalOmset)} dari target {formatRp(totalTarget)}</span>
              <span className={totalGap >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                {totalGap >= 0 ? `+${formatRp(totalGap)} Ahead` : `Gap: ${formatRp(Math.abs(totalGap))}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2.5: EVALUASI KINERJA TIM MARKETING (PIC MARKETING) ── */}
      {marketingEvaluation && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Evaluasi Kinerja Tim Marketing</span>
                </h3>
                <span className="text-xs bg-blue-50 text-blue-800 font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                  Target: {formatRp(marketingEvaluation.totalTarget)}
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  marketingEvaluation.pencapaian >= 100 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : marketingEvaluation.pencapaian >= 60 
                      ? 'bg-blue-50 text-blue-700 border-blue-200' 
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  Realisasi: {formatRp(marketingEvaluation.totalRealisasi)} ({marketingEvaluation.pencapaian}%)
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total target yang dikelola tim marketing: <b>{formatRp(marketingEvaluation.totalTarget)}</b>. Pantau langsung performa tiap staf untuk evaluasi target dan pembagian outlet.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link 
                href="/marketing" 
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>Kelola Target di Halaman Marketing</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Guidance Note: Penjelasan Kontribusi Tim Marketing */}
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed shadow-xs">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Penjelasan Alur Finansial:</span> Kontribusi tim marketing dan persentase capaian target dihitung berdasarkan <b>Kas Masuk Nyata (Uang yang berhasil disetor/dilunasi oleh outlet binaannya)</b> serta transaksi <b>Personal Buyer</b> masing-masing, bukan sekadar tagihan produk yang terkirim ke outlet. Hal ini memastikan target kinerja marketing selaras dengan uang riil yang masuk ke kas perusahaan.
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-gray-400 mr-1">Filter Kinerja:</span>
            <button
              onClick={() => setEvalFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                evalFilter === 'all' 
                  ? 'bg-gray-900 text-white shadow-xs' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Semua ({marketingEvaluation.totalStaff})
            </button>
            <button
              onClick={() => setEvalFilter('critical')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                evalFilter === 'critical' 
                  ? 'bg-rose-600 text-white shadow-xs' 
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span>🔴 Perlu Evaluasi</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{marketingEvaluation.criticalCount}</span>
            </button>
            <button
              onClick={() => setEvalFilter('behind')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                evalFilter === 'behind' 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>🟡 Di Bawah Target</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{marketingEvaluation.behindCount}</span>
            </button>
            <button
              onClick={() => setEvalFilter('on_track')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                evalFilter === 'on_track' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span>🟢 On Track</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{marketingEvaluation.onTrackCount}</span>
            </button>
          </div>

          {/* Warning Banner if any staff is critical */}
          {marketingEvaluation.criticalCount > 0 && evalFilter === 'all' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <b>{marketingEvaluation.criticalCount} staf marketing</b> berada dalam status <b>Perlu Evaluasi</b> (pencapaian &lt; 50% ekspektasi waktu berjalan).
                </span>
              </div>
              <button 
                onClick={() => setEvalFilter('critical')}
                className="underline font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
              >
                Lihat Staf Kritis &rarr;
              </button>
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredStaff.map((st: any) => {
              const isCritical = st.status === 'critical';
              const isBehind = st.status === 'behind';

              return (
                <div 
                  key={st.id} 
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isCritical 
                      ? 'bg-rose-50/30 border-rose-200/90 shadow-xs' 
                      : isBehind 
                        ? 'bg-amber-50/20 border-amber-200/80' 
                        : 'bg-gray-50/60 border-gray-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-black text-gray-900 text-sm truncate flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{
                          backgroundColor: isCritical ? '#e11d48' : isBehind ? '#d97706' : '#059669'
                        }} />
                        <span className="truncate">{st.nama}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate mt-0.5">
                        {st.posisi || 'Marketing'} {st.no_hp ? `• ${st.no_hp}` : ''}
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                      isCritical 
                        ? 'bg-rose-100/80 text-rose-700 border-rose-300' 
                        : isBehind 
                          ? 'bg-amber-100/80 text-amber-800 border-amber-300' 
                          : 'bg-emerald-100/80 text-emerald-800 border-emerald-300'
                    }`}>
                      {isCritical ? '🔴 Perlu Evaluasi' : isBehind ? '🟡 Di Bawah Target' : '🟢 On Track'}
                    </span>
                  </div>

                  {/* Numbers */}
                  <div className="grid grid-cols-2 gap-2 my-2 bg-white p-2.5 rounded-lg border border-gray-100">
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">REALISASI OMSET</div>
                      <div className="text-sm font-black text-blue-900 mt-0.5">{formatRp(st.total_omset_this_month)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TARGET OMSET</div>
                      <div className="text-sm font-black text-gray-700 mt-0.5">{formatRp(st.target_omset)}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1 mb-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-gray-600">Pencapaian:</span>
                      <span className={`font-black ${isCritical ? 'text-rose-600' : isBehind ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {st.pencapaian}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          st.pencapaian >= 100 ? 'bg-emerald-500' : st.pencapaian >= 60 ? 'bg-blue-600' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(Math.max(Number(st.pencapaian) || 0, 0), 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>{st.outlet_count} Outlet Dikelola</span>
                      <span className={st.gap >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        {st.gap >= 0 ? `+${formatRp(st.gap)} Ahead` : `Gap: ${formatRp(Math.abs(st.gap))}`}
                      </span>
                    </div>
                  </div>

                  {/* Breakdown footer */}
                  <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[10px] text-gray-500">
                    <span className="truncate">
                      Outlet: {formatRp(st.total_billing_this_month)} • Direct: {formatRp(st.personal_buyer_this_month)}
                    </span>
                    <Link 
                      href="/marketing" 
                      className="text-blue-600 font-bold hover:underline shrink-0 ml-1"
                    >
                      Evaluasi &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}

            {filteredStaff.length === 0 && (
              <div className="col-span-full py-8 text-center text-gray-400 text-xs italic bg-gray-50 rounded-xl border border-gray-200/60">
                Tidak ada staf marketing dalam kategori filter ini.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ROW 3: STOCK ECOSYSTEM + OPERATIONAL STATUS + RECENT ACTIVITY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* 1. SEBARAN STOK FISIK SELURUH EKOSISTEM */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div>
                <div className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-emerald-600" />
                  <span>Sebaran Stok Fisik</span>
                </div>
                <div className="text-xs text-gray-400">Total stok produk di seluruh ekosistem</div>
              </div>
              <Link href="/warehouse" className="text-xs font-bold text-blue-600 hover:underline">
                Kelola Gudang &rarr;
              </Link>
            </div>

            {/* 4 Titik Lokasi Stok */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5">
                <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider truncate">🏭 Pabrik (Factory)</div>
                <div className="text-base font-black text-blue-950 mt-0.5">{stockDistribution?.factoryStok || 0} pcs</div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider truncate">📦 Gudang Cabang</div>
                <div className="text-base font-black text-emerald-950 mt-0.5">{stockDistribution?.storageStok || 0} pcs</div>
              </div>

              <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-2.5">
                <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider truncate">🎪 Booth Aktif</div>
                <div className="text-base font-black text-purple-950 mt-0.5">{stockDistribution?.boothStok || 0} pcs</div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5">
                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider truncate">🏪 Outlet Mitra</div>
                <div className="text-base font-black text-amber-950 mt-0.5">{stockDistribution?.outletStok || 0} pcs</div>
              </div>
            </div>

            {/* Total Fisik Banner */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 mb-3 flex items-center justify-between text-xs">
              <span className="font-bold text-gray-600">Total Fisik di Seluruh Fasilitas:</span>
              <span className="font-black text-gray-900 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                {stockDistribution?.totalStokFisikEkosistem || ((stockDistribution?.factoryStok || 0) + (stockDistribution?.storageStok || 0) + (stockDistribution?.boothStok || 0) + (stockDistribution?.outletStok || 0))} pcs
              </span>
            </div>

            {/* Produk Stok Tipis */}
            {lowStockProducts.length > 0 && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span><b>{lowStockProducts.length} produk</b> stoknya di bawah 50 pcs (segera jadwalkan produksi).</span>
              </div>
            )}

            {/* List SKU Bar */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
              {allProducts.map((p: any, idx: number) => {
                const maxStok = Math.max(...allProducts.map((x: any) => x.stok), 1);
                const pct = (p.stok / maxStok) * 100;
                const isLow = p.stok <= 50;

                return (
                  <details key={idx} className="group cursor-pointer bg-white border border-gray-100 rounded-lg open:shadow-sm open:pb-2 transition-all">
                    <summary className="flex items-center gap-2 text-xs list-none [&::-webkit-details-marker]:hidden p-2">
                      <span className={`w-24 truncate font-bold ${isLow ? 'text-rose-600' : 'text-gray-700'}`}>
                        {p.name}
                      </span>
                      <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isLow ? 'bg-rose-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        />
                      </div>
                      <span className={`font-mono font-black w-14 text-right ${isLow ? 'text-rose-600' : 'text-gray-900'}`}>
                        {p.stok} pcs
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform duration-200" />
                    </summary>
                    <div className="mt-1 ml-[104px] mr-6 pl-3 border-l-2 border-gray-200 text-[10px] space-y-1.5 text-gray-600">
                      <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                        <span className="font-medium">🏭 Pabrik:</span> 
                        <span className="font-bold text-gray-900">{p.locations?.factory || 0}</span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                        <span className="font-medium">📦 Gudang:</span> 
                        <span className="font-bold text-gray-900">{p.locations?.storage || 0}</span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                        <span className="font-medium">🏪 Outlet:</span> 
                        <span className="font-bold text-gray-900">{p.locations?.outlet || 0}</span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                        <span className="font-medium">🎪 Booth:</span> 
                        <span className="font-bold text-gray-900">{p.locations?.booth || 0}</span>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2. OPERATIONAL STATUS TODAY */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div>
                <div className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Status Operasional</span>
                </div>
                <div className="text-xs text-gray-400">Kehadiran, mitra, &amp; pergerakan logistik</div>
              </div>
            </div>

            <div className="space-y-3.5">
              {/* Mitra Outlet */}
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    <span>Outlet Mitra</span>
                  </div>
                  <div className="text-xl font-black text-gray-900 mt-0.5">{totalOutlets} Toko</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Dikelola tim marketing &amp; pusat</div>
                </div>
                <Link href="/outlet" className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg hover:bg-blue-100 transition">
                  Lihat Outlet
                </Link>
              </div>

              {/* Presensi Karyawan */}
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Presensi Hari Ini</span>
                  </div>
                  <div className="text-xl font-black text-gray-900 mt-0.5">
                    {hadirToday} <span className="text-xs font-normal text-gray-400">/ {totalEmployees} Karyawan</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {attendanceTodayCount === 0 ? 'Belum ada presensi masuk' : `${attendanceTodayCount} orang lapor presensi`}
                  </div>
                </div>
                <Link href="/karyawan" className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg hover:bg-emerald-100 transition">
                  Kehadiran
                </Link>
              </div>

              {/* Logistik & Pengiriman */}
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Logistik Pengiriman</span>
                  </div>
                  <div className="text-xl font-black text-gray-900 mt-0.5">{totalShipments} Resi</div>
                  <div className="text-[11px] text-indigo-700 font-bold mt-0.5">
                    {totalItemsSent.toLocaleString('id-ID')} pcs barang terkirim
                  </div>
                </div>
                <Link href="/pengiriman" className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg hover:bg-indigo-100 transition">
                  Log Logistik
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 3. RECENT ACTIVITY FEED */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div>
                <div className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span>Aktivitas Sistem Terbaru</span>
                </div>
                <div className="text-xs text-gray-400">Log transaksi, booth, &amp; produksi</div>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 no-scrollbar">
              {recentFeed.length > 0 ? (
                recentFeed.map((item: FeedItem, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/70 hover:bg-gray-100 border border-gray-100 transition">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold text-sm shrink-0">
                      {item.type}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 text-xs truncate">{item.title}</div>
                      <div className="text-[11px] text-gray-500 truncate">{item.sub}</div>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                      {item.time}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 italic text-xs text-center py-6">
                  Belum ada aktivitas tercatat
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
