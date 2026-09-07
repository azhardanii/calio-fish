'use client';

import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { 
  Users, 
  Store, 
  Factory, 
  CalendarCheck, 
  Clock, 
  Search, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  X,
  UserCheck,
  Heart,
  FileText,
  ChevronRight,
  Activity,
  Filter,
  RotateCcw,
  Building2
} from 'lucide-react';
import { EmployeeManager } from './EmployeeManager';
import { DistributorManager } from './DistributorManager';

// Safe date formatting helpers to prevent any invalid time value or hydration mismatch
function safeFormatDate(val: any): string {
  if (!val) return '-';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
}

function safeFormatTime(val: any): string {
  if (!val) return '-';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  } catch {
    return '-';
  }
}

export default function KaryawanPage() {
  // 1. Mount state
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 2. Date range state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    };
  });
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>(dateRange);

  // 3. API URL calculation
  const apiUrl = useMemo(() => {
    if (appliedDateRange?.from) {
      try {
        const fromStr = format(appliedDateRange.from, 'yyyy-MM-dd');
        const toDate = appliedDateRange.to || appliedDateRange.from;
        const toStr = format(toDate, 'yyyy-MM-dd');
        return `/api/data/employees?startDate=${fromStr}&endDate=${toStr}`;
      } catch (e) {
        console.warn('Error formatting date range URL:', e);
        return '/api/data/employees';
      }
    }
    return '/api/data/employees';
  }, [appliedDateRange]);

  // 4. Data fetching
  const { data, isLoading, error, mutate } = useSWR(apiUrl);
  const { data: currentUser } = useSWR('/api/auth/me');
  
  // 5. Active tab state
  const [activeTab, setActiveTab] = useState<'karyawan' | 'distributor' | 'presensi'>('karyawan');
  
  // 6. Filter states
  const [presensiSearch, setPresensiSearch] = useState('');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('ALL');
  const [presensiStatusFilter, setPresensiStatusFilter] = useState('ALL');

  // 7. Filter label
  const filterLabel = useMemo(() => {
    if (!appliedDateRange?.from) return 'Semua Waktu';
    try {
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
      const isSameDay = fromDate.getTime() === toDate.getTime();
      if (isSameDay) return fromStr;
      
      const toStr = toDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${fromStr} - ${toStr}`;
    } catch {
      return 'Bulan Ini';
    }
  }, [appliedDateRange]);

  const employees: any[] = useMemo(() => {
    return Array.isArray(data?.employees) ? data.employees : [];
  }, [data?.employees]);

  const attendances: any[] = useMemo(() => {
    return Array.isArray(data?.attendances) ? data.attendances : [];
  }, [data?.attendances]);

  const todayAttendances: any[] = useMemo(() => {
    return Array.isArray(data?.todayAttendances) ? data.todayAttendances : [];
  }, [data?.todayAttendances]);

  // 8. Recap List Memo (MUST BE DECLARED BEFORE ANY RETURN STATEMENT TO SATISFY RULES OF HOOKS)
  const employeeRecapList = useMemo(() => {
    const map: Record<string, { hadir: number; izin: number; sakit: number; total: number }> = {};
    
    employees.forEach((emp: any) => {
      if (emp?.id) {
        map[emp.id] = { hadir: 0, izin: 0, sakit: 0, total: 0 };
      }
    });

    attendances.forEach((a: any) => {
      const empId = a?.employee_id;
      if (!empId) return;
      if (!map[empId]) {
        map[empId] = { hadir: 0, izin: 0, sakit: 0, total: 0 };
      }
      const st = (a?.status_kehadiran || '').toUpperCase();
      if (st === 'HADIR') map[empId].hadir++;
      else if (st === 'IZIN') map[empId].izin++;
      else if (st === 'SAKIT') map[empId].sakit++;
      map[empId].total++;
    });

    return employees.map((emp: any) => {
      const empId = emp?.id || '';
      const stats = map[empId] || { hadir: 0, izin: 0, sakit: 0, total: 0 };
      const presenceRate = stats.total > 0 ? ((stats.hadir / stats.total) * 100).toFixed(0) : '-';
      return {
        ...emp,
        stats,
        presenceRate
      };
    });
  }, [employees, attendances]);

  // 9. Filtered recap list memo
  const filteredRecapList = useMemo(() => {
    return employeeRecapList.filter((emp: any) => {
      if (!emp) return false;
      if (selectedEmployeeFilter !== 'ALL' && emp.id !== selectedEmployeeFilter) {
        return false;
      }
      if (presensiSearch.trim()) {
        const q = presensiSearch.toLowerCase();
        const matchName = (emp.nama || '').toLowerCase().includes(q);
        const matchPos = (emp.posisi || emp.role || '').toLowerCase().includes(q);
        if (!matchName && !matchPos) return false;
      }
      return true;
    });
  }, [employeeRecapList, selectedEmployeeFilter, presensiSearch]);

  // 10. Period KPI Stats memo
  const periodStats = useMemo(() => {
    const relevantAttendances = selectedEmployeeFilter === 'ALL'
      ? attendances
      : attendances.filter((a: any) => a?.employee_id === selectedEmployeeFilter);

    const hadir = relevantAttendances.filter((a: any) => (a?.status_kehadiran || '').toUpperCase() === 'HADIR').length;
    const izin = relevantAttendances.filter((a: any) => (a?.status_kehadiran || '').toUpperCase() === 'IZIN').length;
    const sakit = relevantAttendances.filter((a: any) => (a?.status_kehadiran || '').toUpperCase() === 'SAKIT').length;
    const total = relevantAttendances.length;

    return { hadir, izin, sakit, total };
  }, [attendances, selectedEmployeeFilter]);

  // 11. Filtered attendances memo
  const filteredAttendances = useMemo(() => {
    return attendances.filter((a: any) => {
      if (!a) return false;
      if (selectedEmployeeFilter !== 'ALL' && a.employee_id !== selectedEmployeeFilter) {
        return false;
      }

      if (presensiStatusFilter !== 'ALL') {
        if ((a.status_kehadiran || '').toUpperCase() !== presensiStatusFilter) return false;
      }

      if (presensiSearch.trim()) {
        const q = presensiSearch.toLowerCase();
        const matchName = (a.employee?.nama || '').toLowerCase().includes(q);
        const matchReason = (a.alasan || '').toLowerCase().includes(q);
        const matchPos = (a.employee?.posisi || a.employee?.role || '').toLowerCase().includes(q);
        if (!matchName && !matchReason && !matchPos) return false;
      }

      return true;
    });
  }, [attendances, selectedEmployeeFilter, presensiStatusFilter, presensiSearch]);

  // 12. Selected employee object memo
  const selectedEmployeeObj = useMemo(() => {
    if (selectedEmployeeFilter === 'ALL') return null;
    return employees.find((e: any) => e?.id === selectedEmployeeFilter);
  }, [employees, selectedEmployeeFilter]);

  const hasActiveFilter = selectedEmployeeFilter !== 'ALL' || presensiStatusFilter !== 'ALL' || presensiSearch.trim() !== '';

  const handleResetFilters = () => {
    setSelectedEmployeeFilter('ALL');
    setPresensiStatusFilter('ALL');
    setPresensiSearch('');
  };

  // Top header summary numbers
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e: any) => e?.status_aktif).length;
  const marketingCount = employees.filter((e: any) => 
    (e?.role || '').toUpperCase().includes('MARKETING') || (e?.posisi || '').toUpperCase().includes('MARKETING')
  ).length;
  const produksiCount = employees.filter((e: any) => 
    (e?.role || '').toUpperCase().includes('PRODUKSI') || (e?.posisi || '').toUpperCase().includes('PRODUKSI')
  ).length;
  const hadirTodayCount = todayAttendances.filter((a: any) => (a?.status_kehadiran || '').toUpperCase() === 'HADIR').length;

  // ─── CONDITIONAL RETURNS ARE PLACED HERE (AFTER ALL HOOKS ARE FULLY EXECUTED) ───
  if (!isMounted || (isLoading && !data)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14, fontWeight: 600 }}>Memuat data karyawan &amp; presensi...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 text-rose-600 max-w-lg mx-auto my-12 shadow-xs">
        <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500" />
        <div className="font-bold text-base">Gagal memuat data karyawan &amp; presensi</div>
        <div className="text-xs text-gray-500 mt-1">{error?.message || 'Terjadi kesalahan saat memuat data'}</div>
        <button 
          onClick={() => mutate()} 
          className="mt-4 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition cursor-pointer"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── HEADER TITLE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
              Database &amp; Tim Karyawan
            </h1>
          </div>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Direktori master seluruh karyawan internal Calio Fish, penugasan outlet marketing, serta rekap presensi via WhatsApp.
          </p>
        </div>
      </div>

      {/* ── TOP KPI SUMMARY CARDS (OVERVIEW PERUSAHAAN) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Karyawan */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Total Karyawan
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-gray-900 mt-0.5">
            {totalEmployees} <span className="text-xs font-semibold text-gray-400">Orang</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>{activeEmployees} Karyawan Aktif</span>
          </div>
        </div>

        {/* Card 2: Tim Marketing */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Tim Marketing
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-blue-900 mt-0.5">
            {marketingCount} <span className="text-xs font-semibold text-gray-400">Personel</span>
          </div>
          <div className="text-[11px] text-blue-700 font-bold mt-1 truncate">
            Pengelola Outlet Mitra &amp; Booth
          </div>
        </div>

        {/* Card 3: Tim Produksi */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Tim Produksi
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Factory className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-indigo-900 mt-0.5">
            {produksiCount} <span className="text-xs font-semibold text-gray-400">Personel</span>
          </div>
          <div className="text-[11px] text-indigo-700 font-bold mt-1 truncate">
            Pabrik &amp; Gudang Penyimpanan
          </div>
        </div>

        {/* Card 4: Presensi Hari Ini */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              Hadir Hari Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-emerald-700 mt-0.5">
            {hadirTodayCount} <span className="text-xs font-semibold text-gray-400">Hadir</span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium mt-1 truncate">
            {todayAttendances.length} Laporan Presensi Masuk Hari Ini
          </div>
        </div>
      </div>

      {/* ── NAVIGATION PILL TOGGLE ── */}
      <div className="flex items-center gap-2 p-1.5 bg-gray-100/90 border border-gray-200/80 rounded-2xl w-fit max-w-full">
        <button
          onClick={() => setActiveTab('karyawan')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none ${
            activeTab === 'karyawan'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Database Karyawan</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'karyawan' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {employees.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('distributor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none ${
            activeTab === 'distributor'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Database Distributor</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'distributor' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {employees.filter((e: any) => (e?.role || '').toUpperCase() === 'DISTRIBUTOR').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('presensi')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none ${
            activeTab === 'presensi'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Riwayat Presensi WA</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'presensi' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {attendances.length}
          </span>
        </button>
      </div>

      {/* ── TAB CONTENT 1: DATABASE KARYAWAN ── */}
      {activeTab === 'karyawan' && (
        <div className="animate-in fade-in duration-200">
          <EmployeeManager employees={employees} currentUser={currentUser} />
        </div>
      )}

      {/* ── TAB CONTENT: DATABASE DISTRIBUTOR ── */}
      {activeTab === 'distributor' && (
        <div className="animate-in fade-in duration-200">
          <DistributorManager employees={employees} currentUser={currentUser} />
        </div>
      )}

      {/* ── TAB CONTENT 2: RIWAYAT PRESENSI WA ── */}
      {activeTab === 'presensi' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* ── 1. DATE RANGE TOOLBAR (MATCHING PRODUKSI & MARKETING) ── */}
          <div className="marketing-filter-toolbar">
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                📅 Filter Periode Presensi
              </h2>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                Menampilkan data presensi untuk: <b>{filterLabel}</b>
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

          {/* ── 2. FILTER CONTROLS (NAMA KARYAWAN, STATUS, & SEARCH) ── */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama karyawan atau keterangan presensi..."
                value={presensiSearch}
                onChange={(e) => setPresensiSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              {presensiSearch && (
                <button
                  onClick={() => setPresensiSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown Filter: Nama Karyawan */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative min-w-[180px] sm:min-w-[210px]">
                <select
                  value={selectedEmployeeFilter}
                  onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">👤 Semua Karyawan ({employees.length})</option>
                  {employees.map((emp: any) => (
                    <option key={emp?.id || Math.random()} value={emp?.id}>
                      {emp?.nama || 'Karyawan'} ({emp?.posisi || emp?.role || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown Filter: Status Presensi */}
              <div className="relative min-w-[140px] sm:min-w-[160px]">
                <select
                  value={presensiStatusFilter}
                  onChange={(e) => setPresensiStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="HADIR">🟢 Hadir</option>
                  <option value="IZIN">🟡 Izin</option>
                  <option value="SAKIT">🔴 Sakit</option>
                </select>
              </div>

              {/* Reset Filter Button */}
              {hasActiveFilter && (
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition flex items-center gap-1 cursor-pointer shrink-0"
                  title="Reset semua filter"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* ── 3. PERIOD TOTAL KPI SUMMARY CARDS (TOTAL HADIR, SAKIT, & IZIN) ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Card 1: Total Hadir */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-2xl p-4 border border-emerald-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wider truncate">
                  Total Hadir
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-3xl font-black text-emerald-800 mt-0.5">
                {periodStats.hadir} <span className="text-xs font-semibold text-emerald-600">Hari</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-1 truncate">
                {selectedEmployeeObj ? `Presensi ${selectedEmployeeObj.nama}` : 'Akumulasi seluruh karyawan'}
              </div>
            </div>

            {/* Card 2: Total Izin */}
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-2xl p-4 border border-amber-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] sm:text-xs font-bold text-amber-800 uppercase tracking-wider truncate">
                  Total Izin
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-3xl font-black text-amber-800 mt-0.5">
                {periodStats.izin} <span className="text-xs font-semibold text-amber-600">Hari</span>
              </div>
              <div className="text-[11px] text-amber-700 font-medium mt-1 truncate">
                {selectedEmployeeObj ? `Izin ${selectedEmployeeObj.nama}` : 'Keperluan izin/cuti tim'}
              </div>
            </div>

            {/* Card 3: Total Sakit */}
            <div className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 rounded-2xl p-4 border border-rose-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider truncate">
                  Total Sakit
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-3xl font-black text-rose-800 mt-0.5">
                {periodStats.sakit} <span className="text-xs font-semibold text-rose-600">Hari</span>
              </div>
              <div className="text-[11px] text-rose-700 font-medium mt-1 truncate">
                {selectedEmployeeObj ? `Sakit ${selectedEmployeeObj.nama}` : 'Laporan keluhan/surat dokter'}
              </div>
            </div>

            {/* Card 4: Total Log Presensi */}
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl p-4 border border-blue-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] sm:text-xs font-bold text-blue-800 uppercase tracking-wider truncate">
                  Total Presensi
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <CalendarCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-3xl font-black text-blue-800 mt-0.5">
                {periodStats.total} <span className="text-xs font-semibold text-blue-600">Laporan</span>
              </div>
              <div className="text-[11px] text-blue-700 font-medium mt-1 truncate">
                Periode: {filterLabel}
              </div>
            </div>
          </div>

          {/* ── 4. REKAP KEHADIRAN PER KARYAWAN (DATA PER KARYAWAN) ── */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-gray-900">
                    📊 Rekap Kehadiran Per Karyawan
                  </h3>
                  <p className="text-xs text-gray-500">
                    Rincian total hari masuk (hadir), izin, dan sakit setiap karyawan untuk periode <b>{filterLabel}</b>.
                  </p>
                </div>
              </div>

              <div className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-xl self-start sm:self-auto shadow-2xs">
                Total: {filteredRecapList.length} Karyawan
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[620px]">
                <thead>
                  <tr className="bg-gray-50/90 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">NAMA KARYAWAN</th>
                    <th className="py-3 px-4 text-center">🟢 HADIR</th>
                    <th className="py-3 px-4 text-center">🟡 IZIN</th>
                    <th className="py-3 px-4 text-center">🔴 SAKIT</th>
                    <th className="py-3 px-4 text-center">TOTAL PRESENSI</th>
                    <th className="py-3 px-4 text-center">TINGKAT HADIR</th>
                    <th className="py-3 px-4 text-center">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecapList.map((emp: any) => {
                    if (!emp) return null;
                    const isSelected = selectedEmployeeFilter === emp.id;
                    const st = emp.stats || { hadir: 0, izin: 0, sakit: 0, total: 0 };

                    return (
                      <tr 
                        key={emp.id || Math.random()} 
                        className={`transition-colors ${
                          isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50/60'
                        }`}
                      >
                        {/* Employee Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {(emp.nama || 'K').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                <span>{emp.nama || 'Karyawan'}</span>
                                {isSelected && (
                                  <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded-md">
                                    Aktif
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {emp.posisi || emp.role || 'Staff'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Hadir */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center justify-center font-extrabold px-2.5 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {st.hadir} Hari
                          </span>
                        </td>

                        {/* Izin */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center justify-center font-bold px-2.5 py-0.5 rounded-full text-xs ${
                            st.izin > 0 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 font-extrabold' 
                              : 'bg-gray-50 text-gray-400 border border-gray-100'
                          }`}>
                            {st.izin} Hari
                          </span>
                        </td>

                        {/* Sakit */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center justify-center font-bold px-2.5 py-0.5 rounded-full text-xs ${
                            st.sakit > 0 
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 font-extrabold' 
                              : 'bg-gray-50 text-gray-400 border border-gray-100'
                          }`}>
                            {st.sakit} Hari
                          </span>
                        </td>

                        {/* Total */}
                        <td className="py-3.5 px-4 text-center font-extrabold text-gray-900">
                          {st.total} Hari
                        </td>

                        {/* Presence Rate */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`font-bold text-xs ${
                            emp.presenceRate === '-' 
                              ? 'text-gray-400' 
                              : Number(emp.presenceRate) >= 80 
                              ? 'text-emerald-700' 
                              : 'text-amber-700'
                          }`}>
                            {emp.presenceRate !== '-' ? `${emp.presenceRate}%` : '-'}
                          </span>
                        </td>

                        {/* Action: Quick Filter */}
                        <td className="py-3.5 px-4 text-center">
                          {isSelected ? (
                            <button
                              onClick={() => setSelectedEmployeeFilter('ALL')}
                              className="px-2.5 py-1 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
                            >
                              Batal Filter
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedEmployeeFilter(emp.id)}
                              className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                            >
                              Lihat Log
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredRecapList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">
                        Tidak ada data karyawan yang sesuai dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 5. TABEL DETAIL LOG RIWAYAT PRESENSI WA ── */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-gray-900">
                    🕒 Log Rinci Riwayat Presensi WA
                  </h3>
                  <p className="text-xs text-gray-500">
                    Daftar presensi harian yang terkirim dari WhatsApp bot ({filteredAttendances.length} catatan log).
                  </p>
                </div>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">TANGGAL &amp; WAKTU</th>
                    <th className="py-3.5 px-4">NAMA KARYAWAN</th>
                    <th className="py-3.5 px-4 text-center">STATUS KEHADIRAN</th>
                    <th className="py-3.5 px-4">ALASAN / KETERANGAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAttendances.map((a: any) => {
                    if (!a) return null;
                    const status = (a.status_kehadiran || '').toUpperCase();
                    const isHadir = status === 'HADIR';
                    const isIzin = status === 'IZIN';

                    return (
                      <tr key={a.id || Math.random()} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">
                            {safeFormatDate(a.waktu || a.date)}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span>{safeFormatTime(a.waktu || a.date)}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">{a.employee?.nama || 'Karyawan'}</div>
                          <div className="text-[11px] text-gray-400">{a.employee?.posisi || a.employee?.role || ''}</div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isHadir 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : isIzin 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-gray-600">
                          {a.alasan || <span className="text-gray-400 italic">-</span>}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAttendances.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-gray-400">
                        <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <div className="font-semibold text-gray-600">Belum ada riwayat presensi yang sesuai filter</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {hasActiveFilter ? 'Coba ubah filter atau rentang tanggal yang dipilih.' : 'Presensi dikirimkan oleh karyawan melalui bot WhatsApp Calio Fish'}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (Zero Overlap) */}
            <div className="block md:hidden p-3.5 space-y-3">
              {filteredAttendances.map((a: any) => {
                if (!a) return null;
                const status = (a.status_kehadiran || '').toUpperCase();
                const isHadir = status === 'HADIR';
                const isIzin = status === 'IZIN';

                return (
                  <div key={a.id || Math.random()} className="bg-gray-50/70 rounded-2xl border border-gray-200/90 p-3.5 shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{a.employee?.nama || 'Karyawan'}</div>
                        <div className="text-[11px] text-gray-400">{a.employee?.posisi || a.employee?.role || ''}</div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                        isHadir 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : isIzin 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{safeFormatDate(a.waktu || a.date)}</span>
                      <span>•</span>
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>{safeFormatTime(a.waktu || a.date)}</span>
                    </div>

                    {a.alasan && (
                      <div className="bg-white p-2 rounded-xl text-xs text-gray-600 border border-gray-100">
                        <span className="font-semibold text-gray-500">Alasan: </span>
                        <span>{a.alasan}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredAttendances.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <div className="font-semibold text-gray-600 text-sm">Belum ada riwayat presensi</div>
                  <div className="text-xs text-gray-400 mt-1">Presensi dikirimkan oleh karyawan melalui bot WhatsApp Calio Fish</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
